import { File } from "expo-file-system";
import {
  conversationTurnResponseSchema,
  transcribeResponseSchema,
  type ConversationTurnResponse,
} from "@kasama/shared";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response): Promise<ApiError> {
  let code: string | undefined;
  let summary = `Request failed (${res.status}).`;
  try {
    const json = (await res.json()) as { error?: unknown; summary?: unknown };
    if (typeof json.error === "string") code = json.error;
    if (typeof json.summary === "string") summary = json.summary;
  } catch {
    // keep defaults
  }
  return new ApiError(res.status, code, summary);
}

/** One conversational turn. Kasama's reply text comes back for the device to speak. */
export async function postConversationTurn(
  transcript: string,
  sessionId: string,
): Promise<ConversationTurnResponse> {
  const res = await fetch(`${apiUrl}/conversation/turn`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript, sessionId, actor: "senior" }),
  });
  if (!res.ok) throw await readError(res);
  return conversationTurnResponseSchema.parse(await res.json());
}

/**
 * Upload a recorded clip for speech-to-text.
 * Throws `ApiError` with `code === "stt_not_configured"` when the API has no key.
 */
export async function transcribeRecording(uri: string): Promise<string> {
  const form = new FormData();
  // Expo's fetch only accepts Blob-like parts; expo-file-system's File implements Blob.
  form.append("file", new File(uri), "speech.m4a");

  const res = await fetch(`${apiUrl}/speech/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw await readError(res);
  return transcribeResponseSchema.parse(await res.json()).transcript;
}
