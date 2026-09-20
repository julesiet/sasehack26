import { Pressable, StyleSheet, Text, View } from "react-native";
import { familyMessageCardCopy } from "@kasama/shared";
import { colors, radius, size, type } from "../theme";

export type FamilyMessageStatus = "pending" | "sent" | "cancelled";

type Props = {
  recipientName: string;
  summary: string;
  urgency: "low" | "normal" | "high";
  status: FamilyMessageStatus;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Family email preview (#11). Confirm sends after a human checkpoint.
 * Showing this card is not the same as sending.
 */
export function FamilyMessageCard({
  recipientName,
  summary,
  urgency,
  status,
  disabled,
  onConfirm,
  onCancel,
}: Props) {
  const copy = familyMessageCardCopy({ recipientName, summary, urgency, status });
  const [introFirst, introRest] = copy.intro.split("\n");
  const accessibilityLabel =
    status === "pending"
      ? `${copy.eyebrow}. ${copy.recipientName}. Preview only. Nothing is sent yet.`
      : status === "sent"
        ? `${copy.eyebrow}. Sent.`
        : `${copy.eyebrow}. Not sent.`;

  return (
    <View style={styles.card} accessibilityLabel={accessibilityLabel}>
      <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      <Text style={styles.recipient}>{copy.recipientName}</Text>
      <View style={styles.introBlock}>
        <Text style={styles.intro}>{introFirst}</Text>
        {introRest ? <Text style={styles.intro}>{introRest}</Text> : null}
      </View>
      <Text style={styles.summary}>{copy.summary}</Text>
      <View style={styles.urgency}>
        <Text style={styles.urgencyLabel}>Urgency</Text>
        <Text style={styles.urgencyValue}>{copy.urgencyLabel}</Text>
      </View>

      {status === "pending" ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [
              styles.button,
              styles.cancel,
              disabled ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Confirm"
            style={({ pressed }) => [
              styles.button,
              styles.confirm,
              disabled ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.confirmLabel}>Confirm</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.chatCard,
    borderRadius: radius.card,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.chatLine,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.bowlTop,
  },
  recipient: {
    ...type.reply,
    color: colors.ink,
  },
  introBlock: {
    gap: 4,
  },
  intro: {
    ...type.cardTitle,
    color: colors.ink,
  },
  summary: {
    ...type.transcript,
    color: colors.ink,
  },
  urgency: {
    gap: 4,
  },
  urgencyLabel: {
    ...type.label,
    color: colors.inkSoft,
  },
  urgencyValue: {
    ...type.cardTitle,
    color: colors.ink,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    minHeight: size.yesNo,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: {
    backgroundColor: colors.cancelFill,
  },
  confirm: {
    backgroundColor: colors.bowlTop,
  },
  cancelLabel: {
    ...type.button,
    color: colors.ink,
    fontWeight: "600",
  },
  confirmLabel: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
