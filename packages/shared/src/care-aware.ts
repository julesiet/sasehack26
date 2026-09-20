import { getMariaSeedBundle, type MariaSeedBundle, type PriorRequest } from "./seed";
import { seniorFirstName } from "./caretaker-dashboard";

export const careAwareActionIds = ["remind", "notify_caretaker", "doctor_summary"] as const;
export type CareAwareActionId = (typeof careAwareActionIds)[number];

export type CareAwareUsagePeriodId = "morning" | "afternoon" | "evening";

export type CareAwareUsagePeriod = {
  id: CareAwareUsagePeriodId;
  label: string;
  window: string;
  minutes: number;
};

export type CareAwareResponseTone = "fast" | "mid" | "slow";

export type CareAwareResponseDay = {
  weekday: string;
  seconds: number;
  tone: CareAwareResponseTone;
};

export type CareAwareAction = {
  id: CareAwareActionId;
  label: string;
  detail: string;
};

export type CareAwareView = {
  seniorFirstName: string;
  dateTimeLabel: string;
  totalUsageMinutes: number;
  periods: CareAwareUsagePeriod[];
  peakActivity: string;
  repeatedQuestionsNote: string;
  responseAverageSeconds: number;
  responseDays: CareAwareResponseDay[];
  responseInsight: string;
  worthReviewingQuote: string;
  disclaimer: string;
  actions: CareAwareAction[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const USUAL_SLEEP_HOURS = 7;
export const CARE_AWARE_DISCLAIMER =
  "Observations are shared for context and are not a medical diagnosis.";

/**
 * Care-aware view (#10) projection. Usage and response times come from Maria's
 * seed; the quote and repeated-question note are computed from wearable sleep
 * and flagged prior requests so the demo beat stays explainable.
 */
export function buildCareAwareView(input: {
  seed?: MariaSeedBundle;
  now?: Date;
} = {}): CareAwareView {
  const now = input.now ?? new Date();
  const seed = input.seed ?? getMariaSeedBundle(now);
  const senior = seniorFirstName(seed.profile.name);
  const usage = seed.careAwareUsage;
  const response = seed.careAwareResponse;

  return {
    seniorFirstName: senior,
    dateTimeLabel: formatCareAwareDateTime(now),
    totalUsageMinutes: usage.totalMinutes,
    periods: [
      {
        id: "morning",
        label: "Morning",
        window: "6-12pm",
        minutes: usage.morningMinutes,
      },
      {
        id: "afternoon",
        label: "Afternoon",
        window: "12-5pm",
        minutes: usage.afternoonMinutes,
      },
      {
        id: "evening",
        label: "Evening",
        window: "5pm+",
        minutes: usage.eveningMinutes,
      },
    ],
    peakActivity: usage.peakActivity,
    repeatedQuestionsNote: buildRepeatedQuestionsNote(seed.priorRequests, senior),
    responseAverageSeconds: response.averageSeconds,
    responseDays: response.dailySeconds.map((seconds, index) => ({
      weekday: WEEKDAYS[index] ?? "Mon",
      seconds,
      tone: responseTone(seconds),
    })),
    responseInsight: `Faster responses in the morning (${formatSeconds(response.morningAverageSeconds)}) versus evening (${formatSeconds(response.eveningAverageSeconds)})`,
    worthReviewingQuote: buildWorthReviewingQuote(seed, senior),
    disclaimer: CARE_AWARE_DISCLAIMER,
    actions: [
      {
        id: "remind",
        label: "Remind Maria",
        detail: `A reminder for ${senior} stays on this phone. Kasama did not change any medication.`,
      },
      {
        id: "notify_caretaker",
        label: "Notify daughter",
        detail: "Family updates are not sent from this screen. Nothing was messaged.",
      },
      {
        id: "doctor_summary",
        label: "Prepare doctor summary",
        detail: `${buildWorthReviewingQuote(seed, senior)} ${CARE_AWARE_DISCLAIMER}`,
      },
    ],
  };
}

export function formatCareAwareDateTime(now: Date): string {
  const month = now.toLocaleDateString("en-US", { month: "long" });
  const day = now.getDate();
  const time = now
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s+/g, "")
    .toLowerCase();
  return `${month} ${day}${ordinal(day)}, ${time}`;
}

export function formatSeconds(value: number): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}s`;
}

export function responseTone(seconds: number): CareAwareResponseTone {
  if (seconds >= 6) return "slow";
  if (seconds >= 4.5) return "mid";
  return "fast";
}

export function buildWorthReviewingQuote(seed: MariaSeedBundle, seniorFirstName: string): string {
  const flagged = seed.priorRequests.filter((request) => request.flaggedConfusion);
  const appointmentRepeats = flagged.filter((request) => topicOf(request) === "appointment").length;
  const avgSleep =
    seed.wearableReadings.reduce((sum, reading) => sum + reading.sleepHours, 0) /
    Math.max(seed.wearableReadings.length, 1);
  const parts: string[] = [];
  if (appointmentRepeats >= 2) {
    parts.push("asked about the same appointment twice");
  } else if (flagged.length >= 2) {
    parts.push("asked the same kind of question more than once");
  }
  if (avgSleep < USUAL_SLEEP_HOURS) {
    parts.push("slept less than usual this week");
  }
  if (parts.length === 0) {
    return `${seniorFirstName}'s recent activity is worth reviewing.`;
  }
  return `${seniorFirstName} ${joinClauses(parts)}.`;
}

