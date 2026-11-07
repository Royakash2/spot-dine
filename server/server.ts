import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.disable("x-powered-by");
// Needed for correct client IPs behind a single reverse proxy (rate limiting)
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

// Brute-force protection for credential endpoints only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

app.get("/", (_req, res) => {
  res.send("Server is Live!");
});

app.get("/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    status: databaseConnected ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);

// Unmatched routes get JSON, then one handler owns every error response
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 5000);

const start = async (): Promise<void> => {
  requireEnv("MONGODB_URI");
  requireEnv("JWT_SECRET");

  await connectDB();

  const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[server] ${signal} received, shutting down`);

    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });

    // Don't hang forever on stuck connections
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

start().catch((error: unknown) => {
  console.error(
    "[server] failed to start:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
