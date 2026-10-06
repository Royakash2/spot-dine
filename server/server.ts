import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";


const app = express();
// coonect mongodb
await connectDB();
// Middleware
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

app.get("/", (req: Request, res: Response) => {
  res.send("Server is Live!");
});

app.use("/api/auth", authRoutes);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
