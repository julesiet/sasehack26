import { z } from "zod";

export const healthSchema = z.object({
  ok: z.literal(true),
  service: z.literal("kasama-api"),
});

export type Health = z.infer<typeof healthSchema>;

export const envKeys = [
  "ELEVENLABS_API_KEY",
  "MODEL_API_KEY",
  "MODEL_NAME",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PROJECT_ID",
  "COMPOSIO_API_KEY",
] as const;

export * from "./tools";
export * from "./policy";
export * from "./audit";
export * from "./invoke";
export * from "./seed";
export * from "./demo-session";
export * from "./approval";
export * from "./session";
export * from "./caretaker-dashboard";
export * from "./conversation";
export * from "./playground";
export * from "./composio";

