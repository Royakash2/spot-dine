import type { Request, Response } from "express";
import { Types } from "mongoose";
import type { AuthRequest } from "../middlewares/auth.js";
import { Restaurant } from "../models/Restaurant.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { removeUploadedImage } from "../middlewares/upload.js";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/AppError.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import {
  cleanString,
  escapeRegex,
  firstString,
  firstStringArray,
  slugify,
  toPositiveInt,
  toStringArray,
} from "../utils/text.js";

const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"] as const;
type PriceRange = (typeof PRICE_RANGES)[number];

const DEFAULT_TOTAL_SEATS = 20;
const MAX_TOTAL_SEATS = 2000;
// Slot labels are 24-hour clock values, e.g. "18:30"
const SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const buildSlug = (name: string): string =>
  `${slugify(name) || "restaurant"}-${Date.now().toString(36)}`;

const parseSlots = (value: unknown): string[] => {
  const slots = toStringArray(value);
  const invalid = slots.filter((slot) => !SLOT_PATTERN.test(slot));
  if (invalid.length > 0) {
    throw badRequest(
      `availableSlots must use 24h HH:MM format (invalid: ${invalid.join(", ")})`,
    );
  }
  return slots;
};

const parsePriceRange = (value: unknown, fallback: PriceRange): PriceRange => {
  const priceRange = cleanString(value);
  if (!priceRange) return fallback;
  if (!PRICE_RANGES.includes(priceRange as PriceRange)) {
    throw badRequest(`priceRange must be one of: ${PRICE_RANGES.join(", ")}`);
  }
  return priceRange as PriceRange;
};

// get all restaurant with search and filter
// GET /api/restaurants?search=&location=&cuisine=&priceRange=&sort=&page=&limit=
// @access Public
export const getRestaurant = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const search = cleanString(firstString(req.query.search));
  const location = cleanString(firstString(req.query.location));
  const cuisines = firstStringArray(req.query.cuisine).map((c) => c.trim()).filter(Boolean);
  const prices = firstStringArray(req.query.priceRange).map((p) => p.trim()).filter(Boolean);
  const sort = firstString(req.query.sort);

  // Only admin-approved restaurants are ever public
  const filter: Record<string, unknown> = { status: "approved" };

  // Escape user input before it reaches $regex
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [
      { name: pattern },
      { cuisine: pattern },
      { tags: pattern },
      { description: pattern },
    ];
  }

  if (location) {
    filter.location = { $regex: escapeRegex(location), $options: "i" };
  }

  if (cuisines.length > 0) {
    // Partial, case-insensitive match so "Italian" also finds
    // "Italian & Mediterranean"
    filter.cuisine = { $in: cuisines.map((cuisine) => new RegExp(escapeRegex(cuisine), "i")) };
  }

  if (prices.length > 0) {
    filter.priceRange = { $in: prices };
  }

  const pagination = parsePagination(req.query as Record<string, unknown>);
  const restaurantsQuery = Restaurant.find(filter);

  if (sort === "price_low") {
    restaurantsQuery.sort({ priceRange: 1 });
  } else if (sort === "price_high") {
    restaurantsQuery.sort({ priceRange: -1 });
  } else if (sort === "rating") {
    restaurantsQuery.sort({ rating: -1, reviewCount: -1 });
  } else {
    restaurantsQuery.sort({ createdAt: -1 });
  }

  const [restaurants, total] = await Promise.all([
    restaurantsQuery.skip(pagination.skip).limit(pagination.limit),
    Restaurant.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: restaurants.length,
    ...paginationMeta(total, pagination),
    restaurants,
  });
};

// get featured restaurants for homepage / dashboard
// GET /api/restaurants/featured
// @access Public
export const getFeaturedRestaurant = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const restaurants = await Restaurant.find({
    status: "approved",
    featured: true,
  })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(6);

  res.status(200).json({
    success: true,
    count: restaurants.length,
    restaurants,
  });
};

// get a single restaurant by its slug
// GET /api/restaurants/:slug
// @access Public
export const getRestaurantBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const slug = firstString(req.params.slug);

  if (!slug) {
    throw badRequest("Invalid restaurant slug");
  }

  const restaurant = await Restaurant.findOne({
    slug,
    status: "approved",
  }).populate("owner", "name email");

  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  res.status(200).json({ success: true, restaurant });
};