export function buildRepeatedQuestionsNote(
  requests: PriorRequest[],
  seniorFirstName: string,
): string {
  const flagged = requests.filter((request) => request.flaggedConfusion);
  if (flagged.length === 0) {
    return `${seniorFirstName} has not asked a repeated question this week.`;
  }

  const groups = groupFlagged(flagged);
  const clauses = groups.map((group) => describeGroup(group, seniorFirstName, group === groups[0]));
  const topics = unique(
    groups.map((group) => (group.topic === "appointment" ? "appointments" : "family check-ins")),
  );
  const focus =
    topics.length === 0
      ? "recent check-ins"
      : topics.length === 1
        ? topics[0]
        : `${topics.slice(0, -1).join(", ")} and ${topics.at(-1)}`;

  return `${clauses.join(", and ")}. These ${flagged.length} repeated questions this week focused on ${focus}.`;
}

type FlaggedGroup = {
  topic: "appointment" | "family" | "other";
  weekday: string;
  part: "morning" | "afternoon" | "evening";
  count: number;
};

function groupFlagged(flagged: PriorRequest[]): FlaggedGroup[] {
  const groups: FlaggedGroup[] = [];
  for (const request of flagged) {
    const topic = topicOf(request);
    const weekday = weekdayName(request.timestamp);
    const part = dayPart(request.timestamp);
    const existing = groups.find(
      (group) => group.topic === topic && group.weekday === weekday && group.part === part,
    );
    if (existing) {
      existing.count += 1;
    } else {
      groups.push({ topic, weekday, part, count: 1 });
    }
  }
  return groups;
}

function describeGroup(group: FlaggedGroup, seniorFirstName: string, isFirst: boolean): string {
  const subject = isFirst ? `${seniorFirstName} asked` : "asked";
  const about =
    group.topic === "appointment"
      ? "about her doctor appointment"
      : group.topic === "family"
        ? "about her daughter"
        : "the same question";
  return `${subject} ${about} ${countLabel(group.count)} on ${group.weekday} ${group.part}`;
}

function topicOf(request: PriorRequest): "appointment" | "family" | "other" {
  if (/\b(appointment|doctor)\b/i.test(request.requestText)) return "appointment";
  if (/\b(daughter|son|family|grandchild)\b/i.test(request.requestText)) return "family";
  return "other";
}

function weekdayName(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
}

function dayPart(iso: string): "morning" | "afternoon" | "evening" {
  const hours = new Date(iso).getHours();
  if (hours < 12) return "morning";
  if (hours < 17) return "afternoon";
  return "evening";
}

function countLabel(count: number): string {
  if (count === 1) return "once";
  return `${count} times`;
}

function joinClauses(parts: string[]): string {
  if (parts.length === 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ordinal(day: number): string {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
