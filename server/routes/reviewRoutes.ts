import { Router } from "express";
import {
  createReview,
  deleteReview,
  getRestaurantReviews,
} from "../controller/reviewController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.get("/", getRestaurantReviews);                 // GET    /api/reviews?restaurant=<id|slug>
router.post("/", protect, createReview);              // POST   /api/reviews
router.delete("/:id", protect, deleteReview);        // DELETE /api/reviews/:id

export default router;
