/**
 * Temporary iOS speech debug screen (#17).
 *
 * Hidden behind Home → Dev. Isolated from the designed Senior UI and from
 * the iOS `default` session so recording a clip cannot clobber Maria's demo.
 * Delete this module with the screen once the designed voice loop is enough.
 */

export const SPEECH_DEBUG_SESSION_ID = "speech-debug";

/** Acceptance line from #17 — spoken on device, sent to the API. */
export const SPEECH_DEBUG_DEMO_TRANSCRIPT = "get me a ride to my doctor tomorrow";

export type SpeechDebugPhase =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "clarify"
  | "approving"
  | "micDenied"
  | "error";

export type SpeechDebugStatus = {
  title: string;
  body: string | null;
  recordLabel: string;
  recordEnabled: boolean;
  showSettings: boolean;
};

/**
 * Large-text copy for the placeholder debug screen. No designed chrome.
 * Mic denial stays visible and points at Settings plus typing.
 */
export function speechDebugStatus(input: {
  phase: SpeechDebugPhase;
  notice: string | null;
  seniorText: string | null;
  kasamaText: string | null;
}): SpeechDebugStatus {
  const record = (label: string, enabled: boolean, showSettings = false): Pick<
    SpeechDebugStatus,
    "recordLabel" | "recordEnabled" | "showSettings"
  > => ({
    recordLabel: label,
    recordEnabled: enabled,
    showSettings,
  });

  switch (input.phase) {
    case "listening":
      return {
        title: "Recording.",
        body: "Tap Stop when you are done.",
        ...record("Stop", true),
      };
    case "thinking":
      return {
        title: "Sending that to Kasama…",
        body: input.seniorText,
        ...record("Working…", false),
      };
    case "speaking":
      return {
        title: "Kasama is speaking.",
        body: input.kasamaText,
        ...record("Stop", true),
      };
    case "micDenied":
      return {
        title: "Kasama can't hear you yet.",
        body: "Allow the microphone in Settings, or type what you need below.",
        ...record("Record", false, true),
      };
    case "error":
      return {
        title: input.notice ?? "Something went wrong.",
        body: "Try again, or type below.",
        ...record("Record", true),
      };
    case "clarify":
    case "approving":
      return {
        title: input.kasamaText ?? "Kasama is waiting.",
        body: null,
        ...record("Record", true),
      };
    default:
      return {
        title: `Tap Record and say “${SPEECH_DEBUG_DEMO_TRANSCRIPT}.”`,
        body: input.notice,
        ...record("Record", true),
      };
  }
}
