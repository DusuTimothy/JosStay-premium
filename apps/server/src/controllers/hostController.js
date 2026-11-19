import { asyncHandler } from "../lib/http.js";
import { getPayoutRecords } from "../store/payoutStore.js";

export const getPayouts = asyncHandler(async (req, res) => {
  const result = await getPayoutRecords(req.auth);
  res.json(result);
});
