import {
  buildRepeatedQuestionsNote,
  buildWorthReviewingQuote,
  formatSeconds,
} from "./care-aware";
import { formatAppointmentWhen, seniorFirstName } from "./caretaker-dashboard";
import { getMariaDemoSession } from "./demo-session";
import {
  FAMILY_EMAIL_RECIPIENT,
  familyMessageAnalysis,
  titleCaseRelationship,
} from "./family";
import { getMariaSeedBundle } from "./seed";
import type { CaretakerUrgency } from "./tools";

const ACCESS_LABELS: Record<string, string> = {
  large_text: "large text",
  hearing_aid_compatible: "hearing-aid compatible",
  uses_walker: "uses a walker",
};

const ORANGE = "#FF6A00";
const CREAM = "#FFF3E2";
const INK = "#3A3530";
const MUTED = "#6B645C";
const LINE = "#E8DDD0";
const WHITE = "#FFFFFF";
const FONT = "Georgia, 'Times New Roman', serif";

/**
 * Gmail Kasama sends to Jules after a human yes. HTML tables and headers so
 * Gmail renders a readable report. Pass `is_html: true` on GMAIL_SEND_EMAIL.
 */
export function familyEmailCopy(input: {
  recipientName?: string;
  recipientId?: string;
  summary: string;
  urgency: CaretakerUrgency;
  now?: Date;
}): { subject: string; body: string; isHtml: true } {
  const now = input.now ?? new Date();
  const seed = getMariaSeedBundle(now);
  const demo = getMariaDemoSession(now);
  const analysis = familyMessageAnalysis({ ...input, status: "pending" });
  const first = seniorFirstName(seed.profile.name);
  const latestWearable = seed.wearableReadings.at(-1);
  const avgSleep = average(seed.wearableReadings.map((item) => item.sleepHours));
  const avgSteps = Math.round(average(seed.wearableReadings.map((item) => item.steps)));
  const avgHeart = Math.round(
    average(seed.wearableReadings.map((item) => item.restingHeartRate)),
  );
  const access = seed.profile.accessibilityNeeds
    .map((need) => ACCESS_LABELS[need] ?? need.replaceAll("_", " "))
    .join(", ");
  const prefs = seed.profile.communicationPreferences;
  const communication = [
    prefs.speaksSlowly ? "slower speech" : null,
    prefs.prefersSimpleLanguage ? "simple language" : null,
    prefs.repeatsConfirmations ? "repeated confirmations" : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(", ");
  const caretaker = seed.caretakerPreferences;
  const appointmentWhen = formatAppointmentWhen(seed.appointment.start, now);
  const leaveWhen = formatAppointmentWhen(seed.arrivalTarget, now);

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(`Kasama family report for Jules — ${first}`)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};color:${INK};font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${WHITE};border:1px solid ${LINE};">
          <tr>
            <td style="background:${ORANGE};padding:28px 32px;color:${WHITE};">
              <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${WHITE};">Kasama family report</p>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:34px;font-weight:normal;color:${WHITE};">Hi Jules,</h1>
              <p style="margin:10px 0 0;font-size:16px;line-height:24px;color:${WHITE};">Kasama sent this family report about ${escapeHtml(seed.profile.name)}.</p>
            </td>
          </tr>
          ${section(
            "This note",
            `<p style="margin:0 0 16px;font-size:18px;line-height:26px;">${escapeHtml(analysis.summary)}</p>${factTable([
              ["Intended for", `${analysis.recipientName} (${analysis.relationshipLabel})`],
              ["Urgency", analysis.urgencyLabel],
              ["Health information", analysis.healthLabel],
            ])}`,
          )}
          ${section(
            "Maria",
            `<p style="margin:0 0 16px;font-size:16px;line-height:24px;">${escapeHtml(seed.profile.name)} prefers ${escapeHtml(communication)}.</p>${factTable([
              ["Accessibility", access],
              ["Language", seed.profile.preferredLanguage === "en-US" ? "English" : seed.profile.preferredLanguage],
            ])}`,
          )}
          ${section(
            "Worth reviewing",
            `<p style="margin:0 0 12px;font-size:16px;line-height:24px;">${escapeHtml(buildWorthReviewingQuote(seed, first))}</p>
            <p style="margin:0;padding:12px 14px;background:${CREAM};font-size:15px;line-height:22px;color:${MUTED};">This is worth reviewing. It is not a diagnosis.</p>`,
          )}
          ${section(
            "Upcoming appointment",
            factTable([
              ["Appointment", seed.appointment.title],
              ["When", appointmentWhen],
              ["Pickup", seed.appointment.pickup],
              ["Destination", seed.appointment.destination],
              ["Leave early", `15 minutes early (${leaveWhen})`],
            ]),
          )}
          ${section(
            "Saved this week",
            `${dataTable(
              ["Item", "Details"],
              [
                [
                  "Medication reminder",
                  `${demo.lastMedicationReminder.name}, ${demo.lastMedicationReminder.frequency}. This is a Tasks item — Kasama did not change any medication.`,
                ],
                [
                  "Hospital",
                  `${demo.lastHospitalVisit.placeName}, ${demo.lastHospitalVisit.distance}. ${demo.lastHospitalVisit.reason}, ${demo.lastHospitalVisit.timeLabel}.`,
                ],
                [
                  "Ride",
                  `wheelchair Uber for $24.50. Confirmation ${demo.lastBooking.confirmationId}.`,
                ],
              ],
            )}`,
          )}
          ${section(
            "This week's activity",
            `${factTable([
              ["Kasama use", `${seed.careAwareUsage.totalMinutes} minutes (peak ${seed.careAwareUsage.peakActivity})`],
              ["Average reply time", formatSeconds(seed.careAwareResponse.averageSeconds)],
              ...(latestWearable
                ? ([
                    [
                      "Latest wearable",
                      `${latestWearable.sleepHours} hours sleep, ${latestWearable.steps.toLocaleString("en-US")} steps, resting heart rate ${latestWearable.restingHeartRate}`,
                    ],
                    [
                      "Seven-day averages",
                      `sleep ${avgSleep.toFixed(1)} hours, ${avgSteps.toLocaleString("en-US")} steps, resting heart rate ${avgHeart}`,
                    ],
                  ] as Array<[string, string]>)
                : []),
            ])}
            ${dataTable(
              ["Date", "Sleep", "Steps", "Resting HR"],
              seed.wearableReadings.map((reading) => [
                reading.date,
                `${reading.sleepHours} hrs`,
                reading.steps.toLocaleString("en-US"),
                String(reading.restingHeartRate),
              ]),
            )}`,
          )}
          ${section(
            "Repeated questions",
            `<p style="margin:0;font-size:16px;line-height:24px;">${escapeHtml(buildRepeatedQuestionsNote(seed.priorRequests, first))}</p>`,
          )}
          ${section(
            "Family",
            `${factTable([
              [
                "Policy caretaker",
                `${caretaker.name} (${titleCaseRelationship(caretaker.relationship)})`,
              ],
              [
                "Quiet hours",
                `${formatQuietHour(caretaker.quietHours.start)} – ${formatQuietHour(caretaker.quietHours.end)}`,
              ],
            ])}
            ${dataTable(
              ["Name", "Relationship"],
              seed.familyContacts.map((contact) => [
                contact.name,
                titleCaseRelationship(contact.relationship),
              ]),
            )}`,
          )}
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${LINE};font-size:13px;line-height:20px;color:${MUTED};">
              Kasama<br />
              Delivered to ${escapeHtml(FAMILY_EMAIL_RECIPIENT)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `Kasama family report for Jules — ${first}, ${analysis.urgencyLabel} urgency`,
    body,
    isHtml: true,
  };
}

