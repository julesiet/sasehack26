import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Speech from "expo-speech";
import { DEFAULT_SESSION_ID, type ConversationReplyKind } from "@kasama/shared";
import { ApiError, postConversationTurn, transcribeRecording } from "../lib/api";

/**
 * Conversation phases. Each one maps to a designed state on the senior screen.
 *
 * idle       Greeting. Mic ready.
 * listening  Recording Maria. Tap mic again to finish.
 * thinking   Transcribing and waiting on Kasama's reply.
 * speaking   Kasama is talking. Tap mic to interrupt.
 * clarify    Kasama asked one question and is waiting for the answer.
 * micDenied  Microphone permission refused. Large-text recovery + typing.
 * error      Could not reach Kasama or hear the clip. Recoverable.
 */
export type ConversationPhase =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "clarify"
  | "micDenied"
  | "error";

export type ConversationUiState = {
  phase: ConversationPhase;
  /** What Maria said this turn (typed or transcribed). */
  seniorText: string | null;
  /** Kasama's latest reply. Stays visible after speaking finishes. */
  kasamaText: string | null;
  kasamaKind: ConversationReplyKind | null;
  /** Large-text message for `error`, or a hint when speech-to-text is unavailable. */
  notice: string | null;
};

const MAX_RECORDING_MS = 15_000;
const SPEECH_LANGUAGE = "en-US";
const SPEECH_RATE = 0.92;

export function useKasamaConversation(sessionId: string = DEFAULT_SESSION_ID) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<ConversationUiState>({
    phase: "idle",
    seniorText: null,
    kasamaText: null,
    kasamaKind: null,
    notice: null,
  });
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (stopTimer.current) clearTimeout(stopTimer.current);
      Speech.stop();
    };
  }, []);

  const patch = useCallback((next: Partial<ConversationUiState>) => {
    if (mounted.current) setState((prev) => ({ ...prev, ...next }));
  }, []);

  const speak = useCallback(
    (text: string, kind: ConversationReplyKind) => {
      const settle = () => patch({ phase: kind === "clarification" ? "clarify" : "idle" });
      patch({ phase: "speaking", kasamaText: text, kasamaKind: kind, notice: null });
      Speech.stop();
      Speech.speak(text, {
        language: SPEECH_LANGUAGE,
        rate: SPEECH_RATE,
        onDone: settle,
        onStopped: settle,
        onError: settle,
      });
    },
    [patch],
  );

  const sendTurn = useCallback(
    async (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) return;
      patch({ phase: "thinking", seniorText: clean, notice: null });
      try {
        const reply = await postConversationTurn(clean, sessionId);
        speak(reply.reply, reply.kind);
      } catch (error) {
        patch({
          phase: "error",
          notice:
            error instanceof ApiError
              ? "Kasama had trouble with that. Please try again."
              : "I couldn't reach Kasama. Check the connection and try again.",
        });
      }
    },
    [patch, sessionId, speak],
  );

  const stopListening = useCallback(async () => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    patch({ phase: "thinking", notice: null });
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording");
      const transcript = await transcribeRecording(uri);
      if (!transcript.trim()) {
        patch({ phase: "error", notice: "I didn't catch that. Please try again, or type below." });
        return;
      }
      await sendTurn(transcript);
    } catch (error) {
      if (error instanceof ApiError && error.code === "stt_not_configured") {
        patch({
          phase: "idle",
          notice: "Kasama can't hear on this setup yet. Please type what you need below.",
        });
        return;
      }
      console.warn("[kasama] transcribe failed", error);
      patch({ phase: "error", notice: "I couldn't hear that clearly. Please try again, or type below." });
    }
  }, [patch, recorder, sendTurn]);

  const startListening = useCallback(async () => {
    let permission = await getRecordingPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await requestRecordingPermissionsAsync();
    }
    if (!permission.granted) {
      patch({ phase: "micDenied", notice: null });
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      patch({ phase: "listening", seniorText: null, notice: null });
      stopTimer.current = setTimeout(() => {
        void stopListening();
      }, MAX_RECORDING_MS);
    } catch {
      patch({ phase: "error", notice: "The microphone isn't ready. Please try again, or type below." });
    }
  }, [patch, recorder, stopListening]);

  /** Primary mic button. Behaviour depends on the current phase. */
  const pressMic = useCallback(async () => {
    switch (state.phase) {
      case "listening":
        await stopListening();
        return;
      case "speaking":
        await Speech.stop();
        return;
      case "thinking":
        return;
      default:
        await startListening();
    }
  }, [startListening, state.phase, stopListening]);

  const submitText = useCallback(
    async (text: string) => {
      if (state.phase === "listening" || state.phase === "thinking") return;
      await Speech.stop();
      await sendTurn(text);
    },
    [sendTurn, state.phase],
  );

  const repeatLastReply = useCallback(() => {
    if (state.kasamaText && state.kasamaKind) speak(state.kasamaText, state.kasamaKind);
  }, [speak, state.kasamaKind, state.kasamaText]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  /** Re-check permission after the senior returns from Settings. */
  const recheckMic = useCallback(async () => {
    const permission = await getRecordingPermissionsAsync();
    if (permission.granted) patch({ phase: "idle", notice: null });
  }, [patch]);

  return {
    state,
    pressMic,
    submitText,
    repeatLastReply,
    openSettings,
    recheckMic,
  };
}
