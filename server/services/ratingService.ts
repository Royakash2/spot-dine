import { Types } from "mongoose";
import { Review } from "../models/Review.js";
import { Restaurant } from "../models/Restaurant.js";

export interface RatingSummary {
  rating: number;
  reviewCount: number;
}

// Restaurant.rating / reviewCount are derived from reviews, never set by hand.
// Called after a review is created or deleted so the denormalised values stay
// consistent with the reviews collection.
export const recalculateRestaurantRating = async (
  restaurantId: Types.ObjectId | string,
): Promise<RatingSummary> => {
  const id = new Types.ObjectId(String(restaurantId));

  const [summary] = await Review.aggregate<{ average: number; count: number }>([
    { $match: { restaurant: id } },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  // One decimal place, e.g. 4.7
  const rating = summary ? Math.round(summary.average * 10) / 10 : 0;
  const reviewCount = summary?.count ?? 0;

  await Restaurant.findByIdAndUpdate(id, { rating, reviewCount });

  return { rating, reviewCount };
};
