import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HospitalVisitDetails } from "@kasama/shared";
import { colors, radius, size, type } from "../theme";

export type HospitalAppointmentStatus = "pending" | "saved" | "cancelled";

type Props = {
  visit: HospitalVisitDetails;
  status: HospitalAppointmentStatus;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Hospital scheduling card (#41). Confirm saves local appointment details.
 * Not live EHR.
 */
export function HospitalAppointmentCard({ visit, status, disabled, onConfirm, onCancel }: Props) {
  if (status === "saved") {
    return (
      <View style={[styles.card, styles.saved]} accessibilityLabel="Appointment details saved">
        <View style={styles.savedRow}>
          <Ionicons name="checkmark-circle" size={28} color={colors.saved} />
          <View style={styles.savedCopy}>
            <Text style={styles.savedTitle}>Appointment details saved</Text>
            <Text style={styles.savedPlace}>{visit.placeName}</Text>
          </View>
        </View>
        <Text style={styles.savedReason}>Reason: {visit.reason}</Text>
        <Text style={styles.savedTime}>{visit.timeLabel}</Text>
      </View>
    );
  }

  if (status === "cancelled") {
    return (
      <View style={styles.card} accessibilityLabel="Hospital appointment canceled">
        <Text style={styles.savedTitle}>Appointment not saved</Text>
        <Text style={styles.savedTime}>{visit.placeName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} accessibilityLabel="Appointment. I found the closest hospital.">
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="business-outline" size={22} color={colors.bowlTop} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>APPOINTMENT</Text>
          <Text style={styles.intro}>I found the closest hospital.</Text>
        </View>
      </View>

      <View style={styles.map} accessibilityLabel={`${visit.placeName}. ${visit.distance}`}>
        <View style={styles.pinDot}>
          <Ionicons name="location" size={22} color={colors.onOrange} />
        </View>
        <View style={styles.placeChip}>
          <Text style={styles.placeChipText}>{visit.placeName}</Text>
        </View>
        <Text style={styles.distance}>{visit.distance}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="clipboard-outline" size={22} color={colors.pin} />
          <View style={styles.detailCopy}>
            <Text style={styles.detailEyebrow}>APPOINTMENT REASON</Text>
            <Text style={styles.detailBody}>{visit.reason}</Text>
          </View>
        </View>
        <View style={styles.detailsDivider} />
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={22} color={colors.pin} />
          <View style={styles.detailCopy}>
            <Text style={styles.detailEyebrow}>SCHEDULED TIME</Text>
            <Text style={styles.detailBody}>{visit.timeLabel}</Text>
          </View>
        </View>
      </View>

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
  saved: {
    backgroundColor: colors.bookedWash,
    borderColor: colors.bookedWash,
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
    backgroundColor: "#FFE8D2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.bowlTop,
  },
  intro: {
    ...type.cardTitle,
    color: colors.ink,
  },
  map: {
    backgroundColor: colors.mapWash,
    borderRadius: 20,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  pinDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pin,
    alignItems: "center",
    justifyContent: "center",
  },
  placeChip: {
    backgroundColor: colors.control,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  placeChipText: {
    ...type.label,
    color: colors.ink,
    fontSize: 18,
  },
  distance: {
    ...type.label,
    color: colors.inkSoft,
    fontSize: 16,
  },
  details: {
    backgroundColor: colors.mapWash,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  detailCopy: {
    flex: 1,
    gap: 4,
  },
  detailEyebrow: {
    ...type.eyebrow,
    color: colors.pin,
  },
  detailBody: {
    ...type.cardTitle,
    color: colors.ink,
  },
  detailsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#CDE7DC",
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
  savedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  savedCopy: {
    flex: 1,
    gap: 2,
  },
  savedTitle: {
    ...type.cardTitle,
    color: colors.ink,
  },
  savedPlace: {
    ...type.transcript,
    color: colors.pin,
    fontSize: 22,
    lineHeight: 28,
  },
  savedReason: {
    ...type.cardTitle,
    color: colors.ink,
  },
  savedTime: {
    ...type.label,
    color: colors.inkSoft,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
