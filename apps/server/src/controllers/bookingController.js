import { getProperty, quoteStay } from "@josstay/shared";
import { bookings, createReference } from "../store/demoStore.js";
import { BookingSchema } from "../validators/bookingSchemas.js";

export const createBooking = (req, res, next) => {
  try {
    const payload = BookingSchema.parse(req.body);
    const property = getProperty(payload.propertySlug);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    const quote = quoteStay(property, payload.checkIn, payload.checkOut, {
      roomId: payload.roomId,
      airportPickup: payload.airportPickup,
    });

    const booking = {
      ...payload,
      reference: createReference(),
      status: "upcoming",
      total: quote.total,
      quote,
      createdAt: new Date().toISOString(),
      sampleData: true,
    };

    bookings.unshift(booking);
    res.status(201).json({ data: booking, message: "Booking created (demo)" });
  } catch (error) {
    next(error);
  }
};

export const listBookings = (req, res) => {
  const { email } = req.query;
  const results = email
    ? bookings.filter((b) => b.guest?.email === email)
    : bookings;
  res.json({ count: results.length, data: results, sampleData: true });
};

export const cancelBooking = (req, res) => {
  const booking = bookings.find((b) => b.reference === req.params.reference);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  booking.status = "cancelled";
  booking.cancelledAt = new Date().toISOString();
  res.json({ data: booking, message: "Booking cancelled (demo)" });
};
