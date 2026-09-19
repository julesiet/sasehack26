import {
  bookRideInputSchema,
  bookRideResultSchema,
  evaluateToolCall,
  findRideOptionsInputSchema,
  findRideOptionsResultSchema,
  getAppointmentInputSchema,
  getAppointmentResultSchema,
  invokeToolRequestSchema,
  isKnownTool,
  notifyCaretakerInputSchema,
  notifyCaretakerResultSchema,
  toolInputSchemas,
  type ToolName,
} from "@kasama/shared";
import { auditLog } from "./audit-log";

export type ToolHttpResult = {
  status: 200 | 400 | 403 | 404;
  body: Record<string, unknown>;
};

function executeStub(name: ToolName, input: unknown) {
  switch (name) {
    case "get_appointment": {
      const { date } = getAppointmentInputSchema.parse(input);
      return getAppointmentResultSchema.parse({
        success: true,
        summary: `Calendar lookup is not implemented yet for ${date}.`,
        appointment: null,
      });
    }
    case "find_ride_options": {
      const parsed = findRideOptionsInputSchema.parse(input);
      return findRideOptionsResultSchema.parse({
        success: true,
        summary: `Uber ride search is not implemented yet from ${parsed.pickup} to ${parsed.destination}.`,
        options: [],
      });
    }
    case "book_ride": {
      const { optionId } = bookRideInputSchema.parse(input);
      return bookRideResultSchema.parse({
        success: true,
        confirmationId: `stub_uber_${optionId}`,
        summary: `Uber booking is not implemented yet. Option ${optionId} would be booked.`,
        booking: {
          provider: "uber",
          optionId,
          status: "not_implemented",
        },
      });
    }
    case "notify_caretaker": {
      const parsed = notifyCaretakerInputSchema.parse(input);
      return notifyCaretakerResultSchema.parse({
        success: true,
        confirmationId: `stub_notify_${parsed.urgency}`,
        summary: `Caretaker notification is not implemented yet. Message would be sent (${parsed.urgency}).`,
        preview: false,
        sent: true,
        draft: parsed,
      });
    }
    default: {
      const exhaustive: never = name;
      throw new Error(`Unhandled tool: ${exhaustive}`);
    }
  }
}

export function invokeTool(name: string, raw: unknown): ToolHttpResult {
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
        sessionId: request.data.sessionId,
      },
      proposed: { tool: name, input: parsedInput.data },
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

  const result = executeStub(name, parsedInput.data);
  const event = auditLog.append({
    whoAsked: {
      actor: request.data.actor,
      sessionId: request.data.sessionId,
    },
    proposed: { tool: name, input: parsedInput.data },
    approved: {
      allowed: true,
      by: request.data.actor,
      approvalTokenPresent: Boolean(request.data.approvalToken),
    },
    executed: { tool: name, attempted: true },
    outcome: {
      success: result.success,
      summary: result.summary,
    },
  });

  return { status: 200, body: { ...result, auditId: event.id } };
}
