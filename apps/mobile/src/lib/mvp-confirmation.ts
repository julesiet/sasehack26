import {
  getMariaAppointment,
  rideProductTitle,
  selectedRideOption,
  type LastApproval,
  type PendingApproval,
  type SessionBooking,
  type UberProduct,
  type UberRideOption,
} from "@kasama/shared";

/**
 * Structured confirmation card (#6 / #8). Values are Maria's demo fixtures
 * plus the Uber option she selected so the price and product stay honest.
 */
export type ConfirmationCardData = {
  kind: "ride" | "notify";
  eyebrow: string;
  intro: string;
  placeName: string;
  placeHint?: string;
  distance?: string;
  reasonLabel: string;
  reason: string;
  timeLabel: string;
  time: string;
  estimate?: string;
  product?: UberProduct;
  productLabel?: string;
  confirmationId?: string;
};

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function rideConfirmationData(
  now: Date = new Date(),
  selected?: UberRideOption,
  lastBooking?: SessionBooking | null,
): ConfirmationCardData {
  const appointment = getMariaAppointment(now);
  const pickup = new Date(appointment.start);
  pickup.setMinutes(pickup.getMinutes() - 30);
  const product = selected?.product;
  return {
    kind: "ride",
    eyebrow: "Ride",
    intro: "I found an Uber to your appointment.",
    placeName: "Springfield Family Medicine",
    placeHint: "88 Oak St, Springfield",
    distance: "0.8 miles away",
    reasonLabel: "Appointment",
    reason: "Annual checkup with Dr. Chen",
    timeLabel: "Pickup time",
    time: `Tomorrow at ${formatClock(pickup.toISOString())}`,
    estimate: selected?.estimate ?? "$24.50",
    product,
    productLabel: product ? rideProductTitle(product) : undefined,
    confirmationId: lastBooking?.confirmationId,
  };
}

export function confirmationFromPending(
  pending: PendingApproval | null,
  justResolved: LastApproval | null,
  options: UberRideOption[] = [],
  lastBooking: SessionBooking | null = null,
  now: Date = new Date(),
): ConfirmationCardData | null {
  const tool = pending?.tool ?? justResolved?.tool;
  if (tool === "book_ride") {
    const selected = selectedRideOption(options, pending);
    const ride = rideConfirmationData(now, selected, lastBooking);
    if (pending?.estimate) ride.estimate = pending.estimate;
    return ride;
  }
  return null;
}