// get time slot availability for a restaurant on a specific date
// GET /api/restaurants/:id/availability?date=2026-10-15&guests=2
// @access Public
export const getRestaurantAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = firstString(req.params.id);
  const dateParam = firstString(req.query.date);

  if (!id || !Types.ObjectId.isValid(id)) {
    throw badRequest("Invalid restaurant ID");
  }

  if (!dateParam) {
    throw badRequest("date query param is required (e.g. ?date=2026-10-15)");
  }

  const requestedDate = new Date(dateParam);
  if (Number.isNaN(requestedDate.getTime())) {
    throw badRequest("Invalid date");
  }

  const requestedGuests = Number(firstString(req.query.guests) ?? 1);
  const guestCount = Number.isInteger(requestedGuests) && requestedGuests >= 1
    ? requestedGuests
    : 1;

  const restaurant = await Restaurant.findById(id);
  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  const dayStart = new Date(requestedDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(requestedDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Seats already booked per slot, in one DB round-trip
  const bookedPerSlot = await Booking.aggregate<{
    _id: string;
    bookedSeats: number;
  }>([
    {
      $match: {
        restaurant: restaurant._id,
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ["pending", "confirmed"] },
      },
    },
    {
      $group: {
        _id: "$timeSlot",
        bookedSeats: { $sum: "$guests" },
      },
    },
  ]);

  const bookedMap = new Map(
    bookedPerSlot.map(({ _id, bookedSeats }) => [_id, bookedSeats]),
  );

  const slots = restaurant.availableSlots.map((time) => {
    const alreadyBooked = bookedMap.get(time) ?? 0;
    const availableSeats = Math.max(0, restaurant.totalSeats - alreadyBooked);

    return {
      time,
      availableSeats,
      isAvailable: availableSeats >= guestCount,
    };
  });

  res.status(200).json({
    success: true,
    date: dateParam,
    totalSeats: restaurant.totalSeats,
    guests: guestCount,
    slots,
  });
};

// ─── OWNER ROUTES ────────────────────────────────────────────────────────────

// @desc  Get all restaurants owned by the logged-in owner
// GET   /api/restaurants/my
// @access Owner
export const getMyRestaurants = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.user) throw unauthorized();

  const restaurants = await Restaurant.find({ owner: req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: restaurants.length,
    restaurants,
  });
};

// @desc  Create a new restaurant listing (starts as "pending" until admin approves)
// POST  /api/restaurants
// @access Owner
export const createRestaurant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.user) throw unauthorized();

  const uploadedImage = req.fileUrl ?? "";

  try {
    const name = cleanString(req.body?.name);
    const description = cleanString(req.body?.description);
    const cuisine = cleanString(req.body?.cuisine);
    const location = cleanString(req.body?.location);
    const address = cleanString(req.body?.address);

    if (!name || !description || !cuisine || !location || !address) {
      throw badRequest(
        "name, description, cuisine, location and address are required",
      );
    }

    const priceRange = parsePriceRange(req.body?.priceRange, "$$");

    const seats = req.body?.totalSeats === undefined || req.body?.totalSeats === ""
      ? DEFAULT_TOTAL_SEATS
      : toPositiveInt(req.body.totalSeats);

    if (seats === null) {
      throw badRequest("totalSeats must be a whole number of at least 1");
    }

    if (seats > MAX_TOTAL_SEATS) {
      throw badRequest(`totalSeats cannot exceed ${MAX_TOTAL_SEATS}`);
    }

    const availableSlots = parseSlots(req.body?.availableSlots);
    if (availableSlots.length === 0) {
      throw badRequest("availableSlots must contain at least one time slot");
    }

    const restaurant = await Restaurant.create({
      name,
      slug: buildSlug(name),
      description,
      cuisine,
      priceRange,
      location,
      address,
      image: uploadedImage || cleanString(req.body?.image),
      chef: cleanString(req.body?.chef),
      tags: toStringArray(req.body?.tags),
      availableSlots,
      totalSeats: seats,
      featured: req.body?.featured === true,
      exclusive: req.body?.exclusive === true,
      owner: req.user._id,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message:
        "Restaurant submitted for review. It will go live once approved by an admin.",
      restaurant,
    });
  } catch (error) {
    // Never leave an orphaned upload behind when validation fails
    await removeUploadedImage(uploadedImage);
    throw error;
  }
};

