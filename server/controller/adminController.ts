import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.js";
import { Restaurant } from "../models/Restaurant.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";

// @desc  Get ALL restaurants regardless of status (pending / approved / rejected)
// GET   /api/admin/restaurants
// @access Admin
export const getAllRestaurantsAdmin = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { status } = req.query;

    // Optionally filter by status: ?status=pending
    const filter: Record<string, any> = {};
    if (status && ["pending", "approved", "rejected"].includes(status as string)) {
      filter.status = status;
    }

    const restaurants = await Restaurant.find(filter)
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch (error: any) {
    console.error("Error in getAllRestaurantsAdmin:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};


