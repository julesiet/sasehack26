import { describe, expect, it } from "vitest";
import { MARIA_PROFILE } from "./seed";
import {
  deviceSpeechRate,
  elevenLabsSpeechSpeed,
  simpleLanguageInstruction,
  spokenTextForTts,
} from "./communication";

const OFF = {
  speaksSlowly: false,
  prefersSimpleLanguage: false,
  repeatsConfirmations: false,
} as const;

const CHECKPOINT = "The Uber is $24.50. Should I book it?";

describe("elevenLabsSpeechSpeed", () => {
  it("is slower than the ElevenLabs default when Maria prefers slow speech", () => {
    expect(elevenLabsSpeechSpeed(MARIA_PROFILE.communicationPreferences)).toBe(0.88);
  });

  it("uses the ElevenLabs default when speaksSlowly is false", () => {
    expect(elevenLabsSpeechSpeed(OFF)).toBe(1);
  });
});

describe("deviceSpeechRate", () => {
  it("is slower than the expo-speech default when Maria prefers slow speech", () => {
    expect(deviceSpeechRate(MARIA_PROFILE.communicationPreferences)).toBe(0.92);
  });

  it("uses the expo-speech default when speaksSlowly is false", () => {
    expect(deviceSpeechRate(OFF)).toBe(1);
  });
});

describe("spokenTextForTts", () => {
  it("repeats a booking checkpoint when Maria wants confirmations repeated", () => {
    expect(
      spokenTextForTts(CHECKPOINT, MARIA_PROFILE.communicationPreferences, {
        repeatConfirmation: true,
      }),
    ).toBe(`${CHECKPOINT} ${CHECKPOINT}`);
  });

  it("does not change on-screen text input when repeating", () => {
    const original = CHECKPOINT;
    spokenTextForTts(original, MARIA_PROFILE.communicationPreferences, {
      repeatConfirmation: true,
    });
    expect(original).toBe(CHECKPOINT);
  });

  it("does not repeat when this turn is not a confirmation", () => {
    expect(
      spokenTextForTts("Your checkup is tomorrow at 10:30 AM.", MARIA_PROFILE.communicationPreferences, {
        repeatConfirmation: false,
      }),
    ).toBe("Your checkup is tomorrow at 10:30 AM.");
  });

  it("does not repeat when repeatsConfirmations is false", () => {
    expect(spokenTextForTts(CHECKPOINT, OFF, { repeatConfirmation: true })).toBe(CHECKPOINT);
  });
});

describe("simpleLanguageInstruction", () => {
  it("asks Kasama for short simple sentences when Maria prefers them", () => {
    expect(simpleLanguageInstruction(MARIA_PROFILE.communicationPreferences)).toBe(
      "Speak in short, simple sentences she can hear.",
    );
  });

  it("omits the simple-language line when the flag is off", () => {
    expect(simpleLanguageInstruction(OFF)).toBeUndefined();
  });
});