// @desc  Update own restaurant details
// PUT   /api/restaurants/:id
// @access Owner
export const updateRestaurant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.user) throw unauthorized();

  const { id } = req.params;
  const restaurant = await Restaurant.findById(id);

  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  const isOwner = restaurant.owner.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") {
    throw forbidden("Not authorised to update this restaurant");
  }

  const body = req.body ?? {};

  try {
    if (body.totalSeats !== undefined) {
      const seats = toPositiveInt(body.totalSeats);
      if (seats === null) {
        throw badRequest("totalSeats must be a whole number of at least 1");
      }
      if (seats > MAX_TOTAL_SEATS) {
        throw badRequest(`totalSeats cannot exceed ${MAX_TOTAL_SEATS}`);
      }
      restaurant.totalSeats = seats;
    }

    // Only these fields are owner-editable; status stays admin-only.
    if (body.name !== undefined) {
      const name = cleanString(body.name);
      if (!name) throw badRequest("name cannot be empty");
      // Regenerating the slug on every save would break shared links, so only
      // do it when the name actually changed.
      if (name !== restaurant.name) {
        restaurant.name = name;
        restaurant.slug = buildSlug(name);
      }
    }

    if (body.description !== undefined) {
      const description = cleanString(body.description);
      if (!description) throw badRequest("description cannot be empty");
      restaurant.description = description;
    }

    if (body.cuisine !== undefined) {
      const cuisine = cleanString(body.cuisine);
      if (!cuisine) throw badRequest("cuisine cannot be empty");
      restaurant.cuisine = cuisine;
    }

    if (body.priceRange !== undefined) {
      restaurant.priceRange = parsePriceRange(body.priceRange, restaurant.priceRange);
    }

    if (body.location !== undefined) {
      const location = cleanString(body.location);
      if (!location) throw badRequest("location cannot be empty");
      restaurant.location = location;
    }

    if (body.address !== undefined) {
      const address = cleanString(body.address);
      if (!address) throw badRequest("address cannot be empty");
      restaurant.address = address;
    }

    if (body.chef !== undefined) {
      restaurant.chef = cleanString(body.chef);
    }

    if (body.tags !== undefined) {
      restaurant.tags = toStringArray(body.tags);
    }

    if (body.availableSlots !== undefined) {
      const availableSlots = parseSlots(body.availableSlots);
      if (availableSlots.length === 0) {
        throw badRequest("availableSlots must contain at least one time slot");
      }
      restaurant.availableSlots = availableSlots;
    }
  } catch (error) {
    await removeUploadedImage(req.fileUrl);
    throw error;
  }

  const previousImage = restaurant.image;

  // A new upload replaces the stored image; otherwise keep the existing one
  if (req.file) {
    restaurant.image = req.fileUrl ?? restaurant.image;
  } else if (typeof body.image === "string" && body.image.trim()) {
    restaurant.image = body.image.trim();
  }

  await restaurant.save();

  // The replacement is stored, so the old image is safe to delete
  if (req.file && previousImage !== restaurant.image) {
    await removeUploadedImage(previousImage);
  }

  res.status(200).json({
    success: true,
    message: "Restaurant updated successfully",
    restaurant,
  });
};

// @desc  Delete own restaurant (and its bookings/reviews)
// DELETE /api/restaurants/:id
// @access Owner
export const deleteRestaurant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.user) throw unauthorized();

  const { id } = req.params;
  const restaurant = await Restaurant.findById(id);

  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  const isOwner = restaurant.owner.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") {
    throw forbidden("Not authorised to delete this restaurant");
  }

  // Deleting a venue removes everything that cannot exist without it, so the
  // database is left with no bookings or reviews pointing at a missing venue.
  await Promise.all([
    Booking.deleteMany({ restaurant: restaurant._id }),
    Review.deleteMany({ restaurant: restaurant._id }),
  ]);

  const imageUrl = restaurant.image;
  await restaurant.deleteOne();
  await removeUploadedImage(imageUrl);

  res.status(200).json({
    success: true,
    message: "Restaurant deleted successfully",
  });
};
