import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import bcrypt from "bcrypt";

// healper to ganarete token
const generateToken = async (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

// Create a new user account
// POST /api/auth/register
const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone || !role) {
      res.status(400).json({ message: "Please enter all required fields" });
      return;
    }

    // check if user already exist
    const userExist = await User.findOne({ email });
    if (userExist) {
      res.status(400).json({ message: "User already exist" });
      return;
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error: any) {
    console.error("Error in registerUser:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Verify user credentials & generate JWT
// POST /api/auth/login
const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
  } catch (error) {}
};

// Fetch current logged-in user data
// GET /api/auth/me
// @access Private
const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
  } catch (error) {}
};
