import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ConversationTurn, LastApproval, PendingApproval } from "@kasama/shared";
import { ChatBubble } from "../components/ChatBubble";
import { ConfirmationCard } from "../components/ConfirmationCard";
import type { ConversationPhase } from "../hooks/useKasamaConversation";
import { confirmationFromPending } from "../lib/mvp-confirmation";
import { colors, type } from "../theme";

type Props = {
  phase: ConversationPhase;
  turns: ConversationTurn[];
  pendingApproval: PendingApproval | null;
  justResolved: LastApproval | null;
  notice: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
};

/**
 * Chat thread after Kasama's first reply. The composer and tab bar stay
 * outside this screen so they stay fixed.
 */
export function SeniorChatScreen({
  phase,
  turns,
  pendingApproval,
  justResolved,
  notice,
  onConfirm,
  onCancel,
  onOpenSettings,
}: Props) {
  const scroll = useRef<ScrollView>(null);
  const card = confirmationFromPending(pendingApproval, justResolved);
  const cardStatus = pendingApproval
    ? "pending"
    : justResolved?.decision === "approved"
      ? "approved"
      : justResolved
        ? "declined"
        : null;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scroll.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [turns.length, cardStatus]);

  return (
    <ScrollView
      ref={scroll}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
    >
      {turns.map((turn) => (
        <ChatBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
      ))}

      {phase === "thinking" ? <Text style={styles.hint}>Thinking…</Text> : null}
      {phase === "listening" ? <Text style={styles.hint}>I'm listening.</Text> : null}

      {card && cardStatus ? (
        <View style={styles.cardWrap}>
          <ConfirmationCard
            data={card}
            status={cardStatus}
            disabled={cardStatus === "pending" && phase === "thinking"}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {phase === "micDenied" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Kasama can't hear you yet.</Text>
          <Text style={styles.hint}>Allow the microphone in Settings, or type below.</Text>
          <Pressable onPress={onOpenSettings} accessibilityRole="button" style={styles.settings}>
            <Text style={styles.settingsLabel}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === "error" && notice ? <Text style={styles.error}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  cardWrap: {
    marginTop: 4,
    marginBottom: 12,
  },
  hint: {
    ...type.label,
    color: colors.inkSoft,
    marginBottom: 12,
  },
  notice: {
    gap: 10,
    marginTop: 8,
  },
  noticeTitle: {
    ...type.reply,
    color: colors.ink,
  },
  settings: {
    minHeight: 68,
    borderRadius: 22,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  error: {
    ...type.reply,
    color: colors.ink,
    marginTop: 8,
  },
});
