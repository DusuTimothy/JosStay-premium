import rateLimit from "express-rate-limit";
import {
  API_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
} from "../config/env.js";

const base = {
  legacyHeaders: false,
  standardHeaders: "draft-7",
};

export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: API_RATE_LIMIT_MAX,
  message: { error: "Too many requests. Please try again shortly." },
});

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many authentication attempts. Please try again later.",
  },
});
