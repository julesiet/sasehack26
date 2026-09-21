import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ComposerPill } from "../components/ComposerPill";
import { OverflowMenu } from "../components/OverflowMenu";
import {
  SENIOR_TAB_ROW_HEIGHT,
  SeniorTabBar,
  type SeniorTab,
} from "../components/SeniorTabBar";
import { SunBowl } from "../components/SunBowl";
import { SunOrb, type OrbMode } from "../components/SunOrb";
import {
  useKasamaConversation,
  type ConversationPhase,
} from "../hooks/useKasamaConversation";
import { colors, radius, size, type } from "../theme";
import { SeniorChatScreen } from "./SeniorChatScreen";
import { TasksScreen } from "./TasksScreen";
import { ChatHistoryScreen } from "./ChatHistoryScreen";

type Props = {
  onBack: () => void;
};

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function orbModeFor(phase: ConversationPhase): OrbMode {
  switch (phase) {
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
    case "approving":
      return "speaking";
    case "micDenied":
      return "muted";
    default:
      return "idle";
  }
}

/**
 * Senior mode. Home is the sun welcome; talking there starts a new Chat
 * row and makes it current. Chat is the history list, then a titled
 * thread. Tasks lists confirmed reminders and saved hospital visits.
 * Composer stays on Home and on an open thread, above a compact tab bar.
 */
export function SeniorScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const {
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
  } = useKasamaConversation();
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<SeniorTab>("home");
  const inputRef = useRef<TextInput>(null);
  const chatStarted = Boolean(state.kasamaText) || state.turns.some((turn) => turn.speaker === "kasama");
  const chatAvailable = chatStarted || state.chats.length > 0;
  const openedThread = state.chats.find((chat) => chat.id === state.openedChatId);
  const onHome = tab === "home";
  const onChat = tab === "chat";
  const onTasks = tab === "tasks";
  const onList = onChat && !openedThread;

  useEffect(() => {
    if (
      state.kasamaText &&
      (state.phase === "speaking" || state.phase === "clarify" || state.phase === "approving")
    ) {
      AccessibilityInfo.announceForAccessibility(state.kasamaText);
    }
  }, [state.kasamaText, state.phase]);

  useEffect(() => {
    if (state.phase !== "micDenied") return;
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") void recheckMic();
    });
    return () => sub.remove();
  }, [recheckMic, state.phase]);

  useEffect(() => {
    if (state.phase === "idle" && state.notice && !onTasks) inputRef.current?.focus();
  }, [onTasks, state.notice, state.phase]);

  useEffect(() => {
    if (tab !== "home") return;
    if (
      state.phase !== "thinking" &&
      state.phase !== "speaking" &&
      state.phase !== "clarify" &&
      state.phase !== "approving"
    ) {
      return;
    }
    const chatId = state.openedChatId ?? state.activeChatId;
    if (!chatId) return;
    if (!state.openedChatId) openCurrentThread();
    setTab("chat");
  }, [
    openCurrentThread,
    state.activeChatId,
    state.openedChatId,
    state.phase,
    tab,
  ]);

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void submitText(text, { newChat: onHome });
  };

  const selectTab = (next: SeniorTab) => {
    if (next === "chat" && !chatAvailable) {
      setTab("home");
      return;
    }
    if (next === "chat") openChatList();
    setTab(next);
  };

  const muted = state.phase === "micDenied";

  return (
    <View style={styles.screen}>
      {onHome ? (
        <>
          <LinearGradient
            colors={
              muted
                ? [colors.sky, colors.sky, colors.skyMutedSoft, colors.skyMutedWarm]
                : [colors.sky, colors.sky, colors.skyGlowSoft, colors.skyGlowWarm]
            }
            locations={[0, 0.42, 0.62, 0.86]}
            style={StyleSheet.absoluteFill}
          />
          <SunBowl crest={0.66} muted={muted} />
        </>
      ) : (
        <View pointerEvents="none" style={styles.chatBackdrop} />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.column}
        keyboardVerticalOffset={0}
      >
        <View style={styles.main}>
          {onTasks ? (
            <View style={[styles.pane, { paddingTop: insets.top + 12 }]}>
              <TasksScreen tasks={state.tasks} />
            </View>
          ) : onList ? (
            <View style={[styles.pane, { paddingTop: insets.top + 12 }]}>
              <ChatHistoryScreen
                chats={state.chats}
                activeChatId={state.activeChatId}
                onOpen={(chatId) => void openChat(chatId)}
                onNewChat={() => void startNewChat()}
              />
            </View>
          ) : onChat && openedThread ? (
            <View style={[styles.pane, { paddingTop: insets.top + 12 }]}>
              <SeniorChatScreen
                title={openedThread.title}
                intent={openedThread.intent}
                liveCards={openedThread.id === state.activeChatId}
                phase={state.phase}
                turns={openedThread.turns}
                pendingApproval={state.pendingApproval}
                justResolved={state.justResolved}
                lastRideOptions={state.lastRideOptions}
                lastBooking={state.lastBooking}
                lastHospitalVisit={state.lastHospitalVisit}
                activeRequest={state.activeRequest}
                rideWork={state.rideWork}
                notice={state.notice}
                onBack={openChatList}
                onSelectRide={(option) => void selectRideOption(option)}
                onConfirm={() => void decideApproval("approve")}
                onCancel={() => void decideApproval("decline")}
                onOpenSettings={openSettings}
              />
            </View>
          ) : (
            <View style={[styles.stage, { paddingTop: insets.top + 48 }]}>
              <SunOrb mode={orbModeFor(state.phase)} />
              <Headline state={state} onOpenSettings={openSettings} />
            </View>
          )}
        </View>

        {!onTasks && !onList ? (
          <View style={styles.composer}>
            <ComposerPill
              ref={inputRef}
              phase={state.phase}
              value={draft}
              onChangeText={setDraft}
              onSubmit={handleSubmit}
              onPressMic={() => void pressMic({ newChat: onHome })}
              onPressMore={() => setMenuOpen(true)}
            />
          </View>
        ) : null}
        <View style={{ height: SENIOR_TAB_ROW_HEIGHT + Math.max(insets.bottom, 8) }} />
      </KeyboardAvoidingView>

      <SeniorTabBar
        active={tab}
        bottomInset={insets.bottom}
        chatAvailable={chatAvailable}
        onChange={selectTab}
      />

      <OverflowMenu
        visible={menuOpen}
        canRepeat={Boolean(state.kasamaText)}
        onClose={() => setMenuOpen(false)}
        onRepeat={repeatLastReply}
        onHome={onBack}
      />
    </View>
  );
}

