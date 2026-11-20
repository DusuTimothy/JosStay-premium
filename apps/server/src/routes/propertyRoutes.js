import { Router } from "express";
import {
  getPropertyAvailability,
  getPropertyBySlug,
  getPropertyQuote,
  listProperties,
} from "../controllers/propertyController.js";

const router = Router();

router.get("/", listProperties);
router.get("/:slug/availability", getPropertyAvailability);
router.get("/:slug/quote", getPropertyQuote);
router.get("/:slug", getPropertyBySlug);

export default router;
