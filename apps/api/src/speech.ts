/**
 * Speech-to-text for the voice loop (#4).
 *
 * The iOS app records with `expo-audio` (works in Expo Go, no native STT) and
 * uploads the clip here. We forward it to ElevenLabs Scribe. Keys stay on the
 * server; the app never sees `ELEVENLABS_API_KEY`.
 */

export const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
export const ELEVENLABS_STT_MODEL = "scribe_v1";

export class SttNotConfiguredError extends Error {
  constructor() {
    super("ELEVENLABS_API_KEY is not set. Speech-to-text is unavailable.");
    this.name = "SttNotConfiguredError";
  }
}

export type Transcriber = (audio: Blob, filename: string) => Promise<string>;

type TranscriberDeps = {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  language?: string;
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

export const transcriber: Transcriber = createElevenLabsTranscriber({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
