import { Router } from "express";
import {
  handlePaystackWebhook,
  verifyPaystackPayment,
} from "../controllers/paymentController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/paystack/webhook", handlePaystackWebhook);
router.get("/paystack/verify", requireAuth, verifyPaystackPayment);

export default router;
