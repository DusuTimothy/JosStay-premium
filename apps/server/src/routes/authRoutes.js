import { Router } from "express";
import {
  forgotPassword,
  googleAuth,
  login,
  logout,
  me,
  refresh,
  register,
  requestEmailVerification,
  resetPassword,
  verifyEmail,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authEmailLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/verify-email/request", authEmailLimiter, requestEmailVerification);
router.post("/verify-email/confirm", verifyEmail);
router.post("/password/forgot", authEmailLimiter, forgotPassword);
router.post("/password/reset", resetPassword);
router.get("/me", requireAuth, me);

export default router;
