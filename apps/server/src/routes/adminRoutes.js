import { Router } from "express";
import { getReviewListings, reviewListing } from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/listings/reviews", getReviewListings);
router.patch("/listings/:id/review", reviewListing);

export default router;
