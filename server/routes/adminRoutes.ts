import { Router } from "express";
import {
  getAllRestaurantsAdmin,
  updateRestaurantStatus,
  getAllBookingsAdmin,
  getAllUsers,
  getAdminStats,
} from "../controller/adminController.js";
import { protect, adminOnly } from "../middlewares/auth.js";

const router = Router();

// All admin routes are double-guarded: must be logged in AND have role "admin"
router.use(protect, adminOnly);

router.get("/stats", getAdminStats);                              // GET   /api/admin/stats
router.get("/restaurants", getAllRestaurantsAdmin);                // GET   /api/admin/restaurants
router.patch("/restaurants/:id/status", updateRestaurantStatus);  // PATCH /api/admin/restaurants/:id/status
router.get("/bookings", getAllBookingsAdmin);                      // GET   /api/admin/bookings
router.get("/users", getAllUsers);                                 // GET   /api/admin/users

export default router;
