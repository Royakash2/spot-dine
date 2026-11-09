import { Router } from "express";
import {
  changePassword,
  getMe,
  loginUser,
  registerUser,
  updateProfile,
} from "../controller/authController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/register", registerUser);                    // POST  /api/auth/register
router.post("/login", loginUser);                          // POST  /api/auth/login
router.get("/me", protect, getMe);                         // GET   /api/auth/me
router.patch("/me", protect, updateProfile);               // PATCH /api/auth/me
router.patch("/me/password", protect, changePassword);     // PATCH /api/auth/me/password

export default router;
