import { Router } from "express";
import {
  getRestaurant,
  getFeaturedRestaurant,
  getRestaurantBySlug,
  getRestaurantAvailability,
  getMyRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} from "../controller/restaurantController.js";
import { protect, ownerOnly } from "../middlewares/auth.js";

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.get("/", getRestaurant);                              // GET  /api/restaurants
router.get("/featured", getFeaturedRestaurant);              // GET  /api/restaurants/featured

// ─── Owner routes (must come before /:slug to avoid conflict) ─────────────────
router.get("/my", protect, ownerOnly, getMyRestaurants);     // GET  /api/restaurants/my
router.post("/", protect, ownerOnly, createRestaurant);      // POST /api/restaurants

// ─── Public routes with params ────────────────────────────────────────────────
router.get("/:slug", getRestaurantBySlug);                   // GET  /api/restaurants/:slug
router.get("/:id/availability", getRestaurantAvailability);  // GET  /api/restaurants/:id/availability

// ─── Owner routes with params ─────────────────────────────────────────────────
router.put("/:id", protect, ownerOnly, updateRestaurant);    // PUT  /api/restaurants/:id
router.delete("/:id", protect, ownerOnly, deleteRestaurant); // DELETE /api/restaurants/:id

export default router;
