import { Router } from "express";
import {
  cancelBooking,
  createBooking,
  listBookings,
} from "../controllers/bookingController.js";

const router = Router();

router.post("/", createBooking);
router.get("/", listBookings);
router.patch("/:reference/cancel", cancelBooking);

export default router;
