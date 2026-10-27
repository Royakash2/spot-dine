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

// @desc  Approve or reject a restaurant listing
// PATCH /api/admin/restaurants/:id/status
// body  { status: "approved" | "rejected" }
// @access Admin
export const updateRestaurantStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      res.status(400).json({ message: 'status must be "approved" or "rejected"' });
      return;
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    restaurant.status = status;
    await restaurant.save();

    res.status(200).json({
      success: true,
      message: `Restaurant ${status} successfully`,
      restaurant,
    });
  } catch (error: any) {
    console.error("Error in updateRestaurantStatus:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

