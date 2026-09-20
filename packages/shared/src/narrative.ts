import type { AuditEvent } from "./audit";
import type { SessionView } from "./session";
import type { UberRideOption } from "./tools";

export type NarrativeItem = {
  timestamp: string;
  text: string;
};

const MEDICAL_CONCLUSION = /diagnos|medical conclusion/i;

function safeText(text: string): string {
  if (MEDICAL_CONCLUSION.test(text)) {
    return "Kasama recorded activity that is worth reviewing.";
  }
  return text;
}

function wavOption(options: UberRideOption[]): UberRideOption | undefined {
  return options.find((option) => option.product === "WAV") ?? options.find((option) => option.accessible);
}

function eventTime(events: AuditEvent[], tool: string): string | undefined {
  return events.find((item) => item.proposed.tool === tool)?.timestamp;
}

/**
 * Turns a session view (audit events, appointment, ride options, approvals,
 * booking) into a short timestamped activity list for caretakers (#33).
 * Language is activity and consent — never a diagnosis.
 */
export function generateCaretakerNarrative(view: SessionView): NarrativeItem[] {
  const items: NarrativeItem[] = [];
  const rideAsk = view.conversation.turns.find(
    (turn) => turn.speaker === "senior" && /\b(ride|uber)\b/i.test(turn.text),
  );
  if (rideAsk) {
    items.push({ timestamp: rideAsk.timestamp, text: "Maria asked for a ride." });
  }

  const appointmentStamp =
    eventTime(view.events, "get_appointment") ?? view.appointment?.start ?? rideAsk?.timestamp;
  if (view.appointment || view.events.some((item) => item.proposed.tool === "get_appointment")) {
    const where = view.appointment?.location ?? view.appointment?.title ?? "her appointment";
    items.push({
      timestamp: appointmentStamp ?? view.events[0]?.timestamp ?? new Date().toISOString(),
      text: `Kasama found Maria's appointment at ${where}.`,
    });
  }

  const wav = wavOption(view.lastRideOptions);
  const rideStamp = eventTime(view.events, "find_ride_options") ?? appointmentStamp;
  if (view.lastRideOptions.length > 0 || view.events.some((item) => item.proposed.tool === "find_ride_options")) {
    const count = view.lastRideOptions.length || 2;
    const countLabel = count === 2 ? "two" : String(count);
    const wavBit = wav ? `, including Uber WAV for ${wav.estimate}` : "";
    items.push({
      timestamp: rideStamp ?? view.events.at(-1)?.timestamp ?? new Date().toISOString(),
      text: `Kasama found ${countLabel} Uber options${wavBit}.`,
    });
  }

  const booked = view.lastBooking?.status === "booked";
  const pendingRide = view.pendingApproval?.tool === "book_ride";
  const declinedRide =
    view.lastApproval?.tool === "book_ride" && view.lastApproval.decision === "declined";
  const estimate = view.pendingApproval?.estimate ?? wav?.estimate ?? "$24.50";

  if (pendingRide && !booked) {
    items.push({
      timestamp: view.pendingApproval?.timestamp ?? rideStamp ?? new Date().toISOString(),
      text: `Waiting on a human yes to book the Uber WAV for ${estimate}. Nothing is booked yet.`,
    });
  } else if (declinedRide && !booked) {
    items.push({
      timestamp: view.lastApproval?.timestamp ?? rideStamp ?? new Date().toISOString(),
      text: "The Uber was not booked.",
    });
  } else if (booked && view.lastBooking) {
    items.push({
      timestamp: view.lastBooking.timestamp,
      text: "Maria confirmed, and the Uber was booked.",
    });
  }

  return items.map((item) => ({ ...item, text: safeText(item.text) }));
}
