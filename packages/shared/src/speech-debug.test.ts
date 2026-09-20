import { describe, expect, it } from "vitest";
import { PLAYGROUND_DEFAULT_SESSION_ID } from "./playground";
import { DEFAULT_SESSION_ID } from "./session";
import {
  SPEECH_DEBUG_DEMO_TRANSCRIPT,
  SPEECH_DEBUG_SESSION_ID,
  speechDebugStatus,
} from "./speech-debug";

describe("speech debug (#17)", () => {
  it("uses a session id that does not collide with iOS or the playground", () => {
    expect(SPEECH_DEBUG_SESSION_ID).toBe("speech-debug");
    expect(SPEECH_DEBUG_SESSION_ID).not.toBe(DEFAULT_SESSION_ID);
    expect(SPEECH_DEBUG_SESSION_ID).not.toBe(PLAYGROUND_DEFAULT_SESSION_ID);
  });

  it("keeps the spoken demo line from the issue", () => {
    expect(SPEECH_DEBUG_DEMO_TRANSCRIPT).toBe("get me a ride to my doctor tomorrow");
  });

  it("shows recoverable mic denial in large-text copy", () => {
    const status = speechDebugStatus({
      phase: "micDenied",
      notice: null,
      seniorText: null,
      kasamaText: null,
    });
    expect(status.title).toBe("Kasama can't hear you yet.");
    expect(status.body).toMatch(/Settings/);
    expect(status.body).toMatch(/type/i);
    expect(status.showSettings).toBe(true);
    expect(status.recordEnabled).toBe(false);
  });

  it("disables record while the clip is going to the API", () => {
    const status = speechDebugStatus({
      phase: "thinking",
      notice: null,
      seniorText: SPEECH_DEBUG_DEMO_TRANSCRIPT,
      kasamaText: null,
    });
    expect(status.title).toMatch(/Kasama/);
    expect(status.body).toBe(SPEECH_DEBUG_DEMO_TRANSCRIPT);
    expect(status.recordEnabled).toBe(false);
  });

  it("lets the senior stop recording and interrupt speech", () => {
    expect(
      speechDebugStatus({
        phase: "listening",
        notice: null,
        seniorText: null,
        kasamaText: null,
      }).recordLabel,
    ).toBe("Stop");
    expect(
      speechDebugStatus({
        phase: "speaking",
        notice: null,
        seniorText: null,
        kasamaText: "I can help with that.",
      }).recordLabel,
    ).toBe("Stop");
  });
});
