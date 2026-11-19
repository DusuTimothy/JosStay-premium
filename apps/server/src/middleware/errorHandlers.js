import { ZodError } from "zod";
import { HttpError } from "../lib/http.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: "Route not found",
    requestId: req.id,
  });
};

export const errorHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      requestId: req.id,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
      requestId: req.id,
    });
  }

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large",
      requestId: req.id,
    });
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      error: "Invalid JSON body",
      requestId: req.id,
    });
  }

  console.error(`[${req.id}]`, error);
  return res.status(500).json({
    error: "Internal server error",
    requestId: req.id,
  });
};
