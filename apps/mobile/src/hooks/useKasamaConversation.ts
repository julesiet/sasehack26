import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import {
  RecordingPresets,
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import {
  DEFAULT_SESSION_ID,
  MARIA_PROFILE,
  deviceSpeechRate,
  pendingRideOptionId,
  spokenRideChoice,
  spokenTextForTts,
  type ActiveRequest,
  type ApprovalChoice,
  type ConversationChat,
  type ConversationReplyKind,
  type ConversationTurn,
  type LastApproval,
  type PendingApproval,
  type SessionBooking,
  type SessionHospitalVisit,
  type SessionView,
  type SeniorTask,
  type UberRideOption,
} from "@kasama/shared";
import {
  ApiError,
  fetchKasamaVoice,
  fetchSession,
  postApproval,
  postConversationChat,
  postConversationTurn,
  transcribeRecording,
} from "../lib/api";

/**
 * Conversation phases. Each one maps to a designed state on the senior screen.
 *
 * idle       Greeting. Mic ready.
 * listening  Recording Maria. Tap mic again to finish.
 * thinking   Transcribing and waiting on Kasama's reply.
 * speaking   Kasama is talking. Tap mic to interrupt.
 * clarify    Kasama asked one question and is waiting for the answer.
 * approving  High-risk Yes / No is on screen. Voice still works.
 * micDenied  Microphone permission refused. Large-text recovery + typing.
 * error      Could not reach Kasama or hear the clip. Recoverable.
 */
export type ConversationPhase =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "clarify"
  | "approving"
  | "micDenied"
  | "error";

export type RideWork = "none" | "finding" | "booking";

export type ConversationUiState = {
  phase: ConversationPhase;
  /** What Maria said this turn (typed or transcribed). */
  seniorText: string | null;
  /** Kasama's latest reply. Stays visible after speaking finishes. */
  kasamaText: string | null;
  kasamaKind: ConversationReplyKind | null;
  /** Large-text message for `error`, or a hint when speech-to-text is unavailable. */
  notice: string | null;
  pendingApproval: PendingApproval | null;
  lastApproval: LastApproval | null;
  /** Saved/declined card for the decision we just made. Cleared on the next turn. */
  justResolved: LastApproval | null;
  turns: ConversationTurn[];
  chats: ConversationChat[];
  activeChatId: string | null;
  /** Null means the Chat tab is showing the list. */
  openedChatId: string | null;
  lastRideOptions: UberRideOption[];
  lastBooking: SessionBooking | null;
  lastHospitalVisit: SessionHospitalVisit | null;
  tasks: SeniorTask[];
  activeRequest: ActiveRequest | null;
  /** Ride-specific busy state so the screen never looks idle (#8). */
  rideWork: RideWork;
};

const MAX_RECORDING_MS = 15_000;
const SPEECH_LANGUAGE = "en-US";
const RIDE_WORDS = /\b(ride|uber|pickup|taxi|car|wheelchair|wav|uberx)\b/i;
const MARIA_PREFS = MARIA_PROFILE.communicationPreferences;

function sessionConversationFields(session: SessionView) {
  return {
    turns: session.conversation.turns,
    chats: session.conversation.chats ?? [],
    activeChatId: session.conversation.activeChatId ?? null,
    lastRideOptions: session.lastRideOptions,
    lastBooking: session.lastBooking,
    lastHospitalVisit: session.lastHospitalVisit,
    tasks: session.tasks,
    activeRequest: session.conversation.activeRequest,
    lastApproval: session.lastApproval,
    pendingApproval: session.pendingApproval,
  };
}

function looksLikeRide(text: string): boolean {
  return RIDE_WORDS.test(text);
}

export function useKasamaConversation(sessionId: string = DEFAULT_SESSION_ID) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<ConversationUiState>({
    phase: "idle",
    seniorText: null,
    kasamaText: null,
    kasamaKind: null,
    notice: null,
    pendingApproval: null,
    lastApproval: null,
    justResolved: null,
    turns: [],
    chats: [],
    activeChatId: null,
    openedChatId: null,
    lastRideOptions: [],
    lastBooking: null,
    lastHospitalVisit: null,
    tasks: [],
    activeRequest: null,
    rideWork: "none",
  });
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const mounted = useRef(true);
  const newChatOnNextTurn = useRef(false);

  const stopVoice = useCallback(() => {
    void Speech.stop();
    const player = playerRef.current;
    if (player) {
      player.pause();
      player.remove();
      playerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopVoice();
    };
  }, [stopVoice]);

  useEffect(() => {
    let cancelled = false;
    void fetchSession(sessionId)
      .then((session) => {
        if (cancelled || !mounted.current) return;
        setState((prev) => {
          if (prev.phase !== "idle" || prev.turns.length > 0) return prev;
          return {
            ...prev,
            ...sessionConversationFields(session),
          };
        });
      })
      .catch(() => {
        // Seeded history is optional; Maria can still start a new turn.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const patch = useCallback((next: Partial<ConversationUiState>) => {
    if (mounted.current) setState((prev) => ({ ...prev, ...next }));
  }, []);

  const speakWithDevice = useCallback(
    (text: string, settle: () => void) => {
      Speech.speak(text, {
        language: SPEECH_LANGUAGE,
        rate: deviceSpeechRate(MARIA_PREFS),
        onDone: settle,
        onStopped: settle,
        onError: settle,
      });
    },
    [],
  );

  const speak = useCallback(
    async (text: string, kind: ConversationReplyKind, pending: PendingApproval | null = null) => {
      const spoken = spokenTextForTts(text, MARIA_PREFS, {
        repeatConfirmation: pending?.tool === "book_ride" || pending?.tool === "notify_caretaker",
      });
      const settle = () =>
        patch({
          phase: kind === "clarification" ? "clarify" : pending ? "approving" : "idle",
          pendingApproval: pending,
        });
      stopVoice();
      patch({
        phase: "speaking",
        kasamaText: text,
        kasamaKind: kind,
        notice: null,
        pendingApproval: pending,
      });

      try {
        const bytes = await fetchKasamaVoice(spoken);
        if (!mounted.current) return;
        const file = new File(Paths.cache, "kasama-reply.mp3");
        if (!file.exists) file.create();
        file.write(bytes);
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        const player = createAudioPlayer({ uri: file.uri });
        playerRef.current = player;
        player.addListener("playbackStatusUpdate", (status) => {
          if (!status.didJustFinish) return;
          if (playerRef.current === player) {
            player.remove();
            playerRef.current = null;
          }
          settle();
        });
        player.play();
      } catch {
        if (!mounted.current) return;
        speakWithDevice(spoken, settle);
      }
    },
    [patch, speakWithDevice, stopVoice],
  );

  const sendTurn = useCallback(
    async (transcript: string, options?: { newChat?: boolean }) => {
      const clean = transcript.trim();
      if (!clean) return;
      const startFresh = options?.newChat ?? newChatOnNextTurn.current;
      newChatOnNextTurn.current = false;
      let chatId = state.openedChatId ?? state.activeChatId ?? undefined;
      let startedChats: ConversationChat[] | undefined;
      if (startFresh) {
        try {
          const started = await postConversationChat(sessionId);
          if (!mounted.current) return;
          chatId = started.chatId;
          startedChats = started.conversation.chats;
        } catch {
          patch({
            phase: "error",
            rideWork: "none",
            notice: "Kasama could not start a new chat. Please try again.",
          });
          return;
        }
      }
      const localTurn: ConversationTurn = {
        id: `local_${Date.now()}`,
        timestamp: new Date().toISOString(),
        speaker: "senior",
        text: clean,
      };
      setState((prev) => {
        const chats = startedChats ?? prev.chats;
        return {
          ...prev,
          phase: "thinking",
          seniorText: clean,
          notice: null,
          justResolved: null,
          openedChatId: chatId ?? prev.openedChatId,
          activeChatId: chatId ?? prev.activeChatId,
          rideWork:
            looksLikeRide(clean) && prev.lastRideOptions.length === 0 && !prev.lastBooking
              ? "finding"
              : "none",
          turns: [...(chats.find((chat) => chat.id === chatId)?.turns ?? prev.turns), localTurn],
          chats: chats.map((chat) =>
            chat.id === chatId ? { ...chat, turns: [...chat.turns, localTurn] } : chat,
          ),
        };
      });
      try {
        const reply = await postConversationTurn(clean, sessionId, chatId);
        const session = await fetchSession(sessionId);
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            ...sessionConversationFields(session),
            pendingApproval: reply.pendingApproval,
            justResolved:
              !reply.pendingApproval && prev.pendingApproval && session.lastApproval
                ? session.lastApproval
                : null,
            openedChatId: chatId ?? prev.openedChatId ?? session.conversation.activeChatId,
            rideWork: "none",
          }));
        }
        await speak(reply.reply, reply.kind, reply.pendingApproval);
      } catch (error) {
        patch({
          phase: "error",
          rideWork: "none",
          notice:
            error instanceof ApiError
              ? "Kasama had trouble with that. Please try again."
              : "I couldn't reach Kasama. Check the connection and try again.",
        });
      }
    },
    [patch, sessionId, speak, state.activeChatId, state.openedChatId],
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
        newChatOnNextTurn.current = false;
        patch({ phase: "error", notice: "I didn't catch that. Please try again, or type below." });
        return;
      }
      await sendTurn(transcript);
    } catch (error) {
      newChatOnNextTurn.current = false;
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
      newChatOnNextTurn.current = false;
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
      newChatOnNextTurn.current = false;
      patch({ phase: "error", notice: "The microphone isn't ready. Please try again, or type below." });
    }
  }, [patch, recorder, stopListening]);

  /** Primary mic button. Behaviour depends on the current phase. */
  const pressMic = useCallback(async (options?: { newChat?: boolean }) => {
    switch (state.phase) {
      case "listening":
        await stopListening();
        return;
      case "speaking":
        stopVoice();
        patch({
          phase:
            state.kasamaKind === "clarification"
              ? "clarify"
              : state.pendingApproval
                ? "approving"
                : "idle",
        });
        return;
      case "thinking":
        return;
      default:
        newChatOnNextTurn.current = Boolean(options?.newChat);
        await startListening();
    }
  }, [
    patch,
    startListening,
    state.kasamaKind,
    state.pendingApproval,
    state.phase,
    stopListening,
    stopVoice,
  ]);

  const submitText = useCallback(
    async (text: string, options?: { newChat?: boolean }) => {
      if (state.phase === "listening" || state.phase === "thinking") return;
      stopVoice();
      await sendTurn(text, options);
    },
    [sendTurn, state.phase, stopVoice],
  );

  const decideApproval = useCallback(
    async (decision: ApprovalChoice) => {
      if (state.phase === "listening" || state.phase === "thinking") return;
      stopVoice();
      const booking = decision === "approve" && state.pendingApproval?.tool === "book_ride";
      patch({ phase: "thinking", notice: null, rideWork: booking ? "booking" : "none" });
      try {
        const result = await postApproval(decision, sessionId);
        const session = await fetchSession(sessionId);
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            ...sessionConversationFields(session),
            pendingApproval: result.pendingApproval,
            lastApproval: result.lastApproval ?? session.lastApproval,
            justResolved: result.lastApproval ?? session.lastApproval,
            openedChatId: prev.openedChatId ?? session.conversation.activeChatId,
            rideWork: "none",
          }));
        }
        await speak(result.reply, "answer", result.pendingApproval);
      } catch {
        patch({
          phase: "error",
          rideWork: "none",
          notice: "Kasama could not save that yes or no. Please try again.",
        });
      }
    },
    [patch, sessionId, speak, state.pendingApproval?.tool, state.phase, stopVoice],
  );

  const selectRideOption = useCallback(
    async (option: UberRideOption) => {
      if (state.phase === "listening" || state.phase === "thinking") return;
      if (pendingRideOptionId(state.pendingApproval) === option.optionId) return;
      await sendTurn(spokenRideChoice(option.product), { newChat: false });
    },
    [sendTurn, state.pendingApproval, state.phase],
  );

  const openChatList = useCallback(() => {
    patch({ openedChatId: null });
  }, [patch]);

  const openCurrentThread = useCallback(() => {
    setState((prev) => ({
      ...prev,
      openedChatId: prev.activeChatId ?? prev.openedChatId,
    }));
  }, []);

  const openChat = useCallback(
    async (chatId: string) => {
      try {
        const result = await postConversationChat(sessionId, chatId);
        if (!mounted.current) return;
        setState((prev) => ({
          ...prev,
          turns: result.conversation.turns,
          chats: result.conversation.chats,
          activeChatId: result.conversation.activeChatId,
          openedChatId: result.chatId,
        }));
      } catch {
        patch({ openedChatId: chatId });
      }
    },
    [patch, sessionId],
  );

  const startNewChat = useCallback(async () => {
    try {
      const result = await postConversationChat(sessionId);
      if (!mounted.current) return;
      setState((prev) => ({
        ...prev,
        turns: result.conversation.turns,
        chats: result.conversation.chats,
        activeChatId: result.conversation.activeChatId,
        openedChatId: result.chatId,
      }));
    } catch {
      patch({
        phase: "error",
        notice: "Kasama could not start a new chat. Please try again.",
      });
    }
  }, [patch, sessionId]);

  const repeatLastReply = useCallback(() => {
    if (state.kasamaText && state.kasamaKind) {
      void speak(state.kasamaText, state.kasamaKind, state.pendingApproval);
    }
  }, [speak, state.kasamaKind, state.kasamaText, state.pendingApproval]);

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
    decideApproval,
    selectRideOption,
    repeatLastReply,
    openSettings,
    recheckMic,
    openChat,
    startNewChat,
    openChatList,
    openCurrentThread,
  };
}
