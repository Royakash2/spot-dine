import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError.js";

interface NormalizedError {
  statusCode: number;
  message: string;
  details?: unknown;
  unexpected: boolean;
}

interface ErrorBody {
  success: false;
  message: string;
  details?: unknown;
}

const isProduction = (): boolean => process.env.NODE_ENV === "production";

// JSON 404 for any unmatched route, so API clients never receive HTML.
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
      unexpected: false,
    };
  }

  if (error instanceof multer.MulterError) {
    return {
      statusCode: 400,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5MB or smaller"
          : error.message,
      unexpected: false,
    };
  }

  // body-parser throws this when the request body is not valid JSON
  if (error instanceof SyntaxError && "body" in error) {
    return { statusCode: 400, message: "Invalid JSON payload", unexpected: false };
  }

  const candidate = error as {
    name?: string;
    message?: string;
    code?: number | string;
    path?: string;
    errors?: Record<string, { message?: string }>;
    keyValue?: Record<string, unknown>;
  };

  // Mongoose schema validation
  if (candidate?.name === "ValidationError") {
    const messages = Object.values(candidate.errors ?? {})
      .map((item) => item.message)
      .filter((message): message is string => Boolean(message));

    return {
      statusCode: 400,
      message: messages[0] ?? "Invalid request data",
      details: messages.length > 1 ? messages : undefined,
      unexpected: false,
    };
  }

  // Invalid ObjectId and similar cast failures
  if (candidate?.name === "CastError") {
    return {
      statusCode: 400,
      message: `Invalid value for "${candidate.path ?? "field"}"`,
      unexpected: false,
    };
  }

  // Mongo unique index
  if (candidate?.code === 11000) {
    const field = Object.keys(candidate.keyValue ?? {})[0];
    return {
      statusCode: 409,
      message: field ? `A record with that ${field} already exists` : "Duplicate record",
      unexpected: false,
    };
  }

  return {
    statusCode: 500,
    message: "Internal server error",
    unexpected: true,
  };
};

// Single place that turns any thrown/rejected error into a JSON response.
// Unexpected failures are logged with the stack but never echoed to clients.
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);

  if (normalized.unexpected) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  const body: ErrorBody = {
    success: false,
    message: normalized.message,
  };

  if (normalized.details !== undefined) {
    body.details = normalized.details;
  }

  if (!isProduction() && normalized.unexpected && error instanceof Error) {
    body.details = error.stack;
  }

  res.status(normalized.statusCode).json(body);
};