function section(title: string, inner: string): string {
  return `<tr>
    <td style="padding:24px 32px 8px;">
      <h2 style="margin:0 0 14px;font-size:13px;line-height:18px;letter-spacing:0.12em;text-transform:uppercase;color:${ORANGE};font-weight:normal;">${escapeHtml(title)}</h2>
      ${inner}
    </td>
  </tr>`;
}

function factTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE};">
    ${rows
      .map(
        ([label, value], index) => `<tr>
      <th align="left" style="width:38%;padding:10px 12px;border-top:${index === 0 ? "0" : `1px solid ${LINE}`};background:${CREAM};font-size:13px;line-height:18px;color:${MUTED};font-weight:normal;">${escapeHtml(label)}</th>
      <td style="padding:10px 12px;border-top:${index === 0 ? "0" : `1px solid ${LINE}`};font-size:15px;line-height:22px;color:${INK};">${escapeHtml(value)}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

function dataTable(headers: string[], rows: string[][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;border:1px solid ${LINE};">
    <tr>
      ${headers
        .map(
          (header) =>
            `<th align="left" style="padding:10px 12px;background:${ORANGE};color:${WHITE};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;font-weight:normal;">${escapeHtml(header)}</th>`,
        )
        .join("")}
    </tr>
    ${rows
      .map(
        (row, index) => `<tr>
      ${row
        .map(
          (cell) =>
            `<td style="padding:10px 12px;border-top:1px solid ${LINE};background:${index % 2 === 0 ? WHITE : CREAM};font-size:14px;line-height:20px;color:${INK};">${escapeHtml(cell)}</td>`,
        )
        .join("")}
    </tr>`,
      )
      .join("")}
  </table>`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatQuietHour(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const hour = hours ?? 0;
  const minute = minutes ?? 0;
  const meridiem = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
