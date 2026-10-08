import { type Request, type NextFunction, type Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import type { IUser } from "../models/User.js";

export interface AuthRequest extends Request {
  user?: IUser;
}

// @desc  Protect routes
// @access Private
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      if (!token) {
        res.status(401).json({ message: "Not authorized, no token" });
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
      };

      // Get user from token
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        res.status(401).json({ message: "Not authorized, user not found" });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error in protect middleware:", error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
    return;
  }
};

export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res
      .status(403)
      .json({
        message:
          "Not authorized, access denied. Only admins can access this route",
      });
  }
};
export const ownerOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user && (req.user.role === "owner" || req.user.role === "admin")) {
    next();
  } else {
    res
      .status(403)
      .json({
        message:
          "Not authorized, access denied. Only owners can access this route",
      });
  }
};


