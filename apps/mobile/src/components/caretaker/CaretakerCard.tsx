import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../../theme";

type CardProps = {
  children: ReactNode;
  accessibilityLabel?: string;
};

/** White dashboard card used on caretaker Overview and the care-aware view. */
export function CaretakerCard({ children, accessibilityLabel }: CardProps) {
  return (
    <View style={styles.card} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export function CaretakerCardHeader({
  label,
  icon,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.caretakerLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.caretakerCard,
    borderRadius: radius.card,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 12,
    shadowColor: "#111111",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: colors.caretakerLabel,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    flex: 1,
    paddingRight: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF4EA",
    alignItems: "center",
    justifyContent: "center",
  },
});
