import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../shared/AppError.js";
import { logger } from "../shared/logger.js";

export const notFound: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `No API route matches ${request.method} ${request.path}.`,
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof multer.MulterError) {
    response.status(422).json({
      code: "UPLOAD_VALIDATION_ERROR",
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "The attachment is too large."
          : "Only one JPG, PNG or PDF attachment is allowed.",
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }

  if (typeof error === "object" && error !== null && ("status" in error || "statusCode" in error)) {
    const status = Number(
      (error as { status?: number; statusCode?: number }).status ??
        (error as { status?: number; statusCode?: number }).statusCode,
    );
    if (!Number.isNaN(status) && status >= 400 && status < 500) {
      response.status(status).json({
        code: status === 404 ? "NOT_FOUND" : "CLIENT_ERROR",
        message: (error as { message?: string }).message || "The requested resource was not found.",
      });
      return;
    }
  }

  logger.error("Unhandled Express Request Error:", error);

  response.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unexpected internal server error occurred.",
  });
};
