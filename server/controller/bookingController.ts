import type { Response } from "express";
import { Types } from "mongoose";
import type { AuthRequest } from "../middlewares/auth.js";
import { Booking, generateBookingId } from "../models/Booking.js";
import { Restaurant } from "../models/Restaurant.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../utils/AppError.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { cleanString, firstString } from "../utils/text.js";

const SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_GUESTS_PER_BOOKING = 20;

// Booking dates are stored as calendar dates normalised to UTC midnight, so
// "today" and slot times are compared in UTC. When restaurants get their own
// timezone field, this helper is the only place that needs to change.
const isSlotInThePast = (dayStart: Date, timeSlot: string): boolean => {
  const match = SLOT_PATTERN.exec(timeSlot);
  if (!match) return false;

  const slotMoment = new Date(dayStart.getTime());
  slotMoment.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);

  return slotMoment.getTime() <= Date.now();
};

const startOfUtcDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const endOfUtcDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
};

// @desc  Create a new booking
// POST /api/bookings
// @access Private
export const createBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const body = req.body ?? {};
  const restaurantId = cleanString(body.restaurantId);
  const dateParam = cleanString(body.date);
  const timeSlot = cleanString(body.timeSlot);
  const guests = Number(body.guests);

  // --- 1. Validate required fields ---
  if (!restaurantId || !dateParam || !timeSlot || body.guests === undefined || body.guests === "") {
    throw badRequest("restaurantId, date, timeSlot, and guests are required");
  }

  if (!Types.ObjectId.isValid(restaurantId)) {
    throw badRequest("Invalid restaurantId");
  }

  if (!SLOT_PATTERN.test(timeSlot)) {
    throw badRequest("timeSlot must be a 24h HH:MM value");
  }

  if (!Number.isInteger(guests) || guests < 1) {
    throw badRequest("guests must be a whole number of at least 1");
  }

  if (guests > MAX_GUESTS_PER_BOOKING) {
    throw badRequest(
      `guests cannot exceed ${MAX_GUESTS_PER_BOOKING}. Please contact the restaurant for larger parties.`,
    );
  }

  const requestedDate = new Date(dateParam);
  if (Number.isNaN(requestedDate.getTime())) {
    throw badRequest("Invalid booking date");
  }

  const dayStart = startOfUtcDay(requestedDate);
  const dayEnd = endOfUtcDay(requestedDate);
  const todayStart = startOfUtcDay(new Date());

  if (dayStart < todayStart) {
    throw badRequest("Cannot book a date in the past");
  }

  if (isSlotInThePast(dayStart, timeSlot)) {
    throw badRequest(`The ${timeSlot} slot has already passed for this date`);
  }

  // --- 2. Confirm the restaurant exists and is approved ---
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    status: "approved",
  });

  if (!restaurant) {
    throw notFound("Restaurant not found or not available");
  }

  // --- 3. Check the requested time slot is actually offered ---
  if (!restaurant.availableSlots.includes(timeSlot)) {
    throw badRequest(`Time slot "${timeSlot}" is not offered by this restaurant`);
  }

  // --- 4. Reject a duplicate active booking (double-click / refresh) ---
  const duplicate = await Booking.exists({
    user: user._id,
    restaurant: restaurant._id,
    date: { $gte: dayStart, $lte: dayEnd },
    timeSlot,
    status: { $in: ["pending", "confirmed"] },
  });

  if (duplicate) {
    throw conflict("You already have a booking at this restaurant for this time");
  }

  // --- 5. Count already-booked seats for this slot on this date ---
  const bookedSeatsResult = await Booking.aggregate<{ totalBooked: number }>([
    {
      $match: {
        restaurant: restaurant._id,
        timeSlot,
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ["pending", "confirmed"] },
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
  const availableSeats = Math.max(0, restaurant.totalSeats - alreadyBooked);

  if (guests > availableSeats) {
    throw conflict(
      `Not enough seats. Only ${availableSeats} seat(s) available for this slot.`,
      { availableSeats },
    );
  }

  // --- 6. Create the booking ---
  const booking = await Booking.create({
    bookingId: generateBookingId(),
    restaurant: restaurant._id,
    user: user._id,
    date: requestedDate,
    timeSlot,
    guests,
    occasion: cleanString(body.occasion),
    // Snapshot of the guest details, so the record survives account deletion
    guestName: cleanString(body.name) || user.name,
    guestEmail: cleanString(body.email).toLowerCase() || user.email,
    guestPhone: cleanString(body.phone) || user.phone || "",
    specialRequests: cleanString(body.specialRequests),
    status: "pending",
  });

  await booking.populate("restaurant", "name slug location");
  await booking.populate("user", "name email");

  res.status(201).json({
    success: true,
    message: "Booking created successfully",
    booking,
  });
};

// @desc  Get all bookings for the logged-in user
// GET /api/bookings/my
// @access Private
export const getUserBookings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const bookings = await Booking.find({ user: user._id })
    .populate("restaurant", "name slug location image cuisine priceRange")
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: bookings.length,
    bookings,
  });
};

