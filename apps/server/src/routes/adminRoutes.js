import { Router } from "express";
import { getReviewListings, reviewListing } from "../controllers/adminController.js";
import {
  getRefundReviewPayments,
  resolveRefundReview,
} from "../controllers/adminRefundController.js";
import {
  approvePayout,
  getPayoutRequest,
  getPayoutRequests,
  markPayoutPaid,
  rejectPayout,
} from "../controllers/adminPayoutController.js";
import {
  approveRefund,
  getRefundRequests,
  markRefundRefunded,
  rejectRefund,
} from "../controllers/adminRefundRequestController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/listings/reviews", getReviewListings);
router.patch("/listings/:id/review", reviewListing);
router.get("/payments/refunds", getRefundReviewPayments);
router.patch("/payments/refunds/:reference/resolve", resolveRefundReview);

router.get("/refund-requests", getRefundRequests);
router.patch("/refund-requests/:id/approve", approveRefund);
router.patch("/refund-requests/:id/reject", rejectRefund);
router.patch("/refund-requests/:id/mark-refunded", markRefundRefunded);

router.get("/payouts/requests", getPayoutRequests);
router.get("/payouts/requests/:id", getPayoutRequest);
router.patch("/payouts/requests/:id/approve", approvePayout);
router.patch("/payouts/requests/:id/reject", rejectPayout);
router.patch("/payouts/requests/:id/mark-paid", markPayoutPaid);

export default router;
