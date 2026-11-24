import { Router } from "express";
import {
  cancelPayoutRequest,
  createListing,
  createListingBlock,
  createPayoutMethod,
  createPayoutRequest,
  deleteListingBlock,
  deletePayoutMethod,
  getHostBookings,
  getHostListings,
  getHostMe,
  getListingBlocks,
  getPayoutBanks,
  getPayoutEarnings,
  getPayoutMethods,
  getPayoutRequests,
  getPayoutSummary,
  getPayouts,
  onboardHost,
  registerHost,
  submitListingForReview,
  updateListing,
  updateListingPricing,
} from "../controllers/hostController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/register", registerHost);
router.post("/onboard", requireAuth, onboardHost);
router.get("/me", requireAuth, requireRole("host", "admin"), getHostMe);
router.get("/listings", requireAuth, requireRole("host", "admin"), getHostListings);
router.post("/listings", requireAuth, requireRole("host", "admin"), createListing);
router.patch("/listings/:id", requireAuth, requireRole("host", "admin"), updateListing);
router.post("/listings/:id/submit", requireAuth, requireRole("host", "admin"), submitListingForReview);
router.put("/listings/:id/pricing", requireAuth, requireRole("host", "admin"), updateListingPricing);
router.get("/listings/:id/blocks", requireAuth, requireRole("host", "admin"), getListingBlocks);
router.post("/listings/:id/blocks", requireAuth, requireRole("host", "admin"), createListingBlock);
router.delete("/listings/:id/blocks/:blockId", requireAuth, requireRole("host", "admin"), deleteListingBlock);
router.get("/bookings", requireAuth, requireRole("host", "admin"), getHostBookings);

router.get("/payouts", requireAuth, requireRole("host", "admin"), getPayouts);
router.get("/payouts/summary", requireAuth, requireRole("host", "admin"), getPayoutSummary);
router.get("/payouts/earnings", requireAuth, requireRole("host", "admin"), getPayoutEarnings);
router.get("/payouts/requests", requireAuth, requireRole("host", "admin"), getPayoutRequests);
router.post("/payouts/requests", requireAuth, requireRole("host", "admin"), createPayoutRequest);
router.post("/payouts/requests/:id/cancel", requireAuth, requireRole("host", "admin"), cancelPayoutRequest);

router.get("/payout-methods", requireAuth, requireRole("host", "admin"), getPayoutMethods);
router.get("/payout-methods/banks", requireAuth, requireRole("host", "admin"), getPayoutBanks);
router.post("/payout-methods", requireAuth, requireRole("host", "admin"), createPayoutMethod);
router.delete("/payout-methods/:id", requireAuth, requireRole("host", "admin"), deletePayoutMethod);

export default router;
