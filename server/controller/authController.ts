import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import type { IUser } from "../models/User.js";
import type { AuthRequest } from "../middlewares/auth.js";

// Roles a visitor may choose when signing up.
// "admin" is intentionally excluded: admins are created with `npm run seed:admin`.
const REGISTRATION_ROLES = ["user", "owner"] as const;
type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MIN_PHONE_LENGTH = 6;

// helper to generate token
const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

// One shape for the user object on every auth response, so the client only
// ever has to deal with a single contract.
const publicUser = (user: IUser) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone ?? null,
  role: user.role,
});

// Mongoose validation failures are client mistakes, not server failures.
const validationMessage = (error: any): string => {
  const errors = error?.errors ? Object.values(error.errors) : [];
  const first = errors[0] as { message?: string } | undefined;
  return first?.message ?? "Invalid user data";
};

// Create a new user account
// POST /api/auth/register
const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const cleanName = typeof body.name === "string" ? body.name.trim() : "";
    const cleanEmail =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const cleanPhone =
      typeof body.phone === "string" ? body.phone.trim() : "";
    const requestedRole =
      typeof body.role === "string" ? body.role.trim().toLowerCase() : "user";

    if (!cleanName || !cleanEmail || typeof body.password !== "string" || !body.password) {
      res.status(400).json({ message: "Please enter all required fields" });
      return;
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      res.status(400).json({ message: "Please enter a valid email address" });
      return;
    }

    if (body.password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    if (cleanPhone && cleanPhone.length < MIN_PHONE_LENGTH) {
      res.status(400).json({
        message: `Phone number must be at least ${MIN_PHONE_LENGTH} characters`,
      });
      return;
    }

    if (!REGISTRATION_ROLES.includes(requestedRole as RegistrationRole)) {
      res.status(400).json({
        message: `role must be one of: ${REGISTRATION_ROLES.join(", ")}`,
      });
      return;
    }

    // check if user already exist
    const userExist = await User.findOne({ email: cleanEmail });
    if (userExist) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(body.password, salt);

    // Create new user
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: requestedRole as RegistrationRole,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      token: generateToken(user._id.toString()),
      user: publicUser(user),
    });
  } catch (error: any) {
    // Unique index can still be hit if two requests race past findOne()
    if (error?.code === 11000) {
      res.status(400).json({ message: "User already exists" });
      return;
    }
    if (error?.name === "ValidationError") {
      res.status(400).json({ message: validationMessage(error) });
      return;
    }
    console.error("Error in registerUser:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Verify user credentials & generate JWT
// POST /api/auth/login
const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      res.status(400).json({ message: "Please enter all required fields" });
      return;
    }

    // check for user
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // check if password match from hashed password
    const comparePassword = await bcrypt.compare(password, user.password || "");
    if (!comparePassword) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      token: generateToken(user._id.toString()),
      user: publicUser(user),
    });
  } catch (error: any) {
    console.error("Error in loginUser:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Fetch current logged-in user data
// GET /api/auth/me
// @access Private
const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    res.json({ success: true, user: publicUser(req.user) });
  } catch (error: any) {
    console.error("Error in getMe:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export { registerUser, loginUser, getMe };
