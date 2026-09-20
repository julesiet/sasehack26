import { getMariaAppointment, type LastApproval, type PendingApproval } from "@kasama/shared";

/**
 * Structured confirmation card (#6). Values are Maria's demo fixtures
 * so the MVP card always has a place, reason, time, and price.
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
};

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function rideConfirmationData(now: Date = new Date()): ConfirmationCardData {
  const appointment = getMariaAppointment(now);
  const pickup = new Date(appointment.start);
  pickup.setMinutes(pickup.getMinutes() - 30);
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
    estimate: "$24.50",
  };
}

export function notifyConfirmationData(preview: string): ConfirmationCardData {
  return {
    kind: "notify",
    eyebrow: "Message",
    intro: "Preview only. Nothing is sent yet.",
    placeName: "James Alvarez",
    placeHint: "Family",
    reasonLabel: "Message",
    reason: preview,
    timeLabel: "When",
    time: "Now",
  };
}

export function confirmationFromPending(
  pending: PendingApproval | null,
  justResolved: LastApproval | null,
  now: Date = new Date(),
): ConfirmationCardData | null {
  const tool = pending?.tool ?? justResolved?.tool;
  if (!tool) return null;
  if (tool === "notify_caretaker") {
    return notifyConfirmationData(
      pending?.preview ?? justResolved?.summary ?? "A note for your family.",
    );
  }
  if (tool === "book_ride") {
    const ride = rideConfirmationData(now);
    if (pending?.estimate) ride.estimate = pending.estimate;
    return ride;
  }
  return null;
}
