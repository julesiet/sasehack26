import { describe, expect, it } from "vitest";
import { OPENAI_CHAT_URL, createOpenAiChatComplete, ModelNotConfiguredError } from "./model";

describe("createOpenAiChatComplete", () => {
  it("throws when no model key is configured", async () => {
    const complete = createOpenAiChatComplete({ apiKey: undefined });
    await expect(complete({ messages: [], tools: [] })).rejects.toBeInstanceOf(ModelNotConfiguredError);
  });

  it("posts Chat Completions and returns the assistant message", async () => {
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(url).toBe(OPENAI_CHAT_URL);
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer test-key");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Should I set that up?",
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const complete = createOpenAiChatComplete({ apiKey: "test-key", model: "gpt-4o-mini", fetchImpl });
    const message = await complete({
      messages: [{ role: "user", content: "Get me a ride" }],
      tools: [],
    });
    expect(message).toEqual({ role: "assistant", content: "Should I set that up?" });
  });

  it("surfaces a provider failure", async () => {
    const complete = createOpenAiChatComplete({
      apiKey: "test-key",
      fetchImpl: async () => new Response("nope", { status: 401 }),
    });
    await expect(complete({ messages: [], tools: [] })).rejects.toThrow(/OpenAI chat failed \(401\)/);
  });
});
