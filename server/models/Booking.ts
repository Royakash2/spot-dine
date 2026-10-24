import { Document, model, Schema, Types } from "mongoose";

export interface IBooking extends Document {
  restaurant: Types.ObjectId;
  user: Types.ObjectId;
  date: Date;
  timeSlot: string;
  guests: number;
  status: "pending" | "confirmed" | "cancelled";
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
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
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    specialRequests: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast availability queries:
// "for restaurant X, on date Y, across all time slots"
BookingSchema.index({ restaurant: 1, date: 1, timeSlot: 1 });

// Index for fast user booking history lookups
BookingSchema.index({ user: 1, date: -1 });

export const Booking = model<IBooking>("Booking", BookingSchema);

export default Booking;
