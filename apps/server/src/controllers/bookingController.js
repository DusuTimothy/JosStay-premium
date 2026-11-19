import { DATA_BACKEND } from "../config/env.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import {
  cancelBookingRecord,
  createBookingRecord,
  listBookingRecords,
} from "../store/bookingStore.js";
import { getPropertyContext } from "../store/propertyStore.js";
import {
  BookingListQuerySchema,
  BookingReferenceSchema,
  BookingSchema,
} from "../validators/bookingSchemas.js";

const sampleData = DATA_BACKEND === "demo";

export const createBooking = asyncHandler(async (req, res) => {
  const payload = BookingSchema.parse(req.body);
  const context = await getPropertyContext(payload.propertySlug);

  if (!context) {
    throw new HttpError(404, "Property not found");
  }

  const booking = await createBookingRecord({
    userId: req.auth.userId,
    context,
    payload,
  });

  res.status(201).json({ data: booking, sampleData });
});

export const listBookings = asyncHandler(async (req, res) => {
  const query = BookingListQuerySchema.parse(req.query);
  const results = await listBookingRecords(req.auth, query);

  res.json({
    count: results.length,
    data: results,
    sampleData,
  });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const booking = await cancelBookingRecord(reference, req.auth);

  res.json({ data: booking, message: "Booking cancelled", sampleData });
});
