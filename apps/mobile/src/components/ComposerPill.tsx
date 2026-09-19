import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ConversationPhase } from "../hooks/useKasamaConversation";
import { colors, radius, size, type } from "../theme";
import { Waveform } from "./Waveform";

type Props = {
  phase: ConversationPhase;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onPressMic: () => void;
  onPressMore: () => void;
};

/**
 * The bottom control from the baseline: a peach pill holding a text field and the
 * mic button, plus a separate overflow button. Contents follow the phase.
 */
export const ComposerPill = forwardRef<TextInput, Props>(function ComposerPill(
  { phase, value, onChangeText, onSubmit, onPressMic, onPressMore },
  ref,
) {
  const listening = phase === "listening";
  const thinking = phase === "thinking";
  const speaking = phase === "speaking";
  const denied = phase === "micDenied";

  const micIcon: keyof typeof Ionicons.glyphMap = listening
    ? "stop"
    : speaking
      ? "stop"
      : denied
        ? "mic-off"
        : "mic";

  const micLabel = listening
    ? "Done talking"
    : speaking
      ? "Stop Kasama"
      : thinking
        ? "Kasama is thinking"
        : denied
          ? "Microphone is off"
          : "Talk to Kasama";

  const placeholder =
    phase === "clarify"
      ? "Your answer"
      : phase === "approving"
        ? "Or say yes or no"
        : denied
          ? "Type here"
          : "";

  return (
    <View style={styles.row}>
      <View style={[styles.pill, listening ? styles.pillActive : null]}>
        <View style={styles.left}>
          {listening ? (
            <Waveform />
          ) : thinking ? (
            <Text style={styles.thinkingDots} accessibilityLabel="Kasama is thinking">
              • • •
            </Text>
          ) : (
            <TextInput
              ref={ref}
              value={value}
              onChangeText={onChangeText}
              onSubmitEditing={onSubmit}
              placeholder={placeholder}
              placeholderTextColor={colors.inkSoft}
              returnKeyType="send"
              blurOnSubmit
              editable={!speaking}
              style={styles.input}
              accessibilityLabel="Type to Kasama"
              cursorColor={colors.caret}
              selectionColor={colors.caret}
            />
          )}
        </View>
        <Pressable
          onPress={onPressMic}
          disabled={thinking}
          accessibilityRole="button"
          accessibilityLabel={micLabel}
          hitSlop={8}
          style={({ pressed }) => [
            styles.mic,
            listening ? styles.micLive : null,
            thinking ? styles.micDisabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons
            name={micIcon}
            size={size.iconLg}
            color={listening ? colors.micLiveIcon : denied ? colors.inkSoft : colors.controlIcon}
          />
        </Pressable>
      </View>
      <Pressable
        onPress={onPressMore}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ pressed }) => [styles.more, pressed ? styles.pressed : null]}
      >
        <Ionicons name="ellipsis-horizontal" size={size.iconMd} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pill: {
    flex: 1,
    height: size.pillHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.pill,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 26,
    paddingRight: 8,
  },
  pillActive: {
    backgroundColor: colors.pillActive,
  },
  left: {
    flex: 1,
    justifyContent: "center",
  },
  input: {
    ...type.input,
    color: colors.ink,
    paddingVertical: 0,
  },
  thinkingDots: {
    ...type.label,
    color: colors.inkSoft,
    letterSpacing: 2,
  },
  mic: {
    width: size.micButton,
    height: size.micButton,
    borderRadius: size.micButton / 2,
    backgroundColor: colors.control,
    alignItems: "center",
    justifyContent: "center",
  },
  micLive: {
    backgroundColor: colors.micLive,
  },
  micDisabled: {
    opacity: 0.55,
  },
  more: {
    width: size.overflowWidth,
    height: size.pillHeight,
    borderRadius: radius.overflow,
    backgroundColor: colors.control,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});
