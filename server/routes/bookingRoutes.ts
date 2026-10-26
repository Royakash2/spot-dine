import { Router } from "express";
import {
  createBooking,
  getUserBookings,
  cancelBooking,
} from "../controller/bookingController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

// All booking routes are private — user must be logged in
router.post("/", protect, createBooking);                    // POST   /api/bookings
router.get("/my", protect, getUserBookings);                 // GET    /api/bookings/my
router.patch("/:id/cancel", protect, cancelBooking);         // PATCH  /api/bookings/:id/cancel

export default router;
