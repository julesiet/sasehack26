import { z } from "zod";

export const toolNames = [
  "get_appointment",
  "find_ride_options",
  "book_ride",
  "notify_caretaker",
] as const;

export type ToolName = (typeof toolNames)[number];

export const toolNameSchema = z.enum(toolNames);

export const getAppointmentInputSchema = z.object({
  date: z.string().min(1),
});

export const appointmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string().optional(),
  location: z.string().optional(),
});

export const getAppointmentResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  appointment: appointmentSchema.nullable().optional(),
});

export const findRideOptionsInputSchema = z.object({
  pickup: z.string().min(1),
  destination: z.string().min(1),
  arriveBy: z.string().min(1),
  accessibilityNeeds: z.array(z.string()).optional(),
});

export const uberProductSchema = z.enum(["UberX", "WAV"]);

export const uberRideOptionSchema = z.object({
  optionId: z.string(),
  provider: z.literal("uber"),
  product: uberProductSchema,
  estimate: z.string().optional(),
  etaMinutes: z.number().optional(),
  accessible: z.boolean(),
});

export const findRideOptionsResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  options: z.array(uberRideOptionSchema),
});

export const bookRideInputSchema = z.object({
  optionId: z.string().min(1),
});

export const bookRideResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  booking: z
    .object({
      provider: z.literal("uber"),
      optionId: z.string(),
      status: z.enum(["pending_confirmation", "booked", "not_implemented"]),
    })
    .optional(),
});

export const caretakerUrgencySchema = z.enum(["low", "normal", "high"]);

export const notifyCaretakerInputSchema = z.object({
  summary: z.string().min(1),
  urgency: caretakerUrgencySchema,
});

export const notifyCaretakerResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  preview: z.boolean().optional(),
  sent: z.boolean().optional(),
  draft: z
    .object({
      summary: z.string(),
      urgency: caretakerUrgencySchema,
    })
    .optional(),
});

export const toolInputSchemas = {
  get_appointment: getAppointmentInputSchema,
  find_ride_options: findRideOptionsInputSchema,
  book_ride: bookRideInputSchema,
  notify_caretaker: notifyCaretakerInputSchema,
} as const;

export const toolResultSchemas = {
  get_appointment: getAppointmentResultSchema,
  find_ride_options: findRideOptionsResultSchema,
  book_ride: bookRideResultSchema,
  notify_caretaker: notifyCaretakerResultSchema,
} as const;

export type GetAppointmentInput = z.infer<typeof getAppointmentInputSchema>;
export type GetAppointmentResult = z.infer<typeof getAppointmentResultSchema>;
export type FindRideOptionsInput = z.infer<typeof findRideOptionsInputSchema>;
export type FindRideOptionsResult = z.infer<typeof findRideOptionsResultSchema>;
export type UberRideOption = z.infer<typeof uberRideOptionSchema>;
export type BookRideInput = z.infer<typeof bookRideInputSchema>;
export type BookRideResult = z.infer<typeof bookRideResultSchema>;
export type NotifyCaretakerInput = z.infer<typeof notifyCaretakerInputSchema>;
export type NotifyCaretakerResult = z.infer<typeof notifyCaretakerResultSchema>;

export type ToolInput<T extends ToolName> = z.infer<(typeof toolInputSchemas)[T]>;
export type ToolResult<T extends ToolName> = z.infer<(typeof toolResultSchemas)[T]>;
