import { Document, model, Schema, Types } from "mongoose";

export interface IRestaurant extends Document {
  name: string;
  slug: string;
  description: string;
  cuisine: string;
  priceRange: "$" | "$$" | "$$$" | "$$$$";
  rating: number;
  reviewCount: number;
  location: string;
  address: string;
  image: string;
  chef: string;
  tags: string[];
  availableSlots: string[];
  featured: boolean;
  exclusive: boolean;
  owner: Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  totalSeats: number;
  createdAt: Date;
  updatedAt: Date;
}


