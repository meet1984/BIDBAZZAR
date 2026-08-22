import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../shared/AppError.js";

type RequestLocation = "body" | "params" | "query";

export function validate(
  schema: ZodType,
  location: RequestLocation = "body",
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[location]);
    if (!result.success) {
      next(
        new AppError(422, "VALIDATION_ERROR", "Check the submitted information.", result.error.flatten()),
      );
      return;
    }
    Object.defineProperty(request, location, {
      configurable: true,
      enumerable: true,
      value: result.data,
      writable: true,
    });
    next();
  };
}
