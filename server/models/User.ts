import { Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: ["user", "admin", "owner"];
  createdAt: Date;
  updatedAt: Date;
}


