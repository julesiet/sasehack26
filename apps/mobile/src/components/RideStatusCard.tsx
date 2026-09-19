import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, type } from "../theme";

export type RideWork = "finding" | "booking";

type Props = {
  work: RideWork;
};

/**
 * In-progress ride status (#8). Must never look like the idle greeting.
 */
export function RideStatusCard({ work }: Props) {
  const finding = work === "finding";
  const title = finding ? "Finding Uber options." : "Booking your Uber.";
  const hint = finding ? "Checking your appointment…" : "Confirming the ride…";

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`${title} ${hint}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <Ionicons name="car-outline" size={22} color={colors.pin} style={styles.icon} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>CURRENT ACTION</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <View style={styles.track} accessibilityElementsHidden>
        <View style={styles.dot}>
          <Ionicons name="car" size={16} color={colors.onOrange} />
        </View>
        <View style={styles.line} />
        <View style={[styles.dot, styles.pin]}>
          <Ionicons name="location" size={16} color={colors.onOrange} />
        </View>
      </View>
      <Text style={styles.hint}>{hint}</Text>
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
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  icon: {
    marginTop: 2,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.pin,
  },
  title: {
    ...type.cardTitle,
    color: colors.ink,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  line: {
    flex: 1,
    height: 4,
    backgroundColor: colors.statusTrack,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    backgroundColor: colors.pin,
  },
  hint: {
    ...type.label,
    color: colors.inkSoft,
  },
});
