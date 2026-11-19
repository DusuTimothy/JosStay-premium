import jwt from "jsonwebtoken";
import {
  JWT_AUDIENCE,
  JWT_EXPIRES_IN,
  JWT_ISSUER,
  JWT_SECRET,
} from "../config/env.js";

export const signAccessToken = (user) =>
  jwt.sign(
    {
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      audience: JWT_AUDIENCE,
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      subject: String(user.id),
    },
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
