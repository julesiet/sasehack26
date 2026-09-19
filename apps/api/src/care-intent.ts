import { formatHospitalTimeLabel, formatIsoTimeLabel, MARIA_NEARBY_HOSPITAL } from "@kasama/shared";

const STOP_MED_NAMES = new Set(["my", "the", "a", "an", "some", "this"]);

export function looksLikeMedicationReminder(text: string): boolean {
  const medWords =
    /\b(medication|lisinopril|pill|pills|tablet)\b/.test(text) ||
    (/\btake\b/.test(text) && /\b(remind|every)\b/.test(text));
  if (medWords) return true;
  const reminderWords =
    /\bremind(er|ers)?\b/.test(text) || /\bset (a |me a |up a )?reminder\b/.test(text);
  if (reminderWords && /\b(appointment|ride|uber|doctor|hospital)\b/.test(text)) {
    return false;
  }
  return reminderWords;
}

export function parseMedicationReminder(text: string): {
  name: string;
  frequency: string;
  intervalDays: number;
} | null {
  const intervalMatch = text.match(/every\s+(\d+)\s+days?/);
  const intervalDays = intervalMatch ? Number(intervalMatch[1]) : 4;
  const lisinopril = /\blisinopril\b/.test(text);
  const takeMatch = text.match(/\btake(?:\s+my)?\s+([a-z][a-z0-9-]*)/i);
  const raw = lisinopril ? "Lisinopril" : takeMatch?.[1];
  if (!raw || STOP_MED_NAMES.has(raw.toLowerCase())) {
    return null;
  }
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return {
    name,
    frequency: frequencyLabel(intervalDays),
    intervalDays,
  };
}

function frequencyLabel(intervalDays: number): string {
  return intervalDays === 1 ? "Every day" : `Every ${intervalDays} days`;
}

export function looksLikeHospitalSchedule(text: string, isRide: boolean): boolean {
  if (isRide) return false;
  if (/\b(what time|when is|when'?s|do i have)\b/.test(text)) return false;
  if (
    /\bhospital\b/.test(text) &&
    /\b(schedule|book|make|set up|appointment|near me|closest|nearest)\b/.test(text)
  ) {
    return true;
  }
  return (
    /\b(schedule|book|make|set up)\b/.test(text) &&
    /\b(appointment|appointments|hospital|visit|checkup)\b/.test(text)
  );
}

export function parseAppointmentTime(text: string): string | undefined {
  const iso = formatIsoTimeLabel(text);
  if (iso) return iso;
  const day = text.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i,
  );
  const time = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (!time) return undefined;
  const hour = Number(time[1]);
  const minute = (time[2] ?? "00").padStart(2, "0");
  const meridiem = /p/i.test(time[3] ?? "") ? "PM" : "AM";
  const clock = `${hour}:${minute} ${meridiem}`;
  if (!day) return clock;
  const weekday = day[1].charAt(0).toUpperCase() + day[1].slice(1).toLowerCase();
  return `${weekday} at ${clock}`;
}

/** Never show a raw ISO stamp on the hospital card. */
export function formatSpeakableTimeLabel(raw: string): string {
  return parseAppointmentTime(raw) ?? formatHospitalTimeLabel(raw);
}

export function looksLikeMostlyTime(text: string): boolean {
  if (formatIsoTimeLabel(text)) return true;
  return Boolean(parseAppointmentTime(text)) && text.trim().split(/\s+/).length <= 8;
}

export function tidyAppointmentReason(text: string): string {
  const cleaned = text.trim().replace(/[.!?]+$/, "");
  const want = cleaned.match(/^(.*?)\.\s*I want to (?:discuss|talk about)\s+(.*)$/i);
  if (want?.[1] && want[2]) {
    const topic = want[2].replace(/^my\s+/i, "");
    return `${want[1]}. Discuss ${topic}.`;
  }
  return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
}

export function nearbyHospital(): typeof MARIA_NEARBY_HOSPITAL {
  return MARIA_NEARBY_HOSPITAL;
}
