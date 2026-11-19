import { z } from "zod";

export const AuthSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["guest", "host", "admin"]).optional().default("guest"),
});

export const LoginSchema = AuthSchema.pick({ email: true, password: true });
