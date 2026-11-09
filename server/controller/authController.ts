import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import type { IUser } from "../models/User.js";
import type { AuthRequest } from "../middlewares/auth.js";
import { badRequest, notFound, unauthorized } from "../utils/AppError.js";
import { cleanString } from "../utils/text.js";

// Roles a visitor may choose when signing up.
// "admin" is intentionally excluded: admins are created with `npm run seed:admin`.
const REGISTRATION_ROLES = ["user", "owner"] as const;
type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MIN_PHONE_LENGTH = 6;
const MAX_NAME_LENGTH = 80;

const generateToken = (id: string): string =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: "30d" });

// One shape for the user object on every auth response, so the client only
// ever has to deal with a single contract.
const publicUser = (user: IUser) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone ?? null,
  role: user.role,
});

// Create a new user account
// POST /api/auth/register
const registerUser = async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};

  const name = cleanString(body.name);
  const email = cleanString(body.email).toLowerCase();
  const phone = cleanString(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  const requestedRole = cleanString(body.role).toLowerCase() || "user";

  if (!name || !email || !password) {
    throw badRequest("Please enter all required fields");
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest(`name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }

  if (!EMAIL_REGEX.test(email)) {
    throw badRequest("Please enter a valid email address");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (phone && phone.length < MIN_PHONE_LENGTH) {
    throw badRequest(`Phone number must be at least ${MIN_PHONE_LENGTH} characters`);
  }

  if (!REGISTRATION_ROLES.includes(requestedRole as RegistrationRole)) {
    throw badRequest(`role must be one of: ${REGISTRATION_ROLES.join(", ")}`);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw badRequest("User already exists");
  }

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role: requestedRole as RegistrationRole,
    ...(phone ? { phone } : {}),
  }).catch((error: unknown) => {
    // The unique index can still be hit if two requests race past findOne()
    if ((error as { code?: number })?.code === 11000) {
      throw badRequest("User already exists");
    }
    throw error;
  });

  res.status(201).json({
    success: true,
    message: "User created successfully",
    token: generateToken(user._id.toString()),
    user: publicUser(user),
  });
};

// Verify user credentials & generate JWT
// POST /api/auth/login
const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    throw badRequest("Please enter all required fields");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.password) {
    throw unauthorized("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw unauthorized("Invalid email or password");
  }

  res.status(200).json({
    success: true,
    message: "User logged in successfully",
    token: generateToken(user._id.toString()),
    user: publicUser(user),
  });
};

// Fetch current logged-in user data
// GET /api/auth/me
// @access Private
const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw unauthorized();
  }

  res.status(200).json({ success: true, user: publicUser(req.user) });
};

// Update the logged-in user's own profile
// PATCH /api/auth/me
// body  { name?, phone? }   (send phone: "" to clear it)
// @access Private
const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw unauthorized();
  }

  const body = req.body ?? {};
  const nextName = body.name === undefined ? undefined : cleanString(body.name);
  const nextPhone = body.phone === undefined ? undefined : cleanString(body.phone);

  if (nextName === undefined && nextPhone === undefined) {
    throw badRequest("Provide at least one field to update: name or phone");
  }

  if (nextName !== undefined) {
    if (!nextName) throw badRequest("name cannot be empty");
    if (nextName.length > MAX_NAME_LENGTH) {
      throw badRequest(`name must be ${MAX_NAME_LENGTH} characters or fewer`);
    }
  }

  if (nextPhone && nextPhone.length < MIN_PHONE_LENGTH) {
    throw badRequest(`Phone number must be at least ${MIN_PHONE_LENGTH} characters`);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw notFound("User not found");
  }

  if (nextName !== undefined) {
    user.name = nextName;
  }

  if (nextPhone !== undefined) {
    if (nextPhone) {
      user.phone = nextPhone;
    } else {
      user.set("phone", undefined);
    }
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: publicUser(user),
  });
};

// Change the logged-in user's password
// PATCH /api/auth/me/password
// body  { currentPassword, newPassword }
// @access Private
const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw unauthorized();
  }

  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || !currentPassword) {
    throw badRequest("currentPassword is required");
  }

  if (typeof newPassword !== "string" || !newPassword) {
    throw badRequest("newPassword is required");
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (currentPassword === newPassword) {
    throw badRequest("New password must be different from the current password");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw notFound("User not found");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) {
    throw badRequest("Current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
};

export { registerUser, loginUser, getMe, updateProfile, changePassword };
