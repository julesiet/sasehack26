import { selectedRideOption, type LastApproval, type PendingApproval } from "./approval";
import { emptyConversationState } from "./conversation";
import { getMariaSeedBundle, type MariaSeedBundle } from "./seed";
import type { SessionView } from "./session";
import type { UberProduct, UberRideOption } from "./tools";

export const caretakerOverviewStatusSchema = ["confirmed", "pending", "declined", "idle"] as const;
export type CaretakerOverviewStatus = (typeof caretakerOverviewStatusSchema)[number];

export type CaretakerConsentTone = "approved" | "pending" | "neutral";

export type CaretakerConsentItem = {
  id: string;
  tone: CaretakerConsentTone;
  title: string;
  detail: string;
};

export type CaretakerTimelineActor = "maria" | "kasama";

export type CaretakerTimelineItem = {
  id: string;
  actor: CaretakerTimelineActor;
  initial: "M" | "K";
  title: string;
  quote?: string;
  timestamp: string;
  timeLabel: string;
};

export type CaretakerAppointmentCard = {
  title: string;
  location: string;
  whenLabel: string;
};

export type CaretakerRideCard = {
  title: string;
  pickup: string;
  arrivalLabel: string;
  confirmationId?: string;
  booked: boolean;
};

export type CaretakerDashboard = {
  dateLabel: string;
  viewerFirstName: string;
  seniorFirstName: string;
  subtitle: string;
  careNotes: string;
  contacts: MariaSeedBundle["familyContacts"];
  overviewStatus: CaretakerOverviewStatus;
  overviewBadge: string | null;
  appointment: CaretakerAppointmentCard;
  ride: CaretakerRideCard | null;
  consentItems: CaretakerConsentItem[];
  activity: CaretakerTimelineItem[];
};

const EMPTY_VIEW: SessionView = {
  sessionId: "default",
  currentRequest: null,
  pendingApproval: null,
  lastApproval: null,
  lastRideOptions: [],
  appointment: null,
  lastBooking: null,
  lastMedicationReminder: null,
  lastHospitalVisit: null,
  tasks: [],
  caretakerActivity: [],
  careSignal: null,
  consentGranted: false,
  conversation: emptyConversationState(),
  events: [],
};

export function seniorFirstName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName;
}

export function formatDashboardDate(now: Date): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDashboardTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatAppointmentWhen(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dayLabel = sameCalendarDay(date, now)
    ? "Today"
    : sameCalendarDay(date, addCalendarDays(now, 1))
      ? "Tomorrow"
      : date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return `${dayLabel} at ${formatDashboardTime(iso)}`;
}

export function caretakerRideTitle(product: UberProduct): string {
  return product === "WAV" ? "Wheelchair Accessible Van" : "UberX";
}

export function productFromOptionId(optionId: string): UberProduct | undefined {
  if (optionId.includes("wav")) return "WAV";
  if (optionId.includes("uberx")) return "UberX";
  return undefined;
}

export function overviewStatusFor(view: SessionView): CaretakerOverviewStatus {
  if (view.lastBooking?.status === "booked") return "confirmed";
  if (isRideApproval(view.pendingApproval)) return "pending";
  if (isRideApproval(view.lastApproval) && view.lastApproval.decision === "declined") {
    return "declined";
  }
  return "idle";
}

export function overviewBadgeFor(status: CaretakerOverviewStatus): string | null {
  if (status === "confirmed") return "CONFIRMED";
  if (status === "pending") return "WAITING";
  if (status === "declined") return "DECLINED";
  return null;
}

export function buildCareNotes(input: {
  seed: MariaSeedBundle;
  careNote?: string | null;
}): string {
  const review = reviewSentence(input.careNote);
  return [
    review,
    "Suggest leaving 15 minutes early for her appointment.",
    "No diagnosis noted — only comfort preferences shared.",
  ].join(" ");
}

/**
 * Caretaker dashboard (#9) projection. Live session fields win; Maria's seed
 * fills appointment, pickup, viewer, and contacts so the screen is readable
 * before any tools run.
 */
export function buildCaretakerDashboard(input: {
  view?: SessionView | null;
  seed?: MariaSeedBundle;
  now?: Date;
}): CaretakerDashboard {
  const now = input.now ?? new Date();
  const seed = input.seed ?? getMariaSeedBundle(now);
  const view = input.view ?? EMPTY_VIEW;
  const senior = seniorFirstName(seed.profile.name);
  const status = overviewStatusFor(view);

  return {
    dateLabel: formatDashboardDate(now),
    viewerFirstName: seed.dashboardViewer.firstName,
    seniorFirstName: senior,
    subtitle: `Here's your current update on ${senior}.`,
    careNotes: buildCareNotes({ seed, careNote: view.careSignal?.note }),
    contacts: seed.familyContacts,
    overviewStatus: status,
    overviewBadge: overviewBadgeFor(status),
    appointment: appointmentCard(view, seed, now),
    ride: rideCard(view, seed),
    consentItems: consentItems(view, senior),
    activity: activityItems(view, senior),
  };
}

function appointmentCard(
  view: SessionView,
  seed: MariaSeedBundle,
  now: Date,
): CaretakerAppointmentCard {
  const live = view.appointment;
  return {
    title: live?.title ?? seed.appointment.title,
    location: live?.location ?? seed.appointment.destination,
    whenLabel: formatAppointmentWhen(live?.start ?? seed.appointment.start, now),
  };
}

