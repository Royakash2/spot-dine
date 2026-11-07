import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import type { IUser } from "../models/User.js";
import { forbidden, unauthorized } from "../utils/AppError.js";

export interface AuthRequest extends Request {
  user?: IUser;
}

interface TokenPayload {
  id: string;
}

// Verifies the Bearer token, loads the user and attaches it to req.user.
// Express 5 forwards rejected promises to the error handler, so failures are
// thrown here instead of replying directly.
export const protect = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw unauthorized("Not authorized, no token");
  }

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
  } catch {
    throw unauthorized("Not authorized, token failed");
  }

  if (!decoded.id) {
    throw unauthorized("Not authorized, token failed");
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    throw unauthorized("Not authorized, user not found");
  }

  req.user = user;
  next();
};

export const adminOnly = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "admin") {
    throw forbidden("Only admins can access this route");
  }
  next();
};

export const ownerOnly = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "owner" && req.user?.role !== "admin") {
    throw forbidden("Only restaurant owners can access this route");
  }
  next();
};
