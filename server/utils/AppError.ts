// Errors that are safe to show to API clients.
// Anything else that reaches the error handler is treated as an unexpected 500.
export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, message, details);

export const unauthorized = (message = "Not authorized"): AppError =>
  new AppError(401, message);

export const forbidden = (message = "Access denied"): AppError =>
  new AppError(403, message);

export const notFound = (message = "Resource not found"): AppError =>
  new AppError(404, message);

export const conflict = (message: string, details?: unknown): AppError =>
  new AppError(409, message, details);
