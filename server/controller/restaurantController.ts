import type { Request, Response } from "express";
import { Restaurant } from "../models/Restaurant.js";

// get all restaurant with search and filter
// GET /api/restaurants
// @access Public
export const getRestaurant = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { search, location, cuisine, priceRange, sort } = req.query;

    // Base filter: only return admin-approved restaurants
    const filter: Record<string, any> = { status: "approved" };

    // Search by name, cuisine, or tags (case-insensitive)
    if (search) {
      filter.$or = [
        { name: { $regex: search as string, $options: "i" } },
        { cuisine: { $regex: search as string, $options: "i" } },
        { tags: { $regex: search as string, $options: "i" } },
      ];
    }

    // Filter by location (city) - partial match
    if (location) {
      filter.location = { $regex: location as string, $options: "i" };
    }

    // Filter by cuisine - supports multiple values e.g. ?cuisine=Italian&cuisine=French
    if (cuisine) {
      const cuisineList = Array.isArray(cuisine) ? cuisine : [cuisine];
      filter.cuisine = { $in: cuisineList };
    }

    // Filter by price range - supports multiple values e.g. ?priceRange=$$&priceRange=$$$
    if (priceRange) {
      const priceList = Array.isArray(priceRange) ? priceRange : [priceRange];
      filter.priceRange = { $in: priceList };
    }

    // Sort logic
    let sortQuery: Record<string, 1 | -1> = { createdAt: -1 }; // default: newest first
    if (sort === "price_low") sortQuery = { priceRange: 1 };
    if (sort === "price_high") sortQuery = { priceRange: -1 };
    if (sort === "rating") sortQuery = { rating: -1 };

    const restaurants = await Restaurant.find(filter).sort(sortQuery);

    res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch (error: any) {
    console.error("Error in getRestaurant:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};
// get featured restaurants for homepage / dashboard
// GET /api/restaurants/featured
// @access Public
export const getFeaturedRestaurant = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const restaurants = await Restaurant.find({
      status: "approved",
      featured: true,
    })
      .sort({ rating: -1 }) // highest rated first
      .limit(6);            // only show top 6 on the homepage

    res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch (error: any) {
    console.error("Error in getFeaturedRestaurant:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};
// get a single restaurant by its slug
// GET /api/restaurants/:slug
// @access Public
export const getRestaurantBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { slug } = req.params;

    // Guard: ensure slug is a plain string (req.params can be string | string[] | undefined)
    if (!slug || typeof slug !== "string") {
      res.status(400).json({ message: "Invalid restaurant slug" });
      return;
    }

    const restaurant = await Restaurant.findOne({
      slug: slug,          // now TypeScript knows for sure it's a string
      status: "approved",
    }).populate("owner", "name email"); // attach owner name & email

    // if no restaurant found with that slug, return 404
    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error: any) {
    console.error("Error in getRestaurantBySlug:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};
// get time slot availability for a restaurant on a specific date
// GET /api/restaurants/:id/availability?date=2026-10-15&guests=2
// @access Public
export const getRestaurantAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, guests } = req.query;

    // --- 1. Validate inputs ---
    if (!id || typeof id !== "string") {
      res.status(400).json({ message: "Invalid restaurant ID" });
      return;
    }

    if (!date || typeof date !== "string") {
      res.status(400).json({ message: "date query param is required (e.g. ?date=2026-10-15)" });
      return;
    }

    const guestCount = parseInt(guests as string) || 1;

    // --- 2. Find the restaurant ---
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    // --- 3. Build start & end of the requested date (full day range) ---
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // --- 4. For each available slot, compute how many seats are already booked ---
    // (We'll wire up real Booking queries once the Booking model exists)
    // For now: all slots are open with full totalSeats capacity
    const slots = restaurant.availableSlots.map((time) => ({
      time,
      availableSeats: restaurant.totalSeats,
      isAvailable: restaurant.totalSeats >= guestCount,
    }));

    res.status(200).json({
      success: true,
      date,
      totalSeats: restaurant.totalSeats,
      slots,
    });
  } catch (error: any) {
    console.error("Error in getRestaurantAvailability:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};
