import { z } from "zod";
import { formatHospitalTimeLabel } from "./time-label";

export const toolNames = [
  "get_appointment",
  "find_ride_options",
  "book_ride",
  "notify_caretaker",
  "save_medication_reminder",
  "save_hospital_visit",
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
export type Appointment = z.infer<typeof appointmentSchema>;

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
export type UberProduct = z.infer<typeof uberProductSchema>;

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

/** Local task only — never a prescription change. */
export const saveMedicationReminderInputSchema = z.object({
  name: z.string().min(1),
  frequency: z.string().min(1),
  intervalDays: z.number().int().positive(),
  /** Skip the (stub) health provider and keep the reminder on-device. */
  saveLocally: z.boolean().optional(),
});

export const medicationReminderSchema = z.object({
  name: z.string(),
  frequency: z.string(),
  intervalDays: z.number().int().positive(),
});
export type MedicationReminder = z.infer<typeof medicationReminderSchema>;

export const saveMedicationReminderResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  savedLocally: z.boolean().optional(),
  healthSyncError: z.boolean().optional(),
  reminder: medicationReminderSchema.optional(),
});

const speakableTimeLabelSchema = z.string().min(1).transform(formatHospitalTimeLabel);

export const saveHospitalVisitInputSchema = z.object({
  placeName: z.string().min(1),
  distance: z.string().min(1),
  reason: z.string().min(1),
  timeLabel: speakableTimeLabelSchema,
});

export const hospitalVisitDetailsSchema = z.object({
  placeName: z.string(),
  distance: z.string(),
  reason: z.string(),
  timeLabel: z.string().transform(formatHospitalTimeLabel),
});
export type HospitalVisitDetails = z.infer<typeof hospitalVisitDetailsSchema>;

export const saveHospitalVisitResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  visit: hospitalVisitDetailsSchema.optional(),
});

export const toolInputSchemas = {
  get_appointment: getAppointmentInputSchema,
  find_ride_options: findRideOptionsInputSchema,
  book_ride: bookRideInputSchema,
  notify_caretaker: notifyCaretakerInputSchema,
  save_medication_reminder: saveMedicationReminderInputSchema,
  save_hospital_visit: saveHospitalVisitInputSchema,
} as const;

export const toolResultSchemas = {
  get_appointment: getAppointmentResultSchema,
  find_ride_options: findRideOptionsResultSchema,
  book_ride: bookRideResultSchema,
  notify_caretaker: notifyCaretakerResultSchema,
  save_medication_reminder: saveMedicationReminderResultSchema,
  save_hospital_visit: saveHospitalVisitResultSchema,
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
export type SaveMedicationReminderInput = z.infer<typeof saveMedicationReminderInputSchema>;
export type SaveMedicationReminderResult = z.infer<typeof saveMedicationReminderResultSchema>;
export type SaveHospitalVisitInput = z.infer<typeof saveHospitalVisitInputSchema>;
export type SaveHospitalVisitResult = z.infer<typeof saveHospitalVisitResultSchema>;

export type ToolInput<T extends ToolName> = z.infer<(typeof toolInputSchemas)[T]>;
export type ToolResult<T extends ToolName> = z.infer<(typeof toolResultSchemas)[T]>;
