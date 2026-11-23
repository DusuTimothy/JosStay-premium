import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer");

export const RegisterSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email,
    password,
  })
  .strict();

export const LoginSchema = z
  .object({
    email,
    password: z.string().min(1).max(72),
  })
  .strict();

export const GoogleAuthSchema = z
  .object({
    credential: z.string().trim().min(1).max(4096),
  })
  .strict();

export const EmailOnlySchema = z
  .object({
    email,
  })
  .strict();

export const TokenSchema = z
  .object({
    token: z.string().trim().min(16).max(512),
  })
  .strict();

export const ResetPasswordSchema = z
  .object({
    token: z.string().trim().min(16).max(512),
    password,
  })
  .strict();
