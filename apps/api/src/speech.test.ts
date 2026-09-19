import { describe, expect, it } from "vitest";
import {
  ELEVENLABS_STT_MODEL,
  ELEVENLABS_STT_URL,
  SttNotConfiguredError,
  createElevenLabsTranscriber,
} from "./speech";

const clip = new Blob([new Uint8Array([9, 9, 9])], { type: "audio/m4a" });

describe("createElevenLabsTranscriber", () => {
  it("throws SttNotConfiguredError without an API key", async () => {
    const transcribe = createElevenLabsTranscriber({ apiKey: undefined });
    await expect(transcribe(clip, "a.m4a")).rejects.toBeInstanceOf(SttNotConfiguredError);
  });

  it("posts multipart audio to ElevenLabs with the key in a header and returns text", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ text: "  Get me a ride.  " }), { status: 200 });
    }) as typeof fetch;

    const transcribe = createElevenLabsTranscriber({ apiKey: "xi_test", fetchImpl });
    const text = await transcribe(clip, "a.m4a");

    expect(text).toBe("Get me a ride.");
    expect(seen).not.toBeNull();
    const { url, init } = seen!;
    expect(url).toBe(ELEVENLABS_STT_URL);
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("xi_test");
    const form = init.body as FormData;
    expect(form.get("model_id")).toBe(ELEVENLABS_STT_MODEL);
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("surfaces provider errors", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    const transcribe = createElevenLabsTranscriber({ apiKey: "xi_test", fetchImpl });
    await expect(transcribe(clip, "a.m4a")).rejects.toThrow(/500/);
  });
});
