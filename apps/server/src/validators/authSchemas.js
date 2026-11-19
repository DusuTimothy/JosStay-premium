import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

const password = z
  .string()
  .min(12, "Password must be at least 12 characters")
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
