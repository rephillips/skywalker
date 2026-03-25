import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[Error]", err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
};
