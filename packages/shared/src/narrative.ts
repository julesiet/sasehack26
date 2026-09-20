import { AuditEvent } from "./audit";

export type NarrativeItem = {
  timestamp: string;
  text: string;
};

/**
 * Transforms a sequence of audit events into a human-readable narrative for the caretaker.
 * Focuses on activity and consent, avoiding medical conclusions.
 */
export function generateCaretakerNarrative(events: AuditEvent[]): NarrativeItem[] {
  if (events.length === 0) {
    return [];
  }

  return events.map((event) => {
    const tool = event.proposed.tool;
    const approved = event.approved;
    const outcome = event.outcome;

    let text = "";

    if (!approved?.allowed) {
      if (tool === "book_ride") {
        text = "Ride booking declined.";
      } else if (tool === "notify_caretaker") {
        text = "Caretaker notification declined.";
      } else if (tool === "save_medication_reminder") {
        text = "Medication reminder declined.";
      } else if (tool === "save_hospital_visit") {
        text = "Hospital visit record declined.";
      } else {
        text = `Action ${tool} was declined.`;
      }
    } else {
      // Approved or handled by model
      switch (tool) {
        case "get_appointment":
          text = "Kasama checked Maria's appointments.";
          break;
        case "find_ride_options":
          text = "Kasama searched for ride options.";
          break;
        case "book_ride":
          text = outcome.success ? "Ride booking confirmed." : "Ride booking failed.";
          break;
        case "save_medication_reminder":
          text = outcome.success ? "Kasama saved a medication reminder." : "Failed to save medication reminder.";
          break;
        case "save_hospital_visit":
          text = outcome.success ? "Kasama saved hospital visit details." : "Failed to save hospital visit details.";
          break;
        case "notify_caretaker":
          text = outcome.success ? "Kasama sent a notification to the caretaker." : "Failed to send caretaker notification.";
          break;
        default:
          text = outcome.success
            ? `Kasama completed ${tool.replace(/_/g, " ")}.`
            : `Kasama tried ${tool.replace(/_/g, " ")}, but it failed.`;
      }
    }

    // Safety filter: Ensure no "diagnosis" or clinical conclusions leak through.
    // If the tool was a general one and we used a fallback, we must be careful.
    if (/diagnos|clinical|medical conclusion/i.test(text)) {
      text = "Kasama processed a request regarding Maria's care.";
    }

    return {
      timestamp: event.timestamp,
      text,
    };
  });
}
