import { Document, model, Schema, Types } from "mongoose";
import { randomBytes } from "node:crypto";

export interface IBooking extends Document {
  bookingId: string;
  restaurant: Types.ObjectId;
  user: Types.ObjectId;
  date: Date;
  timeSlot: string;
  guests: number;
  occasion?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Human-readable confirmation code shown to diners, owners and admins
// e.g. "GR-71B448A7"
export const generateBookingId = (): string =>
  `GR-${randomBytes(4).toString("hex").toUpperCase()}`;

const BookingSchema = new Schema<IBooking>(
  {
    // sparse keeps the unique index buildable for pre-existing bookings,
    // which get a reference code backfilled on their next save
    bookingId: { type: String, required: true, unique: true, sparse: true, trim: true },
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
    occasion: {
      type: String,
      trim: true,
      default: "",
    },
    // Contact details as entered on the booking form (snapshot at booking time)
    guestName: { type: String, trim: true, default: "" },
    guestEmail: { type: String, trim: true, lowercase: true, default: "" },
    guestPhone: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
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

// Backfill a reference code on any document that predates the field, so older
// bookings can still be confirmed/cancelled without tripping validation.
BookingSchema.pre("validate", function () {
  if (!this.bookingId) {
    this.bookingId = generateBookingId();
  }
});

// Index for fast availability queries:
// "for restaurant X, on date Y, across all time slots"
BookingSchema.index({ restaurant: 1, date: 1, timeSlot: 1 });

// Index for fast user booking history lookups
BookingSchema.index({ user: 1, date: -1 });

// One active booking per diner, venue, date and slot. Enforced by the database
// so a double-click or retried request cannot create two reservations.
// Cancelled/completed bookings are excluded, so a slot frees up again.
BookingSchema.index(
  { user: 1, restaurant: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "confirmed"] } },
  },
);

// Admin dashboards: "latest bookings" and status filters
BookingSchema.index({ status: 1, createdAt: -1 });

export const Booking = model<IBooking>("Booking", BookingSchema);

export default Booking;
