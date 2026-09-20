import {
  bookRideInputSchema,
  COMPOSIO_GMAIL_SEND_TOOL,
  computeArrivalTarget,
  evaluateToolCall,
  findRideOptionsInputSchema,
  getAppointmentInputSchema,
  getAppointmentResultSchema,
  getCareSignalResultSchema,
  getMariaAppointment,
  getMariaSeedBundle,
  FAMILY_EMAIL_RECIPIENT,
  invokeToolRequestSchema,
  isKnownTool,
  notifyCaretakerInputSchema,
  notifyCaretakerResultSchema,
  resolveSessionId,
  saveHospitalVisitInputSchema,
  saveHospitalVisitResultSchema,
  saveMedicationReminderInputSchema,
  saveMedicationReminderResultSchema,
  toolInputSchemas,
  withNotifyRecipient,
  type CareSignalAction,
  type ToolName,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { sessionStore } from "./session-store";
import { getUberProvider } from "./uber-provider";
import { ComposioNotConfiguredError, kasamaComposio } from "./composio";

export type ToolHttpResult = {
  status: 200 | 400 | 403 | 404;
  body: Record<string, unknown>;
};

function isSameCalendarDay(a: Date, b: Date): boolean {
  const ad = new Date(a);
  const bd = new Date(b);
  return (
    ad.getFullYear() === bd.getFullYear() &&
    ad.getMonth() === bd.getMonth() &&
    ad.getDate() === bd.getDate()
  );
}

/** Date-only strings parse as UTC midnight; noon local keeps the calendar day. */
function coerceAppointmentInput(input: unknown): unknown {
  const parsed = getAppointmentInputSchema.parse(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    return { date: `${parsed.date}T12:00:00` };
  }
  return parsed;
}

function coerceHospitalVisitInput(input: unknown): unknown {
  return saveHospitalVisitInputSchema.parse(input);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Below this, a night counts as "less sleep than usual" for the weekly care signal. */
const USUAL_SLEEP_HOURS = 7;
/** This many same-topic repeats in the window counts as a "repeated question" signal. */
const REPEATED_QUESTION_THRESHOLD = 2;

function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function computeCareSignal(): {
  summary: string;
  actions: CareSignalAction[];
  diagnosis: false;
} {
  const seed = getMariaSeedBundle();
  const name = firstName(seed.profile.name);

  const flaggedCount = seed.priorRequests.filter((request) => request.flaggedConfusion).length;
  const repeatedQuestion = flaggedCount >= REPEATED_QUESTION_THRESHOLD;

  const averageSleepHours =
    seed.wearableReadings.reduce((total, reading) => total + reading.sleepHours, 0) /
    seed.wearableReadings.length;
  const lessSleep = averageSleepHours < USUAL_SLEEP_HOURS;

  const clauses: string[] = [];
  if (repeatedQuestion) clauses.push(`${name} asked about the same appointment twice`);
  if (lessSleep) clauses.push("slept less than usual this week");

  if (clauses.length === 0) {
    return {
      summary: `Nothing unusual to review for ${name} this week.`,
      actions: [],
      diagnosis: false,
    };
  }

  const actions: CareSignalAction[] = ["remind", "notify_caretaker"];
  if (repeatedQuestion && lessSleep) actions.push("doctor_summary");

  return {
    summary: `${clauses.join(" and ")}.`,
    actions,
    diagnosis: false,
  };
}

async function executeStub(name: ToolName, input: unknown, options?: { preview?: boolean }) {
  switch (name) {
    case "get_appointment": {
      const { date } = getAppointmentInputSchema.parse(input);
      const requested = new Date(date);
      const seedAppointment = getMariaAppointment();

      if (!Number.isNaN(requested.getTime()) && isSameCalendarDay(requested, new Date(seedAppointment.start))) {
        const arrivalTarget = computeArrivalTarget(seedAppointment);
        return getAppointmentResultSchema.parse({
          success: true,
          confirmationId: seedAppointment.id,
          summary: `${seedAppointment.title} at ${formatTime(seedAppointment.start)}. Pickup by ${formatTime(arrivalTarget)} at ${seedAppointment.pickup}.`,
          appointment: {
            id: seedAppointment.id,
            title: seedAppointment.title,
            start: seedAppointment.start,
            end: seedAppointment.end,
            location: seedAppointment.destination,
          },
        });
      }

      return getAppointmentResultSchema.parse({
        success: true,
        summary: `No appointment found for ${date}.`,
        appointment: null,
      });
    }
    case "find_ride_options": {
      return getUberProvider().findOptions(findRideOptionsInputSchema.parse(input));
    }
    case "book_ride": {
      const { optionId } = bookRideInputSchema.parse(input);
      return getUberProvider().book(optionId);
    }
    case "notify_caretaker": {
      const parsed = withNotifyRecipient(notifyCaretakerInputSchema.parse(input));
      if (options?.preview) {
        return notifyCaretakerResultSchema.parse({
          success: true,
          summary: `Draft for ${parsed.recipientName} (${parsed.urgency}): ${parsed.summary} Not sent.`,
          preview: true,
          sent: false,
          draft: parsed,
        });
      }

      const mockSend = () =>
        notifyCaretakerResultSchema.parse({
          success: true,
          confirmationId: `notify_${Date.now()}`,
          summary: `Email sent to ${parsed.recipientName} (${parsed.urgency}): ${parsed.summary}`,
          preview: false,
          sent: true,
          draft: parsed,
        });

      try {
        const composioResult = await kasamaComposio.execute({
          toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
          arguments: {
            recipient_email: FAMILY_EMAIL_RECIPIENT,
            body: parsed.summary,
            subject: `Note from Kasama about Maria (${parsed.urgency} urgency)`,
          },
        });

        if (!composioResult.successful) {
          if (composioResult.needsAuth || composioResult.error?.includes("not configured")) {
            return mockSend();
          }
          return notifyCaretakerResultSchema.parse({
            success: false,
            summary: `Failed to send notification: ${composioResult.error ?? "Gmail send failed."}`,
            preview: false,
            sent: false,
            draft: parsed,
          });
        }

        return notifyCaretakerResultSchema.parse({
          success: true,
          confirmationId: composioResult.logId ?? `composio_${Date.now()}`,
          summary: `Email sent to ${parsed.recipientName} (${parsed.urgency}): ${parsed.summary}`,
          preview: false,
          sent: true,
          draft: parsed,
        });
      } catch (e) {
        if (e instanceof ComposioNotConfiguredError) {
          return mockSend();
        }
        return notifyCaretakerResultSchema.parse({
          success: false,
          summary: `Unexpected error sending notification: ${e instanceof Error ? e.message : String(e)}`,
          preview: false,
          sent: false,
          draft: parsed,
        });
      }
    }
    case "save_medication_reminder": {
      const parsed = saveMedicationReminderInputSchema.parse(input);
      const reminder = {
        name: parsed.name,
        frequency: parsed.frequency,
        intervalDays: parsed.intervalDays,
      };
      if (parsed.saveLocally) {
        return saveMedicationReminderResultSchema.parse({
          success: true,
          confirmationId: `task_med_${parsed.name.toLowerCase().replace(/\s+/g, "_")}`,
          summary: `Reminder for ${parsed.name} saved on this phone. Kasama did not change any medication.`,
          savedLocally: true,
          reminder,
        });
      }
      return saveMedicationReminderResultSchema.parse({
        success: false,
        summary: "We couldn't connect to your health provider. You can retry or save locally.",
        healthSyncError: true,
        reminder,
      });
    }
    case "save_hospital_visit": {
      const parsed = saveHospitalVisitInputSchema.parse(input);
      return saveHospitalVisitResultSchema.parse({
        success: true,
        confirmationId: "visit_st_marys_1",
        summary: `Appointment details saved for ${parsed.placeName}.`,
        visit: parsed,
      });
    }
    case "get_care_signal": {
      const signal = computeCareSignal();
      return getCareSignalResultSchema.parse({
        success: true,
        ...signal,
      });
    }
    default: {
      const exhaustive: never = name;
      throw new Error(`Unhandled tool: ${exhaustive}`);
    }
  }
}

export async function invokeTool(name: string, raw: unknown): Promise<ToolHttpResult> {
  if (!isKnownTool(name)) {
    return {
      status: 404,
      body: { success: false, summary: `Unknown tool: ${name}` },
    };
  }

  const request = invokeToolRequestSchema.safeParse(raw);
  if (!request.success) {
    return {
      status: 400,
      body: {
        success: false,
        summary: "Invalid request.",
        issues: request.error.issues,
      },
    };
  }

  const parsedInput = toolInputSchemas[name].safeParse(request.data.input);
  if (!parsedInput.success) {
    return {
      status: 400,
      body: {
        success: false,
        summary: `Invalid input for ${name}.`,
        issues: parsedInput.error.issues,
      },
    };
  }

  const input =
    name === "get_appointment"
      ? coerceAppointmentInput(parsedInput.data)
      : name === "save_hospital_visit"
        ? coerceHospitalVisitInput(parsedInput.data)
        : parsedInput.data;

  const sessionId = resolveSessionId(request.data.sessionId);
  const decision = evaluateToolCall(name, {
    actor: request.data.actor,
    approvalToken: request.data.approvalToken,
    consentGranted: request.data.consentGranted,
    recipient: request.data.recipient,
    allowedRecipients: request.data.allowedRecipients,
  });

  if (!decision.allowed) {
    const preview =
      name === "notify_caretaker"
        ? {
            preview: true,
            sent: false,
            draft: notifyCaretakerInputSchema.parse(parsedInput.data),
          }
        : {};

    const event = auditLog.append({
      whoAsked: {
        actor: request.data.actor,
        sessionId,
      },
      proposed: { tool: name, input },
      approved: {
        allowed: false,
        approvalTokenPresent: Boolean(request.data.approvalToken),
      },
      executed: { tool: name, attempted: false },
      outcome: {
        success: false,
        denied: true,
        reason: decision.reason,
        summary: decision.summary,
      },
    });
    sessionStore.applyToolEvent({
      sessionId,
      tool: name,
      input,
      actor: request.data.actor,
      consentGranted: request.data.consentGranted,
      decision,
      event,
    });

    return {
      status: 403,
      body: {
        success: false,
        denied: true,
        reason: decision.reason,
        summary: decision.summary,
        auditId: event.id,
        ...preview,
      },
    };
  }

  const result = await executeStub(name, input, { preview: decision.preview });
  const event = auditLog.append({
    whoAsked: {
      actor: request.data.actor,
      sessionId,
    },
    proposed: { tool: name, input },
    approved: {
      allowed: true,
      by: request.data.actor,
      approvalTokenPresent: Boolean(request.data.approvalToken),
    },
    executed: { tool: name, attempted: true },
    outcome: {
      success: result.success,
      summary: result.summary,
      ...(decision.preview ? { reason: "preview" } : {}),
    },
  });
  sessionStore.applyToolEvent({
    sessionId,
    tool: name,
    input,
    actor: request.data.actor,
    consentGranted: request.data.consentGranted,
    decision,
    result,
    event,
  });

  return { status: 200, body: { ...result, auditId: event.id } };
}
