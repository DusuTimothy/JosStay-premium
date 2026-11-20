import { Router } from "express";
import {
  createListing,
  createListingBlock,
  deleteListingBlock,
  getHostBookings,
  getHostListings,
  getHostMe,
  getListingBlocks,
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

export default router;
