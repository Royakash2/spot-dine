import type { Response } from "express";
import { Types } from "mongoose";
import type { AuthRequest } from "../middlewares/auth.js";
import { Booking } from "../models/Booking.js";
import { Restaurant } from "../models/Restaurant.js";
import { Review } from "../models/Review.js";
import { recalculateRestaurantRating } from "../services/ratingService.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../utils/AppError.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { cleanString, firstString } from "../utils/text.js";

const MAX_COMMENT_LENGTH = 1000;

// Accepts either a Mongo id or a public slug, so the client can call this with
// whatever it already has on the page.
const resolveRestaurant = async (reference: string) => {
  const query = Types.ObjectId.isValid(reference)
    ? { _id: reference }
    : { slug: reference };

  const restaurant = await Restaurant.findOne(query).select(
    "_id rating reviewCount",
  );

  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  return restaurant;
};

// @desc  List reviews for a restaurant (newest first)
// GET   /api/reviews?restaurant=<id|slug>&page=1&limit=20
// @access Public
export const getRestaurantReviews = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const reference =
    firstString(req.query.restaurant) ?? firstString(req.params.restaurantId);

  if (!reference) {
    throw badRequest("restaurant query param is required (id or slug)");
  }

  const restaurant = await resolveRestaurant(reference);
  const pagination = parsePagination(req.query as Record<string, unknown>);

  const [reviews, total] = await Promise.all([
    Review.find({ restaurant: restaurant._id })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Review.countDocuments({ restaurant: restaurant._id }),
  ]);

  res.status(200).json({
    success: true,
    count: reviews.length,
    rating: restaurant.rating,
    reviewCount: restaurant.reviewCount,
    ...paginationMeta(total, pagination),
    reviews,
  });
};

// @desc  Review a completed booking
// POST  /api/reviews
// body  { bookingId } | { restaurantId }  plus { rating, comment? }
// @access Private
export const createReview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const { rating, comment, bookingId, restaurantId } = req.body ?? {};

  const ratingValue = Number(rating);
  if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    throw badRequest("rating must be a whole number from 1 to 5");
  }

  const cleanComment = cleanString(comment);
  if (cleanComment.length > MAX_COMMENT_LENGTH) {
    throw badRequest(`comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }

  let booking;

  if (typeof bookingId === "string" && bookingId.trim()) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw badRequest("Invalid booking id");
    }
    booking = await Booking.findById(bookingId);
  } else if (typeof restaurantId === "string" && restaurantId.trim()) {
    if (!Types.ObjectId.isValid(restaurantId)) {
      throw badRequest("Invalid restaurant id");
    }
    // Fall back to the diner's most recent completed visit
    booking = await Booking.findOne({
      user: user._id,
      restaurant: restaurantId,
      status: "completed",
    }).sort({ date: -1 });
  } else {
    throw badRequest("bookingId or restaurantId is required");
  }

  if (!booking) {
    throw notFound("No completed booking found to review");
  }

  if (booking.user.toString() !== user._id.toString()) {
    throw forbidden("You can only review your own bookings");
  }

  if (booking.status !== "completed") {
    throw badRequest("Only completed bookings can be reviewed");
  }

  const existingReview = await Review.findOne({ booking: booking._id });
  if (existingReview) {
    throw conflict("This booking has already been reviewed");
  }

  const review = await Review.create({
    restaurant: booking.restaurant,
    user: user._id,
    booking: booking._id,
    rating: ratingValue,
    comment: cleanComment,
    visitedDate: booking.date,
  });

  const summary = await recalculateRestaurantRating(booking.restaurant);
  await review.populate("user", "name");

  res.status(201).json({
    success: true,
    message: "Review submitted successfully",
    ...summary,
    review,
  });
};

// @desc  Delete a review (author or admin)
// DELETE /api/reviews/:id
// @access Private
export const deleteReview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) throw unauthorized();

  const id = firstString(req.params.id);
  if (!id || !Types.ObjectId.isValid(id)) {
    throw badRequest("Invalid review id");
  }

  const review = await Review.findById(id);
  if (!review) {
    throw notFound("Review not found");
  }

  const isAuthor = review.user.toString() === user._id.toString();
  const isAdmin = user.role === "admin";

  if (!isAuthor && !isAdmin) {
    throw forbidden("Not authorised to delete this review");
  }

  const { restaurant } = review;
  await review.deleteOne();
  const summary = await recalculateRestaurantRating(restaurant);

  res.status(200).json({
    success: true,
    message: "Review deleted successfully",
    ...summary,
  });
};