type HeadlineProps = {
  state: ReturnType<typeof useKasamaConversation>["state"];
  onOpenSettings: () => void;
};

function Headline({ state, onOpenSettings }: HeadlineProps) {
  switch (state.phase) {
    case "listening":
      return (
        <View style={styles.headline}>
          <Text style={styles.reply}>I'm listening.</Text>
          <Text style={styles.hint}>Tap the orange button when you're done.</Text>
        </View>
      );
    case "thinking":
      return (
        <View style={styles.headline}>
          {state.seniorText ? <Text style={styles.transcript}>“{state.seniorText}”</Text> : null}
          <Text style={styles.hint}>
            {state.rideWork === "finding"
              ? "Finding Ubers…"
              : state.rideWork === "booking"
                ? "Booking your Uber…"
                : "Thinking…"}
          </Text>
        </View>
      );
    case "micDenied":
      return (
        <View style={styles.headline}>
          <Text style={styles.reply}>Kasama can't hear you yet.</Text>
          <Text style={styles.body}>
            Allow the microphone in Settings, or type what you need below.
          </Text>
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryButtonLabel}>Open Settings</Text>
          </Pressable>
        </View>
      );
    case "error":
      return (
        <View style={styles.headline}>
          <Text style={styles.reply}>{state.notice}</Text>
        </View>
      );
    default:
      return (
        <View style={styles.headline}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          {state.notice ? <Text style={styles.body}>{state.notice}</Text> : null}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sky,
  },
  chatBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#F7F5F2",
  },
  column: {
    flex: 1,
  },
  main: {
    flex: 1,
    minHeight: 0,
  },
  pane: {
    flex: 1,
    minHeight: 0,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: size.screenGutter,
  },
  headline: {
    alignItems: "center",
    gap: 14,
    marginTop: 8,
    maxWidth: 360,
  },
  greeting: {
    ...type.greeting,
    color: colors.greeting,
    textAlign: "center",
  },
  reply: {
    ...type.reply,
    color: colors.ink,
    textAlign: "center",
  },
  transcript: {
    ...type.transcript,
    color: colors.inkSoft,
    textAlign: "center",
  },
  body: {
    ...type.label,
    color: colors.inkSoft,
    textAlign: "center",
  },
  hint: {
    ...type.label,
    color: colors.inkSoft,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 8,
    minHeight: 68,
    paddingHorizontal: 32,
    borderRadius: radius.button,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonLabel: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
  composer: {
    paddingHorizontal: size.screenGutter,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
