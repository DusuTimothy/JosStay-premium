import { Router } from "express";
import {
  getPropertyAvailability,
  getPropertyBySlug,
  listProperties,
} from "../controllers/propertyController.js";

const router = Router();

router.get("/", listProperties);
router.get("/:slug/availability", getPropertyAvailability);
router.get("/:slug", getPropertyBySlug);

export default router;
