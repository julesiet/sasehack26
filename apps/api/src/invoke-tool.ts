import {
  bookRideInputSchema,
  computeArrivalTarget,
  evaluateToolCall,
  findRideOptionsInputSchema,
  getAppointmentInputSchema,
  getAppointmentResultSchema,
  getMariaAppointment,
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
  type ToolName,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { sessionStore } from "./session-store";
import { getUberProvider } from "./uber-provider";
import { kasamaComposio } from "./composio";
import { COMPOSIO_GMAIL_SEND_TOOL } from "@kasama/shared";

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

async function executeStub(name: ToolName, input: unknown, options?: { preview?: boolean }) {
  switch (name) {
    case "get_appointment": {
      const { date } = getAppointmentInputSchema.parse(input);
      const requested = new Date(date);
      const seedAppointment = getMariaAppointment();

      // Log for debugging purposes in tests
      console.log(`Requested: ${requested.toISOString()}, Seed: ${seedAppointment.start}`);

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
      const parsed = notifyCaretakerInputSchema.parse(input);
      if (options?.preview) {
        return notifyCaretakerResultSchema.parse({
          success: true,
          summary: `Draft for your family (${parsed.urgency}): ${parsed.summary} Not sent.`,
          preview: true,
          sent: false,
          draft: parsed,
        });
      }

      try {
        const composioResult = await kasamaComposio.execute({
          toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
          arguments: {
            body: parsed.summary,
            subject: `Note from Kasama about Maria (${parsed.urgency} urgency)`,
          },
        });

        if (!composioResult.successful) {
          return notifyCaretakerResultSchema.parse({
            success: false,
            summary: `Failed to send notification: ${composioResult.error}`,
            preview: false,
            sent: false,
          });
        }

        return notifyCaretakerResultSchema.parse({
          success: true,
          confirmationId: composioResult.logId ?? `composio_${Date.now()}`,
          summary: `Notification sent to family (${parsed.urgency}): ${parsed.summary}`,
          preview: false,
          sent: true,
          draft: parsed,
        });
      } catch (e) {
        return notifyCaretakerResultSchema.parse({
          success: false,
          summary: `Unexpected error sending notification: ${e instanceof Error ? e.message : String(e)}`,
          preview: false,
          sent: false,
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
