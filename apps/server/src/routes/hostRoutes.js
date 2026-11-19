import { Router } from "express";
import { getPayouts } from "../controllers/hostController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/payouts", requireRole("host", "admin"), getPayouts);

export default router;
