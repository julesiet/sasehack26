import { File } from "expo-file-system";
import {
  approvalResponseSchema,
  conversationChatResponseSchema,
  conversationTurnResponseSchema,
  sessionViewSchema,
  transcribeResponseSchema,
  type ApprovalChoice,
  type ApprovalResponse,
  type ConversationChatResponse,
  type ConversationTurnResponse,
  type SessionView,
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
  chatId?: string,
): Promise<ConversationTurnResponse> {
  const res = await fetch(`${apiUrl}/conversation/turn`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript, sessionId, actor: "senior", chatId }),
  });
  if (!res.ok) throw await readError(res);
  return conversationTurnResponseSchema.parse(await res.json());
}

/** Start a new chat, or select an existing one, on the same session. */
export async function postConversationChat(
  sessionId: string,
  chatId?: string,
): Promise<ConversationChatResponse> {
  const res = await fetch(`${apiUrl}/conversation/chats`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, chatId }),
  });
  if (!res.ok) throw await readError(res);
  return conversationChatResponseSchema.parse(await res.json());
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

/**
 * Fetch ElevenLabs audio for Kasama's reply.
 * Throws `ApiError` with `code === "tts_not_configured"` when the API has no key.
 */
export async function postApproval(
  decision: ApprovalChoice,
  sessionId: string,
  actor: "senior" | "caretaker" = "senior",
): Promise<ApprovalResponse> {
  const res = await fetch(`${apiUrl}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, decision, actor }),
  });
  if (!res.ok) throw await readError(res);
  return approvalResponseSchema.parse(await res.json());
}

export async function postNotifyCaretaker(input: {
  sessionId: string;
  summary: string;
  urgency: "low" | "normal" | "high";
  recipientName: string;
  actor: "senior" | "caretaker";
}): Promise<void> {
  const res = await fetch(`${apiUrl}/tools/notify_caretaker`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        summary: input.summary,
        urgency: input.urgency,
        recipientName: input.recipientName,
      },
      actor: input.actor,
      sessionId: input.sessionId,
    }),
  });
  if (!res.ok) throw await readError(res);
}

export async function fetchSession(sessionId: string): Promise<SessionView> {
  const res = await fetch(`${apiUrl}/sessions/${sessionId}`);
  if (!res.ok) throw await readError(res);
  return sessionViewSchema.parse(await res.json());
}

export async function fetchKasamaVoice(text: string): Promise<Uint8Array> {
  const res = await fetch(`${apiUrl}/speech/speak`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await readError(res);
  return new Uint8Array(await res.arrayBuffer());
}
