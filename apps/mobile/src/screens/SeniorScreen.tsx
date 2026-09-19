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
import { SunBowl } from "../components/SunBowl";
import { SunOrb, type OrbMode } from "../components/SunOrb";
import {
  useKasamaConversation,
  type ConversationPhase,
} from "../hooks/useKasamaConversation";
import { colors, radius, size, type } from "../theme";

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
      return "speaking";
    case "micDenied":
      return "muted";
    default:
      return "idle";
  }
}

/**
 * Senior mode: Maria talks to Kasama. One chrome (sky, sun bowl, composer pill);
 * the orb, headline, and pill contents change with the conversation phase.
 * Ride cards and confirmation are #8 and are not on this screen.
 */
export function SeniorScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { state, pressMic, submitText, repeatLastReply, openSettings, recheckMic } =
    useKasamaConversation();
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Read Kasama's replies to VoiceOver users as they arrive.
  useEffect(() => {
    if (state.kasamaText && (state.phase === "speaking" || state.phase === "clarify")) {
      AccessibilityInfo.announceForAccessibility(state.kasamaText);
    }
  }, [state.kasamaText, state.phase]);

  // Coming back from Settings after allowing the mic.
  useEffect(() => {
    if (state.phase !== "micDenied") return;
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") void recheckMic();
    });
    return () => sub.remove();
  }, [recheckMic, state.phase]);

  // When speech-to-text is unavailable, point Maria at the keyboard.
  useEffect(() => {
    if (state.phase === "idle" && state.notice) inputRef.current?.focus();
  }, [state.notice, state.phase]);

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void submitText(text);
  };

  // Long replies need more sky: the sun sits lower while Kasama's words are on screen.
  const showingReply =
    state.phase === "speaking" ||
    state.phase === "clarify" ||
    state.phase === "error" ||
    state.phase === "micDenied" ||
    (state.phase === "idle" && Boolean(state.kasamaText));

  const muted = state.phase === "micDenied";

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={
          muted
            ? [colors.sky, colors.sky, colors.skyMutedSoft, colors.skyMutedWarm]
            : [colors.sky, colors.sky, colors.skyGlowSoft, colors.skyGlowWarm]
        }
        locations={[0, 0.42, 0.62, 0.86]}
        style={StyleSheet.absoluteFill}
      />
      <SunBowl crest={showingReply ? 0.74 : 0.66} muted={muted} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <View style={[styles.stage, { paddingTop: insets.top + 48 }]}>
          <SunOrb mode={orbModeFor(state.phase)} />
          <Headline state={state} onOpenSettings={openSettings} />
        </View>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <ComposerPill
            ref={inputRef}
            phase={state.phase}
            value={draft}
            onChangeText={setDraft}
            onSubmit={handleSubmit}
            onPressMic={() => void pressMic()}
            onPressMore={() => setMenuOpen(true)}
          />
        </View>
      </KeyboardAvoidingView>

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

/** Large text under the orb. What it says depends on the phase. */
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
          <Text style={styles.hint}>Thinking…</Text>
        </View>
      );
    case "speaking":
    case "clarify":
      return (
        <View style={styles.headline}>
          <Text style={styles.speaker}>Kasama</Text>
          <ReplyText>{state.kasamaText}</ReplyText>
          {state.phase === "clarify" ? (
            <Text style={styles.hint}>You can answer out loud or type below.</Text>
          ) : null}
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
          {state.kasamaText ? (
            <>
              <Text style={styles.speaker}>Kasama</Text>
              <ReplyText>{state.kasamaText}</ReplyText>
            </>
          ) : (
            <Text style={styles.greeting}>{getGreeting()}</Text>
          )}
          {state.notice ? <Text style={styles.body}>{state.notice}</Text> : null}
        </View>
      );
  }
}

/** Kasama's words. Long replies shrink a little (never below ~25pt) instead of running into the sun. */
function ReplyText({ children }: { children: string | null }) {
  return (
    <Text style={styles.reply} numberOfLines={7} adjustsFontSizeToFit minimumFontScale={0.85}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sky,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  stage: {
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
  speaker: {
    ...type.label,
    color: colors.inkSoft,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 16,
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
  },
});
