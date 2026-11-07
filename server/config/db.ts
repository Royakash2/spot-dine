import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("Missing required environment variable: MONGODB_URI");
  }

  mongoose.connection.on("error", (error: unknown) => {
    console.error(
      "[db] connection error:",
      error instanceof Error ? error.message : error,
    );
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

  console.log(`[db] connected to ${mongoose.connection.name}`);
};

export default connectDB;
