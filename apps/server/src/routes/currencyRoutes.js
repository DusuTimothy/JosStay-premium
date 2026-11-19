import { Router } from "express";
import { convertCurrency } from "../controllers/currencyController.js";

const router = Router();

router.get("/:amount", convertCurrency);

export default router;
