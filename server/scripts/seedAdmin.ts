// Creates (or promotes) the first admin account.
// Run from the server folder:  npm run seed:admin
//
// Optional environment overrides:
//   ADMIN_EMAIL     default: admin@spotdine.local
//   ADMIN_NAME      default: SpotDine Admin
//   ADMIN_PASSWORD  default: a random password, printed once
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import connectDB from "../config/db.js";
import { User } from "../models/User.js";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@spotdine.local";
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || "SpotDine Admin";
const providedPassword = process.env.ADMIN_PASSWORD;
const generatedPassword = providedPassword
  ? null
  : randomBytes(9).toString("base64url"); // 12 URL-safe characters

const run = async () => {
  await connectDB();

  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      existing.role = "admin";
      existing.name = ADMIN_NAME;
      if (providedPassword) {
        existing.password = await bcrypt.hash(providedPassword, 10);
      }
      await existing.save();

      console.log(`[seed:admin] Updated existing user ${ADMIN_EMAIL} to role "admin".`);
      if (providedPassword) {
        console.log("[seed:admin] Password reset from ADMIN_PASSWORD.");
      } else {
        console.log("[seed:admin] Existing password kept (set ADMIN_PASSWORD to reset it).");
      }
      return;
    }

    const password = providedPassword ?? generatedPassword!;
    const user = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(password, 10),
      role: "admin",
    });

    console.log(`[seed:admin] Created admin ${user.email}.`);
    console.log(`[seed:admin] Password: ${password}`);
    if (generatedPassword) {
      console.log("[seed:admin] This password is shown once - save it now.");
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("[seed:admin] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
