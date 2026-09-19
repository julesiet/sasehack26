import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ConfirmationCardData } from "../lib/mvp-confirmation";
import { colors, radius, size, type } from "../theme";

export type ConfirmationStatus = "pending" | "booking" | "approved" | "declined" | "failed";

type Props = {
  data: ConfirmationCardData;
  status: ConfirmationStatus;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Descriptive checkpoint from the chat mock: place, reason, time, then
 * Cancel / Confirm. Saved, booking, failed, and declined are the same card
 * without (or with disabled) buttons.
 */
export function ConfirmationCard({ data, status, disabled, onConfirm, onCancel }: Props) {
  const productLine = [data.productLabel ?? data.product, data.estimate].filter(Boolean).join(" · ");

  if (status === "approved") {
    return (
      <View style={[styles.card, styles.booked]} accessibilityLabel={`${data.eyebrow} booked`}>
        <View style={styles.savedRow}>
          <Ionicons name="checkmark-circle" size={28} color={colors.saved} />
          <Text style={styles.savedTitle}>{data.kind === "notify" ? "Message sent" : "Ride booked"}</Text>
        </View>
        {data.kind === "ride" && productLine ? <Text style={styles.savedPlace}>{productLine}</Text> : null}
        <Text style={styles.savedMeta}>{data.placeName}</Text>
        <Text style={styles.savedMeta}>{data.time}</Text>
        {data.confirmationId ? (
          <Text style={styles.confirmation}>Confirmation {data.confirmationId}</Text>
        ) : null}
      </View>
    );
  }

  if (status === "declined") {
    return (
      <View style={styles.card} accessibilityLabel={`${data.eyebrow} canceled`}>
        <Text style={styles.savedTitle}>{data.kind === "notify" ? "Message not sent" : "Ride canceled"}</Text>
        <Text style={styles.savedMeta}>{data.placeName}</Text>
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View style={[styles.card, styles.failed]} accessibilityLabel="Uber could not be booked">
        <View style={styles.savedRow}>
          <Ionicons name="alert-circle" size={28} color={colors.danger} />
          <Text style={styles.savedTitle}>Uber could not be booked</Text>
        </View>
        <Text style={styles.savedMeta}>
          {productLine || "Nothing was charged."} We can try again.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card} accessibilityLabel={`${data.eyebrow} confirmation`}>
      <Row icon="location-outline" label={data.eyebrow} body={data.intro} />
      <MapStub data={data} />
      <Row icon="clipboard-outline" label={data.reasonLabel} body={data.reason} />
      <Row icon="time-outline" label={data.timeLabel} body={data.time} />
      {productLine ? <Row icon="car-outline" label="Uber" body={productLine} /> : null}

      {status === "booking" ? <Text style={styles.booking}>Booking your Uber…</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          disabled={disabled || status === "booking"}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [
            styles.button,
            styles.cancel,
            disabled || status === "booking" ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={disabled || status === "booking"}
          accessibilityRole="button"
          accessibilityLabel="Confirm"
          style={({ pressed }) => [
            styles.button,
            styles.confirm,
            disabled || status === "booking" ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.confirmLabel}>Confirm</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ icon, label, body }: { icon: ComponentProps<typeof Ionicons>["name"]; label: string; body: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.pin} style={styles.rowIcon} />
      <View style={styles.rowCopy}>
        <Text style={styles.eyebrow}>{label.toUpperCase()}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

function MapStub({ data }: { data: ConfirmationCardData }) {
  if (data.kind === "notify") return null;
  return (
    <View style={styles.map} accessibilityLabel={`${data.placeName}. ${data.distance ?? ""}`}>
      <View style={styles.pinDot}>
        <Ionicons name="location" size={22} color={colors.onOrange} />
      </View>
      <View style={styles.placeChip}>
        <Text style={styles.placeChipText}>{data.placeName}</Text>
      </View>
      {data.distance ? <Text style={styles.distance}>{data.distance}</Text> : null}
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
  booked: {
    backgroundColor: colors.bookedWash,
    borderColor: colors.bookedWash,
  },
  failed: {
    backgroundColor: colors.failWash,
    borderColor: colors.failWash,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rowIcon: {
    marginTop: 2,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.pin,
  },
  body: {
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
    alignItems: "center",
    gap: 10,
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
  savedMeta: {
    ...type.label,
    color: colors.inkSoft,
  },
  confirmation: {
    ...type.cardTitle,
    color: colors.ink,
  },
  booking: {
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
