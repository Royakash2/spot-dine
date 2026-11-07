import { Document, model, Schema, Types } from "mongoose";

export interface IReview extends Document {
  restaurant: Types.ObjectId;
  user: Types.ObjectId;
  // One review per booking keeps the rating honest and idempotent.
  booking: Types.ObjectId;
  rating: number;
  comment: string;
  visitedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    visitedDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Feed queries: "latest reviews for restaurant X"
ReviewSchema.index({ restaurant: 1, createdAt: -1 });

export const Review = model<IReview>("Review", ReviewSchema);

export default Review;
