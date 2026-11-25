import { Router } from "express";
import {
  cancelBooking,
  createBooking,
  getBooking,
  initializeBookingPayment,
  listBookings,
} from "../controllers/bookingController.js";
import {
  cancelBookingRefundRequest,
  createBookingRefundRequest,
  getBookingRefundRequest,
} from "../controllers/refundController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/", createBooking);
router.get("/", listBookings);
router.get("/:reference/refund-request", getBookingRefundRequest);
router.post("/:reference/refund-request", createBookingRefundRequest);
router.delete("/:reference/refund-request", cancelBookingRefundRequest);
router.get("/:reference", getBooking);
router.post("/:reference/payment/initialize", initializeBookingPayment);
router.patch("/:reference/cancel", cancelBooking);

export default router;
