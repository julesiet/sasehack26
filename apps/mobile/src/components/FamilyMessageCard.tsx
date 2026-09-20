import { Pressable, StyleSheet, Text, View } from "react-native";
import { familyMessageCardCopy, type FamilyMessageStatus } from "@kasama/shared";
import { colors, radius, size, type } from "../theme";

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
      ? `${copy.eyebrow}. Preview only. Nothing is sent yet. ${copy.recipientName}, ${copy.relationshipLabel}. ${copy.summary}. Urgency ${copy.urgencyLabel}. Health information ${copy.healthLabel}.`
      : status === "sent"
        ? `${copy.eyebrow}. Sent. ${copy.recipientName}. ${copy.summary}.`
        : `${copy.eyebrow}. Not sent. ${copy.recipientName}. ${copy.summary}.`;

  return (
    <View style={styles.card} accessibilityLabel={accessibilityLabel}>
      <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      <View style={styles.introBlock}>
        <Text style={styles.intro}>{introFirst}</Text>
        {introRest ? <Text style={styles.intro}>{introRest}</Text> : null}
      </View>

      <View style={styles.facts}>
        <Fact label="Recipient" value={copy.recipientName} />
        <View style={styles.divider} />
        <Fact label="Relationship" value={copy.relationshipLabel} />
        <View style={styles.divider} />
        <Fact label="Message" value={copy.summary} />
        <View style={styles.divider} />
        <Fact label="Urgency" value={copy.urgencyLabel} />
        <View style={styles.divider} />
        <Fact
          label="Health information"
          value={`${copy.healthLabel}. ${copy.healthDetail}`}
        />
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
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
  introBlock: {
    gap: 4,
  },
  intro: {
    ...type.cardTitle,
    color: colors.ink,
  },
  facts: {
    gap: 12,
  },
  fact: {
    gap: 4,
  },
  factLabel: {
    ...type.label,
    color: colors.inkSoft,
  },
  factValue: {
    ...type.transcript,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.chatLine,
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
