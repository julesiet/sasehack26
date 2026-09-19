import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SaveMedicationReminderInput } from "@kasama/shared";
import { colors, radius, size, type } from "../theme";

export type MedicationReminderStatus = "proposed" | "sync_failed";

type Props = {
  reminder: SaveMedicationReminderInput;
  status: MedicationReminderStatus;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Medication reminder (#41). Confirm only adds a Task — Kasama never
 * changes a prescription. Health-sync failure is the same card family.
 */
export function MedicationReminderCard({
  reminder,
  status,
  disabled,
  onConfirm,
  onCancel,
}: Props) {
  if (status === "sync_failed") {
    return (
      <View
        style={[styles.card, styles.failed]}
        accessibilityLabel="Couldn't save reminder. Health sync error. You can retry or save locally."
      >
        <View style={styles.failHeader}>
          <Ionicons name="alert-circle" size={28} color={colors.danger} />
          <View style={styles.failCopy}>
            <Text style={styles.failTitle}>Couldn't save reminder</Text>
            <Text style={styles.failSub}>Health sync error</Text>
          </View>
        </View>
        <Text style={styles.failBody}>
          We couldn't connect to your health provider. You can retry or save locally.
        </Text>
        <Actions disabled={disabled} onCancel={onCancel} onConfirm={onConfirm} confirmTone="care" />
      </View>
    );
  }

  const days = Math.max(1, reminder.intervalDays);

  return (
    <View style={[styles.card, styles.reminder]} accessibilityLabel="Medication reminder. Add this to your tasks?">
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="medical-outline" size={22} color={colors.careBlue} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MEDICATION REMINDER</Text>
          <Text style={styles.intro}>Add this to your tasks?</Text>
        </View>
      </View>

      <View style={styles.facts}>
        <View style={styles.factRow}>
          <Text style={styles.factLabel}>MEDICATION</Text>
          <Text style={styles.factValue}>{reminder.name}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.factRow}>
          <Text style={styles.factLabel}>FREQUENCY</Text>
          <Text style={styles.factValue}>{reminder.frequency}</Text>
        </View>
        <FrequencyTrack days={days} />
      </View>

      <Actions disabled={disabled} onCancel={onCancel} onConfirm={onConfirm} confirmTone="care" />
    </View>
  );
}

function FrequencyTrack({ days }: { days: number }) {
  const count = Math.min(Math.max(days, 2), 7);
  return (
    <View style={styles.track} accessibilityLabel={`${days} day cycle`}>
      {Array.from({ length: count }, (_, index) => {
        const n = index + 1;
        const filled = n === 1 || n === count;
        return (
          <View key={n} style={styles.trackItem}>
            {index > 0 ? <View style={styles.trackLine} /> : null}
            <View style={[styles.dot, filled ? styles.dotFilled : styles.dotMuted]}>
              <Text style={[styles.dotLabel, filled ? styles.dotLabelFilled : styles.dotLabelMuted]}>{n}</Text>
            </View>
          </View>
        );
      })}
      <Ionicons name="refresh" size={18} color={colors.careBlue} style={styles.loop} />
    </View>
  );
}

function Actions({
  disabled,
  onCancel,
  onConfirm,
  confirmTone,
}: {
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmTone: "care" | "sun";
}) {
  return (
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
          confirmTone === "care" ? styles.confirmCare : styles.confirmSun,
          disabled ? styles.disabled : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.confirmLabel}>Confirm</Text>
      </Pressable>
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
  reminder: {
    borderColor: colors.careBlueIcon,
  },
  failed: {
    backgroundColor: colors.failWash,
    borderColor: colors.failWash,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.careBlueIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.careBlue,
  },
  intro: {
    ...type.cardTitle,
    color: colors.ink,
  },
  facts: {
    borderWidth: 1,
    borderColor: colors.careBlueIcon,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  factLabel: {
    ...type.eyebrow,
    color: colors.careBlue,
  },
  factValue: {
    ...type.cardTitle,
    color: colors.ink,
    flexShrink: 1,
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.careBlueIcon,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  trackLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.careBlueMuted,
    marginRight: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFilled: {
    backgroundColor: colors.careBlue,
  },
  dotMuted: {
    backgroundColor: colors.careBlueIcon,
  },
  dotLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  dotLabelFilled: {
    color: colors.onOrange,
  },
  dotLabelMuted: {
    color: colors.careBlue,
  },
  loop: {
    marginLeft: 6,
  },
  failHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  failCopy: {
    flex: 1,
    gap: 2,
  },
  failTitle: {
    ...type.cardTitle,
    color: colors.danger,
  },
  failSub: {
    ...type.label,
    color: colors.danger,
  },
  failBody: {
    ...type.label,
    color: colors.danger,
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
  confirmCare: {
    backgroundColor: colors.careConfirm,
  },
  confirmSun: {
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
