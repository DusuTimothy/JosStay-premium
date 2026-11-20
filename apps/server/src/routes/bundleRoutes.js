import { Router } from "express";
import { getBundleConfig, getBundleQuote } from "../controllers/bundleController.js";

const router = Router();

router.get("/config", getBundleConfig);
router.post("/quote", getBundleQuote);

export default router;
