import { Router } from "express";
import {
  getRestaurant,
  getFeaturedRestaurant,
  getRestaurantBySlug,
  getRestaurantAvailability,
} from "../controller/restaurantController.js";

const router = Router();

// Public routes
router.get("/", getRestaurant);                          // GET /api/restaurants
router.get("/featured", getFeaturedRestaurant);          // GET /api/restaurants/featured
router.get("/:slug", getRestaurantBySlug);               // GET /api/restaurants/:slug
router.get("/:id/availability", getRestaurantAvailability); // GET /api/restaurants/:id/availability

export default router;
