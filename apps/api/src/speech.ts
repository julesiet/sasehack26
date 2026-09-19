/**
 * Speech for the voice loop (#4).
 *
 * The iOS app records with `expo-audio` and uploads the clip here (Scribe).
 * Kasama's reply is synthesized here (ElevenLabs TTS) and played on device.
 * Keys stay on the server; the app never sees `ELEVENLABS_API_KEY`.
 */

export const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
export const ELEVENLABS_STT_MODEL = "scribe_v1";
export const ELEVENLABS_TTS_MODEL = "eleven_turbo_v2_5";

/** Premade "Sarah" — warm, clear, a good default for Kasama until designers pick a voice. */
export const DEFAULT_KASAMA_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export function elevenLabsTtsUrl(voiceId: string): string {
  return `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
}

export class SttNotConfiguredError extends Error {
  constructor() {
    super("ELEVENLABS_API_KEY is not set. Speech-to-text is unavailable.");
    this.name = "SttNotConfiguredError";
  }
}

export class TtsNotConfiguredError extends Error {
  constructor() {
    super("ELEVENLABS_API_KEY is not set. Kasama's voice is unavailable.");
    this.name = "TtsNotConfiguredError";
  }
}

export type Transcriber = (audio: Blob, filename: string) => Promise<string>;
export type SpokenReply = { bytes: Uint8Array; contentType: string };
export type Speaker = (text: string) => Promise<SpokenReply>;

type TranscriberDeps = {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  language?: string;
};

type SpeakerDeps = {
  apiKey: string | undefined;
  voiceId?: string;
  fetchImpl?: typeof fetch;
};

export function createElevenLabsTranscriber({
  apiKey,
  fetchImpl = fetch,
  language = "en",
}: TranscriberDeps): Transcriber {
  return async (audio, filename) => {
    if (!apiKey) {
      throw new SttNotConfiguredError();
    }

    const form = new FormData();
    form.append("model_id", ELEVENLABS_STT_MODEL);
    form.append("language_code", language);
    form.append("file", audio, filename);

    const res = await fetchImpl(ELEVENLABS_STT_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`ElevenLabs speech-to-text failed (${res.status}). ${detail}`.trim());
    }

    const json = (await res.json()) as { text?: unknown };
    return typeof json.text === "string" ? json.text.trim() : "";
  };
}

export function createElevenLabsSpeaker({
  apiKey,
  voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_KASAMA_VOICE_ID,
  fetchImpl = fetch,
}: SpeakerDeps): Speaker {
  return async (text) => {
    if (!apiKey) {
      throw new TtsNotConfiguredError();
    }

    const res = await fetchImpl(elevenLabsTtsUrl(voiceId), {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_TTS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 0.88,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`ElevenLabs text-to-speech failed (${res.status}). ${detail}`.trim());
    }

    const contentType = res.headers.get("content-type") ?? "audio/mpeg";
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
  };
}

/** Read the key on each call so a restarted API (or late-loaded `.env`) is picked up. */
export const transcriber: Transcriber = (audio, filename) =>
  createElevenLabsTranscriber({ apiKey: process.env.ELEVENLABS_API_KEY })(audio, filename);

export const speaker: Speaker = (text) =>
  createElevenLabsSpeaker({
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_KASAMA_VOICE_ID,
  })(text);
