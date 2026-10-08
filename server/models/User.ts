import { Document, model, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "user" | "admin" | "owner";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin", "owner"], default: "user" },
  },
  {
    timestamps: true,
  },
);
//remove password when converting to Json

UserSchema.set("toJSON", {
  transform: (doc, ret: any) => {
    delete ret.password;
    return ret;
  },
});

export const User = model<IUser>("User", UserSchema);
