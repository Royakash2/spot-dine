import { Router } from "express";
import { registerUser, loginUser, getMe } from "../controller/authController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);

export default router;