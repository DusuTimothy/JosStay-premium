import { Router } from "express";
import {
  cancelBooking,
  createBooking,
  listBookings,
} from "../controllers/bookingController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/", createBooking);
router.get("/", listBookings);
router.patch("/:reference/cancel", cancelBooking);

export default router;
