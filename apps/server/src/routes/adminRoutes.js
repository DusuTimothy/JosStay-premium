import { Router } from "express";
import { getReviewListings, reviewListing } from "../controllers/adminController.js";
import {
  getRefundReviewPayments,
  resolveRefundReview,
} from "../controllers/adminRefundController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/listings/reviews", getReviewListings);
router.patch("/listings/:id/review", reviewListing);
router.get("/payments/refunds", getRefundReviewPayments);
router.patch("/payments/refunds/:reference/resolve", resolveRefundReview);

export default router;
