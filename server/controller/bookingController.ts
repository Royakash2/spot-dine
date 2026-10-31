import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.js";
import { Booking } from "../models/Booking.js";
import { Restaurant } from "../models/Restaurant.js";

// @desc  Create a new booking
// POST /api/bookings
// @access Private
export const createBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { restaurantId, date, timeSlot, guests, specialRequests } = req.body;

    // Guard: protect middleware guarantees req.user exists, but we assert here
    // so TypeScript narrows userId from ObjectId|undefined → ObjectId
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }
    const userId = req.user._id;

    // --- 1. Validate required fields ---
    if (!restaurantId || !date || !timeSlot || !guests) {
      res.status(400).json({
        message: "restaurantId, date, timeSlot, and guests are required",
      });
      return;
    }

    // --- 2. Confirm the restaurant exists and is approved ---
    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      status: "approved",
    });

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found or not available" });
      return;
    }

    // --- 3. Check the requested time slot is actually offered ---
    if (!restaurant.availableSlots.includes(timeSlot)) {
      res.status(400).json({
        message: `Time slot "${timeSlot}" is not offered by this restaurant`,
      });
      return;
    }

    // --- 4. Count already-booked seats for this slot on this date ---
    const requestedDate = new Date(date);
    const dayStart = new Date(requestedDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const bookedSeatsResult = await Booking.aggregate([
      {
        $match: {
          restaurant: restaurant._id,
          timeSlot,
          date: { $gte: dayStart, $lte: dayEnd },
          status: { $in: ["pending", "confirmed"] }, // exclude cancelled
        },
      },
      {
        $group: {
          _id: null,
          totalBooked: { $sum: "$guests" },
        },
      },
    ]);

    const alreadyBooked = bookedSeatsResult[0]?.totalBooked ?? 0;
    const availableSeats = restaurant.totalSeats - alreadyBooked;

    if (guests > availableSeats) {
      res.status(409).json({
        message: `Not enough seats. Only ${availableSeats} seat(s) available for this slot.`,
        availableSeats,
      });
      return;
    }

    // --- 5. Create the booking ---
    const booking = await Booking.create({
      restaurant: restaurantId,
      user: userId,
      date: requestedDate,
      timeSlot,
      guests,
      specialRequests: specialRequests ?? "",
      status: "pending",
    });

    // Populate restaurant name and user name for the response
    await booking.populate("restaurant", "name slug location");
    await booking.populate("user", "name email");

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error: any) {
    console.error("Error in createBooking:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// @desc  Get all bookings for the logged-in user
// GET /api/bookings/my
// @access Private
export const getUserBookings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }
    const userId = req.user._id;

    const bookings = await Booking.find({ user: userId })
      .populate("restaurant", "name slug location image cuisine")
      .sort({ date: -1 }); // most recent first

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error: any) {
    console.error("Error in getUserBookings:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// @desc  Cancel a booking (soft-cancel — sets status to "cancelled")
// PATCH /api/bookings/:id/cancel
// @access Customer (own booking) | Owner (of the restaurant) | Admin
export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const booking = await Booking.findById(id).populate("restaurant");

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    const isCustomer = booking.user.toString() === req.user._id.toString();
    const isAdmin    = req.user.role === "admin";

    // Check if the logged-in user is the owner of the restaurant for this booking
    const restaurant = await Restaurant.findById(booking.restaurant);
    const isRestaurantOwner =
      restaurant?.owner.toString() === req.user._id.toString();

    if (!isCustomer && !isRestaurantOwner && !isAdmin) {
      res.status(403).json({ message: "Not authorised to cancel this booking" });
      return;
    }

    // Prevent cancelling an already-cancelled booking
    if (booking.status === "cancelled") {
      res.status(400).json({ message: "Booking is already cancelled" });
      return;
    }

    booking.status = "cancelled";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error: any) {
    console.error("Error in cancelBooking:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// ─── OWNER ROUTES ────────────────────────────────────────────────────────────

// @desc  Get all bookings for a specific restaurant (owner view)
// GET   /api/bookings/restaurant/:restaurantId
// @access Owner
export const getRestaurantBookings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const { restaurantId } = req.params;
    const { status, date } = req.query;

    // Verify the restaurant exists and belongs to this owner (admins bypass)
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    if (
      restaurant.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(403).json({ message: "Not authorised to view this restaurant's bookings" });
      return;
    }

    // Build optional filters
    const filter: Record<string, any> = { restaurant: restaurantId };

    if (status && ["pending", "confirmed", "cancelled"].includes(status as string)) {
      filter.status = status;
    }

    if (date && typeof date === "string") {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: dayStart, $lte: dayEnd };
    }

    const bookings = await Booking.find(filter)
      .populate("user", "name email phone")
      .sort({ date: 1, timeSlot: 1 }); // chronological order

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error: any) {
    console.error("Error in getRestaurantBookings:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// @desc  Confirm a pending booking
// PATCH /api/bookings/:id/confirm
// @access Owner
export const confirmBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    // Verify the logged-in user owns the restaurant for this booking
    const restaurant = await Restaurant.findById(booking.restaurant);
    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    if (
      restaurant.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(403).json({ message: "Not authorised to confirm this booking" });
      return;
    }

    // Can only confirm a pending booking
    if (booking.status !== "pending") {
      res.status(400).json({
        message: `Booking cannot be confirmed — current status is "${booking.status}"`,
      });
      return;
    }

    booking.status = "confirmed";
    await booking.save();

    await booking.populate("user", "name email");
    await booking.populate("restaurant", "name slug");

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      booking,
    });
  } catch (error: any) {
    console.error("Error in confirmBooking:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};


