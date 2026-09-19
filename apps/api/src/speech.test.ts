import { describe, expect, it } from "vitest";
import {
  ELEVENLABS_STT_MODEL,
  ELEVENLABS_STT_URL,
  ELEVENLABS_TTS_MODEL,
  DEFAULT_KASAMA_VOICE_ID,
  SttNotConfiguredError,
  TtsNotConfiguredError,
  createElevenLabsSpeaker,
  createElevenLabsTranscriber,
  elevenLabsTtsUrl,
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

describe("createElevenLabsSpeaker", () => {
  it("throws TtsNotConfiguredError without an API key", async () => {
    const speak = createElevenLabsSpeaker({ apiKey: undefined });
    await expect(speak("Hello")).rejects.toBeInstanceOf(TtsNotConfiguredError);
  });

  it("posts Kasama's reply to ElevenLabs TTS and returns mpeg bytes", async () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), init: init ?? {} };
      return new Response(audio, { status: 200, headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;

    const speak = createElevenLabsSpeaker({
      apiKey: "xi_test",
      voiceId: "voice_kasama",
      fetchImpl,
    });
    const result = await speak("Should I set that up?");

    expect(result.contentType).toBe("audio/mpeg");
    expect(result.bytes).toEqual(audio);
    expect(seen).not.toBeNull();
    expect(seen!.url).toBe(elevenLabsTtsUrl("voice_kasama"));
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("xi_test");
    expect(headers["accept"]).toBe("audio/mpeg");
    const body = JSON.parse(String(seen!.init.body)) as { text: string; model_id: string };
    expect(body.text).toBe("Should I set that up?");
    expect(body.model_id).toBe(ELEVENLABS_TTS_MODEL);
  });

  it("uses the documented Kasama voice when none is passed", async () => {
    let url = "";
    const fetchImpl = (async (requestUrl: string | URL | Request) => {
      url = String(requestUrl);
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as typeof fetch;

    await createElevenLabsSpeaker({ apiKey: "xi_test", fetchImpl })("Hello");
    expect(url).toBe(elevenLabsTtsUrl(DEFAULT_KASAMA_VOICE_ID));
  });

  it("surfaces provider errors", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    const speak = createElevenLabsSpeaker({ apiKey: "xi_test", fetchImpl });
    await expect(speak("Hello")).rejects.toThrow(/401/);
  });
});
