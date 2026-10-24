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