function rideCard(view: SessionView, seed: MariaSeedBundle): CaretakerRideCard | null {
  const option = selectedRide(view);
  const booked = view.lastBooking?.status === "booked";
  if (!option && !view.lastBooking && !isRideApproval(view.pendingApproval)) {
    return null;
  }

  const product =
    option?.product ??
    (view.lastBooking ? productFromOptionId(view.lastBooking.optionId) : undefined) ??
    "WAV";

  return {
    title: caretakerRideTitle(product),
    pickup: seed.appointment.pickup,
    arrivalLabel: `Driver arrives ~${formatDashboardTime(seed.arrivalTarget)}`,
    confirmationId: booked ? view.lastBooking?.confirmationId : undefined,
    booked,
  };
}

function selectedRide(view: SessionView): UberRideOption | undefined {
  const fromPending = selectedRideOption(
    view.lastRideOptions,
    view.pendingApproval,
    view.conversation.activeRequest?.product,
  );
  if (fromPending) return fromPending;
  if (view.lastBooking) {
    return view.lastRideOptions.find((option) => option.optionId === view.lastBooking?.optionId);
  }
  return undefined;
}

function consentItems(view: SessionView, senior: string): CaretakerConsentItem[] {
  const items: CaretakerConsentItem[] = [];
  const ridePending = isRideApproval(view.pendingApproval);
  const lastRide = isRideApproval(view.lastApproval) ? view.lastApproval : null;

  if (ridePending) {
    items.push({
      id: "ride_booking",
      tone: "pending",
      title: "Ride booking waiting",
      detail: view.pendingApproval?.prompt ?? "Waiting for a human yes before anything is booked.",
    });
  } else if (lastRide?.decision === "approved" || view.lastBooking?.status === "booked") {
    const when = lastRide?.timestamp ?? view.lastBooking?.timestamp;
    const actor = lastRide?.actor === "caretaker" ? "Family" : senior;
    items.push({
      id: "ride_booking",
      tone: "approved",
      title: "Ride booking approved",
      detail: when
        ? `${actor} confirmed at ${formatDashboardTime(when)}.`
        : `${actor} confirmed the Uber.`,
    });
  } else if (lastRide?.decision === "declined") {
    items.push({
      id: "ride_booking",
      tone: "neutral",
      title: "Ride booking declined",
      detail: `${senior} declined. Nothing was booked.`,
    });
  }

  items.push({
    id: "pickup_reminder",
    tone: view.appointment || view.lastBooking ? "pending" : "neutral",
    title: "Pickup reminder set",
    detail: `Auto-approved per ${senior}'s preferences — leave 15 minutes early.`,
  });

  const notify = [...view.caretakerActivity].reverse().find((item) => item.summary);
  if (notify?.sent) {
    items.push({
      id: notify.id,
      tone: "approved",
      title: "Family update sent",
      detail: notify.summary,
    });
  } else if (notify?.preview || view.pendingApproval?.tool === "notify_caretaker") {
    items.push({
      id: notify?.id ?? "notify_preview",
      tone: "pending",
      title: "Family update draft",
      detail: notify?.summary ?? view.pendingApproval?.preview ?? "Preview only — not sent yet.",
    });
  }

  if (items.length === 1) {
    items.push({
      id: "waiting",
      tone: "neutral",
      title: "No booking yet",
      detail: `Open Senior mode so ${senior} can talk to Kasama.`,
    });
  }

  return items;
}

function activityItems(view: SessionView, senior: string): CaretakerTimelineItem[] {
  const turns = view.conversation.turns;
  if (turns.length === 0) {
    const fallback: CaretakerTimelineItem[] = [];
    if (view.lastBooking?.status === "booked") {
      fallback.push({
        id: "booking",
        actor: "kasama",
        initial: "K",
        title: "Kasama confirmed booking",
        timestamp: view.lastBooking.timestamp,
        timeLabel: formatDashboardTime(view.lastBooking.timestamp),
      });
    }
    return fallback;
  }

  const lastSeniorId = [...turns].reverse().find((turn) => turn.speaker === "senior")?.id;
  return turns.map((turn) => {
    const actor: CaretakerTimelineActor = turn.speaker === "senior" ? "maria" : "kasama";
    const isLatestMaria = turn.id === lastSeniorId && actor === "maria";
    return {
      id: turn.id,
      actor,
      initial: actor === "maria" ? "M" : "K",
      title: isLatestMaria
        ? `Most recent response: "${clip(turn.text, 90)}"`
        : actor === "maria"
          ? summarizeMaria(turn.text, senior)
          : summarizeKasama(turn.text, view),
      quote: turn.text,
      timestamp: turn.timestamp,
      timeLabel: formatDashboardTime(turn.timestamp),
    };
  });
}

function summarizeMaria(text: string, senior: string): string {
  if (/\b(ride|uber|book|doctor|appointment)\b/i.test(text)) {
    return `${senior} requested a ride`;
  }
  return clip(text, 72);
}

function summarizeKasama(text: string, view: SessionView): string {
  if (view.lastBooking?.status === "booked" || /\b(booked|confirmation)\b/i.test(text)) {
    return "Kasama confirmed booking";
  }
  if (/\bshould i book\b/i.test(text) || view.pendingApproval?.tool === "book_ride") {
    return "Kasama asked Maria to confirm";
  }
  return clip(text, 72);
}

function reviewSentence(note?: string | null): string {
  const trimmed = note?.trim();
  if (!trimmed) {
    return "Recent activity is worth reviewing.";
  }
  if (/diagnos/i.test(trimmed) && !/no diagnosis/i.test(trimmed)) {
    return "Recent activity is worth reviewing.";
  }
  const withPeriod = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  if (/worth reviewing/i.test(withPeriod)) return withPeriod;
  return `${withPeriod} This is worth reviewing.`;
}

function clip(text: string, max: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function isRideApproval(
  value: PendingApproval | LastApproval | null | undefined,
): value is PendingApproval | LastApproval {
  return value?.tool === "book_ride" || value?.action === "book_ride";
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
