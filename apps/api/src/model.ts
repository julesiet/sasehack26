/**
 * ChatGPT planner for the harness (#5).
 *
 * Raw Chat Completions fetch, same pattern as ElevenLabs in speech.ts.
 * The harness decides what to execute; this module only talks to OpenAI.
 */

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_MODEL_NAME = "gpt-4o-mini";

export class ModelNotConfiguredError extends Error {
  constructor() {
    super("MODEL_API_KEY is not set. Kasama's planner is unavailable.");
    this.name = "ModelNotConfiguredError";
  }
}

export type OpenAiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatAssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

export type ChatComplete = (input: {
  messages: ChatMessage[];
  tools: unknown;
}) => Promise<ChatAssistantMessage>;

type OpenAiCompleteDeps = {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
};

function asToolCalls(raw: unknown): OpenAiToolCall[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const calls: OpenAiToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return undefined;
    const record = item as Record<string, unknown>;
    const fn = record.function;
    if (typeof record.id !== "string" || !fn || typeof fn !== "object") return undefined;
    const name = (fn as Record<string, unknown>).name;
    const args = (fn as Record<string, unknown>).arguments;
    if (typeof name !== "string" || typeof args !== "string") return undefined;
    calls.push({
      id: record.id,
      type: "function",
      function: { name, arguments: args },
    });
  }
  return calls;
}

export function createOpenAiChatComplete({
  apiKey,
  model = process.env.MODEL_NAME?.trim() || DEFAULT_MODEL_NAME,
  fetchImpl = fetch,
}: OpenAiCompleteDeps): ChatComplete {
  return async ({ messages, tools }) => {
    if (!apiKey?.trim()) {
      throw new ModelNotConfiguredError();
    }

    const res = await fetchImpl(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenAI chat failed (${res.status}). ${detail}`.trim());
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>;
    };
    const message = json.choices?.[0]?.message;
    if (!message) {
      throw new Error("OpenAI chat returned no message.");
    }

    const content = typeof message.content === "string" ? message.content : null;
    const tool_calls = asToolCalls(message.tool_calls);
    return {
      role: "assistant",
      content,
      ...(tool_calls ? { tool_calls } : {}),
    };
  };
}

/** Read the key on each call so a restarted API (or late-loaded `.env`) is picked up. */
export const openaiChatComplete: ChatComplete = (input) =>
  createOpenAiChatComplete({
    apiKey: process.env.MODEL_API_KEY,
    model: process.env.MODEL_NAME?.trim() || DEFAULT_MODEL_NAME,
  })(input);
