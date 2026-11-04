import multer from "multer";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      // Public Cloudinary URL of the stored upload
      fileUrl?: string;
    }
  }
}

const CLOUDINARY_FOLDER = "spotdine/restaurants";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// cloudinary://<api_key>:<api_secret>@<cloud_name>
const parseCloudinaryUrl = (raw?: string): CloudinaryCredentials | null => {
  if (!raw) return null;

  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "cloudinary:") return null;

    const cloudName = url.hostname;
    const apiKey = decodeURIComponent(url.username);
    const apiSecret = decodeURIComponent(url.password);

    return cloudName && apiKey && apiSecret
      ? { cloudName, apiKey, apiSecret }
      : null;
  } catch {
    return null;
  }
};

const credentialsFromEnv = (): CloudinaryCredentials | null => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  return cloudName && apiKey && apiSecret
    ? { cloudName, apiKey, apiSecret }
    : null;
};

// Cloudinary is the only upload target, so credentials are required.
// They must be validated before the SDK is imported: it parses
// CLOUDINARY_URL while loading and throws on malformed values.
const rawCloudinaryUrl = process.env.CLOUDINARY_URL;
const urlCredentials = parseCloudinaryUrl(rawCloudinaryUrl);

if (rawCloudinaryUrl && !urlCredentials) {
  throw new Error(
    "CLOUDINARY_URL is malformed — expected cloudinary://<api_key>:<api_secret>@<cloud_name>",
  );
}

const credentials = urlCredentials ?? credentialsFromEnv();

if (!credentials) {
  throw new Error(
    "Cloudinary is not configured — add CLOUDINARY_URL to server/.env before starting the server",
  );
}

const { v2: cloudinary } = await import("cloudinary");

cloudinary.config({
  cloud_name: credentials.cloudName,
  api_key: credentials.apiKey,
  api_secret: credentials.apiSecret,
  secure: true,
});

console.log(`[uploads] using Cloudinary (${CLOUDINARY_FOLDER})`);

const singleImageUpload = multer({
  // Buffers are uploaded straight to Cloudinary, nothing is written to disk
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
}).single("image");

// Parses the upload, sends it to Cloudinary and exposes the public URL as
// req.fileUrl. Upload failures come back as JSON errors instead of 500s.
export const uploadRestaurantImage = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  singleImageUpload(req, res, async (error: any) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        res.status(400).json({
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "Image must be 5MB or smaller"
              : error.message,
        });
        return;
      }

      res.status(400).json({ message: error.message || "Image upload failed" });
      return;
    }

    if (!req.file) {
      next();
      return;
    }

    try {
      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: CLOUDINARY_FOLDER, resource_type: "image" },
      );
      req.fileUrl = result.secure_url;
      next();
    } catch (uploadError: any) {
      console.error(
        "[uploads] Cloudinary upload failed:",
        uploadError?.message ?? uploadError,
      );
      res.status(502).json({ message: "Image upload failed, please try again" });
    }
  });
};

// https://res.cloudinary.com/<cloud>/image/upload/v123/spotdine/restaurants/x.png
// -> spotdine/restaurants/x
const getCloudinaryPublicId = (imageUrl: string): string | null => {
  try {
    const { pathname } = new URL(imageUrl);
    const marker = "/upload/";
    const index = pathname.indexOf(marker);
    if (index === -1) return null;

    return pathname
      .slice(index + marker.length)
      .replace(/^v\d+\//, "")
      .replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

// Deletes a stored image from Cloudinary. Anything that is not a Cloudinary
// asset (e.g. a leftover local path) is ignored.
export const removeUploadedImage = async (imageUrl?: string): Promise<void> => {
  if (!imageUrl || !imageUrl.includes("res.cloudinary.com")) return;

  const publicId = getCloudinaryPublicId(imageUrl);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error: any) {
    console.error(
      "[uploads] Failed to delete Cloudinary asset:",
      error?.message ?? error,
    );
  }
};
