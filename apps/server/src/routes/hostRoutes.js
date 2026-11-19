import { Router } from "express";
import { getPayouts } from "../controllers/hostController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/payouts", requireAuth, requireRole("host", "admin"), getPayouts);

export default router;
