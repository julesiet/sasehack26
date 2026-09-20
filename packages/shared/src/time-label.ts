/** ISO datetime ChatGPT often puts on save_hospital_visit.timeLabel. */
const ISO_STAMP =
  /(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?/;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatClock(hour24: number, minute: number): string {
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

/** Turn `2026-09-20T10:00:00.000Z` into `Sunday at 10:00 AM` using the stamp's wall clock, not UTC. */
export function formatIsoTimeLabel(raw: string): string | undefined {
  const iso = raw.match(ISO_STAMP);
  if (!iso) return undefined;
  const [, ymd, hh, mm] = iso;
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return undefined;
  const weekday = WEEKDAYS[date.getDay()];
  return `${weekday} at ${formatClock(Number(hh), Number(mm))}`;
}

/** Never show a raw ISO stamp on the hospital card or in Tasks. */
export function formatHospitalTimeLabel(raw: string): string {
  const trimmed = raw.trim().replace(/[.!?]+$/, "");
  return formatIsoTimeLabel(trimmed) ?? trimmed;
}

/** Swap ISO datetimes inside a longer label (reason · time) for Tasks. */
export function replaceIsoTimeLabels(raw: string): string {
  return raw.replace(ISO_STAMP, (match) => formatIsoTimeLabel(match) ?? match);
}

function localYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "today" / "tomorrow" / weekday from a pickup datetime. */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const target = new Date(iso);
  if (localYmd(target) === localYmd(now)) return "today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (localYmd(target) === localYmd(tomorrow)) return "tomorrow";
  return target.toLocaleDateString("en-US", { weekday: "long" });
}

/** Confirmation-card pickup line, e.g. `Today at 3:00 PM`. */
export function formatPickupWhen(iso: string, now: Date = new Date()): string {
  const day = formatRelativeDay(iso, now);
  const clock = new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const label = day.charAt(0).toUpperCase() + day.slice(1);
  return `${label} at ${clock}`;
}
