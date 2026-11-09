import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.js";
import { Restaurant } from "../models/Restaurant.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";
import { badRequest, notFound } from "../utils/AppError.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { cleanString, escapeRegex, firstString } from "../utils/text.js";

const RESTAURANT_STATUSES = ["pending", "approved", "rejected"] as const;
const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;
const USER_ROLES = ["user", "owner", "admin"] as const;

interface StatusCount {
  _id: string;
  count: number;
}

const countOf = (rows: StatusCount[], key: string): number =>
  rows.find((row) => row._id === key)?.count ?? 0;

const sumCounts = (rows: StatusCount[]): number =>
  rows.reduce((total, row) => total + row.count, 0);

// @desc  Get ALL restaurants regardless of status (pending / approved / rejected)
// GET   /api/admin/restaurants?status=pending&page=1&limit=20
// @access Admin
export const getAllRestaurantsAdmin = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const status = firstString(req.query.status);
  const filter: Record<string, unknown> = {};

  if (status && RESTAURANT_STATUSES.includes(status as (typeof RESTAURANT_STATUSES)[number])) {
    filter.status = status;
  }

  const pagination = parsePagination(req.query as Record<string, unknown>);

  const [restaurants, total] = await Promise.all([
    Restaurant.find(filter)
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Restaurant.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: restaurants.length,
    ...paginationMeta(total, pagination),
    restaurants,
  });
};

// @desc  Approve or reject a restaurant listing
// PATCH /api/admin/restaurants/:id/status
// body  { status: "approved" | "rejected" }
// @access Admin
export const updateRestaurantStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const status = cleanString(req.body?.status);

  if (!["approved", "rejected"].includes(status)) {
    throw badRequest('status must be "approved" or "rejected"');
  }

  const restaurant = await Restaurant.findById(id);
  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  restaurant.status = status as "approved" | "rejected";
  await restaurant.save();

  res.status(200).json({
    success: true,
    message: `Restaurant ${status} successfully`,
    restaurant,
  });
};

// @desc  Get ALL bookings across all restaurants
// GET   /api/admin/bookings?status=confirmed&page=1&limit=20
// @access Admin
export const getAllBookingsAdmin = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const status = firstString(req.query.status);
  const filter: Record<string, unknown> = {};

  if (status && BOOKING_STATUSES.includes(status as (typeof BOOKING_STATUSES)[number])) {
    filter.status = status;
  }

  const pagination = parsePagination(req.query as Record<string, unknown>);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("restaurant", "name slug location")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
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

// @desc  Get ALL users
// GET   /api/admin/users?role=owner&search=ann&page=1&limit=20
// @access Admin
export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const role = firstString(req.query.role);
  const search = cleanString(firstString(req.query.search));
  const filter: Record<string, unknown> = {};

  if (role && USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
    filter.role = role;
  }

  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const pagination = parsePagination(req.query as Record<string, unknown>);

  // Never return passwords
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: users.length,
    ...paginationMeta(total, pagination),
    users,
  });
};

// @desc  Get platform-level stats for the admin dashboard
// GET   /api/admin/stats
// @access Admin
export const getAdminStats = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  // One aggregation per collection instead of six separate countDocuments calls,
  // and the newest bookings the dashboard table needs.
  const [restaurantRows, bookingRows, userRows, latestBookings] = await Promise.all([
    Restaurant.aggregate<StatusCount>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Booking.aggregate<StatusCount>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    User.aggregate<StatusCount>([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("restaurant", "name slug")
      .populate("user", "name email"),
  ]);

  const totalBookings = sumCounts(bookingRows);
  const pendingBookings = countOf(bookingRows, "pending");
  const confirmedBookings = countOf(bookingRows, "confirmed");

  res.status(200).json({
    success: true,
    stats: {
      users: {
        total: sumCounts(userRows),
        totalUsers: countOf(userRows, "user"),
        totalOwners: countOf(userRows, "owner"),
        totalAdmins: countOf(userRows, "admin"),
      },
      restaurants: {
        total: sumCounts(restaurantRows),
        pending: countOf(restaurantRows, "pending"),
        approved: countOf(restaurantRows, "approved"),
        rejected: countOf(restaurantRows, "rejected"),
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: countOf(bookingRows, "completed"),
        cancelled: countOf(bookingRows, "cancelled"),
        active: pendingBookings + confirmedBookings,
      },
      latestBookings,
    },
  });
};
