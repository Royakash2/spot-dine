import type { Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.js";
import { Restaurant } from "../models/Restaurant.js";
import { Booking } from "../models/Booking.js";

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

    // --- 4. Aggregate booked seats per time slot in one DB round-trip ---
    const bookedPerSlot = await Booking.aggregate<{
      _id: string;
      bookedSeats: number;
    }>([
      {
        $match: {
          restaurant: restaurant._id,
          date: { $gte: dayStart, $lte: dayEnd },
          status: { $in: ["pending", "confirmed"] }, // exclude cancelled
        },
      },
      {
        $group: {
          _id: "$timeSlot",           // group by time slot
          bookedSeats: { $sum: "$guests" },
        },
      },
    ]);

    // Turn the aggregation result into a quick lookup map: { "7:00 PM": 8, ... }
    const bookedMap = new Map(
      bookedPerSlot.map(({ _id, bookedSeats }) => [_id, bookedSeats]),
    );

    // Build the slot list with real remaining capacity
    const slots = restaurant.availableSlots.map((time) => {
      const alreadyBooked = bookedMap.get(time) ?? 0;
      const availableSeats = restaurant.totalSeats - alreadyBooked;
      return {
        time,
        availableSeats,
        isAvailable: availableSeats >= guestCount,
      };
    });

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

// ─── OWNER ROUTES ────────────────────────────────────────────────────────────

// @desc  Get all restaurants owned by the logged-in owner
// GET   /api/restaurants/my
// @access Owner
export const getMyRestaurants = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const restaurants = await Restaurant.find({ owner: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch (error: any) {
    console.error("Error in getMyRestaurants:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// @desc  Create a new restaurant listing (starts as "pending" until admin approves)
// POST  /api/restaurants
// @access Owner
export const createRestaurant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const {
      name,
      description,
      cuisine,
      priceRange,
      location,
      address,
      image,
      chef,
      tags,
      availableSlots,
      totalSeats,
      featured,
      exclusive,
    } = req.body;

    if (!name || !description || !cuisine || !location || !address) {
      res.status(400).json({
        message: "name, description, cuisine, location and address are required",
      });
      return;
    }

    // Auto-generate a URL-friendly slug from the restaurant name
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    // Append a short random suffix to keep slugs unique
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const restaurant = await Restaurant.create({
      name,
      slug,
      description,
      cuisine,
      priceRange: priceRange ?? "$$",
      location,
      address,
      image: image ?? "",
      chef: chef ?? "",
      tags: tags ?? [],
      availableSlots: availableSlots ?? [],
      totalSeats: totalSeats ?? 20,
      featured: featured ?? false,
      exclusive: exclusive ?? false,
      owner: req.user._id,
      status: "pending", // admin must approve before it goes live
    });

    res.status(201).json({
      success: true,
      message: "Restaurant submitted for review. It will go live once approved by an admin.",
      restaurant,
    });
  } catch (error: any) {
    console.error("Error in createRestaurant:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// @desc  Update own restaurant details
// PUT   /api/restaurants/:id
// @access Owner
export const updateRestaurant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    // Only the owner (or an admin) can update it
    if (
      restaurant.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(403).json({ message: "Not authorised to update this restaurant" });
      return;
    }

    // Fields that owners are allowed to update
    // (status is intentionally excluded — only admins change that)
    const allowedFields = [
      "name",
      "description",
      "cuisine",
      "priceRange",
      "location",
      "address",
      "image",
      "chef",
      "tags",
      "availableSlots",
      "totalSeats",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (restaurant as any)[field] = req.body[field];
      }
    });

    // If the name changed, regenerate the slug
    if (req.body.name) {
      const baseSlug = req.body.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      restaurant.slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    await restaurant.save();

    res.status(200).json({
      success: true,
      message: "Restaurant updated successfully",
      restaurant,
    });
  } catch (error: any) {
    console.error("Error in updateRestaurant:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// @desc  Delete own restaurant
// DELETE /api/restaurants/:id
// @access Owner
export const deleteRestaurant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorised" });
      return;
    }

    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    // Only the owner (or an admin) can delete it
    if (
      restaurant.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(403).json({ message: "Not authorised to delete this restaurant" });
      return;
    }

    await restaurant.deleteOne();

    res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteRestaurant:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};
