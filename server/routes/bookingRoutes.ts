import { Router } from "express";
import {
  createBooking,
  getUserBookings,
  cancelBooking,
  getRestaurantBookings,
  confirmBooking,
} from "../controller/bookingController.js";
import { protect, ownerOnly } from "../middlewares/auth.js";

const router = Router();

// ─── Customer routes ──────────────────────────────────────────────────────────
router.post("/", protect, createBooking);                        // POST  /api/bookings
router.get("/my", protect, getUserBookings);                     // GET   /api/bookings/my

// ─── Owner routes (before /:id to avoid route conflicts) ──────────────────────
router.get("/restaurant/:restaurantId", protect, ownerOnly, getRestaurantBookings); // GET   /api/bookings/restaurant/:restaurantId

// ─── Shared param routes ──────────────────────────────────────────────────────
router.patch("/:id/confirm", protect, ownerOnly, confirmBooking); // PATCH /api/bookings/:id/confirm
router.patch("/:id/cancel", protect, cancelBooking);              // PATCH /api/bookings/:id/cancel

export default router;
