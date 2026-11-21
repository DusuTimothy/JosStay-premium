import { asyncHandler } from "../lib/http.js";
import { sendHostListingReviewEmail } from "../lib/notifications.js";
import { listAdminReviewListings, reviewHostListing } from "../store/hostStore.js";

export const getReviewListings = asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await listAdminReviewListings({ status, limit });
  res.json(result);
});

export const reviewListing = asyncHandler(async (req, res) => {
  const { action, notes } = req.body || {};
  const result = await reviewHostListing({
    listingId: req.params.id,
    action,
    notes,
    reviewerUserId: req.auth?.userId,
  });

  try {
    if (result?.meta?.hostEmail) {
      await sendHostListingReviewEmail({
        to: result.meta.hostEmail,
        name: result.meta.hostName,
        listingName: result.meta.listingName,
        approved: String(action || "").toLowerCase() === "approve",
        notes,
      });
    }
  } catch {}

  res.json({ data: result.data, sampleData: result.sampleData });
});
