import type { SeniorProfile } from "./seed";

export type CommunicationPreferences = SeniorProfile["communicationPreferences"];

export const ELEVENLABS_SLOW_SPEED = 0.88;
export const ELEVENLABS_DEFAULT_SPEED = 1;
export const DEVICE_SLOW_SPEECH_RATE = 0.92;
export const DEVICE_DEFAULT_SPEECH_RATE = 1;

export function elevenLabsSpeechSpeed(prefs: CommunicationPreferences): number {
  return prefs.speaksSlowly ? ELEVENLABS_SLOW_SPEED : ELEVENLABS_DEFAULT_SPEED;
}

export function deviceSpeechRate(prefs: CommunicationPreferences): number {
  return prefs.speaksSlowly ? DEVICE_SLOW_SPEECH_RATE : DEVICE_DEFAULT_SPEECH_RATE;
}

export function spokenTextForTts(
  text: string,
  prefs: CommunicationPreferences,
  options: { repeatConfirmation: boolean },
): string {
  if (prefs.repeatsConfirmations && options.repeatConfirmation) {
    return `${text} ${text}`;
  }
  return text;
}

export function simpleLanguageInstruction(
  prefs: CommunicationPreferences,
): string | undefined {
  if (!prefs.prefersSimpleLanguage) return undefined;
  return "Speak in short, simple sentences she can hear.";
}
