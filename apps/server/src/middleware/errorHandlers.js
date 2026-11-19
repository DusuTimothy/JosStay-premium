import { z } from "zod";

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
};

export const errorHandler = (error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
};