// @desc  Cancel a booking (soft-cancel — sets status to "cancelled")
// PATCH /api/bookings/:id/cancel
// @access Customer (own booking) | Owner (of the restaurant) | Admin
export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const id = firstString(req.params.id);
  if (!id || !Types.ObjectId.isValid(id)) {
    throw badRequest("Invalid booking id");
  }

  const booking = await Booking.findById(id);

  if (!booking) {
    throw notFound("Booking not found");
  }

  const isCustomer = booking.user.toString() === user._id.toString();
  const isAdmin = user.role === "admin";

  const restaurant = await Restaurant.findById(booking.restaurant);
  const isRestaurantOwner = restaurant?.owner.toString() === user._id.toString();

  if (!isCustomer && !isRestaurantOwner && !isAdmin) {
    throw forbidden("Not authorised to cancel this booking");
  }

  if (booking.status === "cancelled") {
    throw badRequest("Booking is already cancelled");
  }

  if (booking.status === "completed") {
    throw badRequest("Completed bookings cannot be cancelled");
  }

  booking.status = "cancelled";
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Booking cancelled successfully",
    booking,
  });
};

// ─── OWNER ROUTES ────────────────────────────────────────────────────────────

// @desc  Get all bookings for a specific restaurant (owner view)
// GET   /api/bookings/restaurant/:restaurantId?status=&date=&page=&limit=
// @access Owner
export const getRestaurantBookings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const restaurantId = firstString(req.params.restaurantId);
  const status = firstString(req.query.status);
  const date = firstString(req.query.date);

  if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
    throw badRequest("Invalid restaurant id");
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  const isOwner = restaurant.owner.toString() === user._id.toString();
  if (!isOwner && user.role !== "admin") {
    throw forbidden("Not authorised to view this restaurant's bookings");
  }

  const filter: Record<string, unknown> = { restaurant: restaurant._id };

  if (status && ["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    filter.status = status;
  }

  if (date) {
    const requestedDate = new Date(date);
    if (Number.isNaN(requestedDate.getTime())) {
      throw badRequest("Invalid date filter");
    }
    filter.date = {
      $gte: startOfUtcDay(requestedDate),
      $lte: endOfUtcDay(requestedDate),
    };
  }

  const pagination = parsePagination(req.query as Record<string, unknown>, 50);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("user", "name email phone")
      .sort({ date: 1, timeSlot: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: bookings.length,
    ...paginationMeta(total, pagination),
    bookings,
  });
};

// @desc  Confirm a pending booking
// PATCH /api/bookings/:id/confirm
// @access Owner
export const confirmBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  await changeBookingStatus(req, res, {
    from: "pending",
    to: "confirmed",
    message: "Booking confirmed successfully",
  });
};

// @desc  Mark a confirmed booking as completed (guest has dined)
// PATCH /api/bookings/:id/complete
// @access Owner (of the restaurant) | Admin
export const completeBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  await changeBookingStatus(req, res, {
    from: "confirmed",
    to: "completed",
    message: "Booking marked as completed",
  });
};

// Shared owner-side status transition: same ownership check, same response shape.
const changeBookingStatus = async (
  req: AuthRequest,
  res: Response,
  transition: {
    from: "pending" | "confirmed";
    to: "confirmed" | "completed";
    message: string;
  },
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const id = firstString(req.params.id);
  if (!id || !Types.ObjectId.isValid(id)) {
    throw badRequest("Invalid booking id");
  }

  const booking = await Booking.findById(id);

  if (!booking) {
    throw notFound("Booking not found");
  }

  const restaurant = await Restaurant.findById(booking.restaurant);
  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  const isOwner = restaurant.owner.toString() === user._id.toString();
  if (!isOwner && user.role !== "admin") {
    throw forbidden(`Not authorised to ${transition.to} this booking`);
  }

  if (booking.status !== transition.from) {
    throw badRequest(
      `Booking cannot be ${transition.to} — current status is "${booking.status}"`,
    );
  }

  booking.status = transition.to;
  await booking.save();

  await booking.populate("user", "name email");
  await booking.populate("restaurant", "name slug");

  res.status(200).json({
    success: true,
    message: transition.message,
    booking,
  });
};
