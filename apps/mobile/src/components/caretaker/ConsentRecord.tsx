import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CaretakerConsentItem, CaretakerConsentTone } from "@kasama/shared";
import { colors, radius } from "../../theme";

type Props = {
  items: CaretakerConsentItem[];
};

const TONE: Record<
  CaretakerConsentTone,
  { background: string; icon: ComponentProps<typeof Ionicons>["name"]; color: string }
> = {
  approved: {
    background: colors.caretakerConsentOk,
    icon: "checkmark-circle",
    color: colors.caretakerOk,
  },
  pending: {
    background: colors.caretakerConsentPending,
    icon: "time",
    color: colors.caretakerLabel,
  },
  neutral: {
    background: colors.caretakerConsentNeutral,
    icon: "shield-checkmark-outline",
    color: colors.caretakerMuted,
  },
};

export function ConsentRecord({ items }: Props) {
  return (
    <View style={styles.card} accessibilityLabel="Consent and approval record">
      <Text style={styles.label}>CONSENT / APPROVAL RECORD</Text>
      {items.map((item) => {
        const tone = TONE[item.tone];
        return (
          <View key={item.id} style={[styles.row, { backgroundColor: tone.background }]}>
            <Ionicons name={tone.icon} size={22} color={tone.color} />
            <View style={styles.copy}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.detail}>{item.detail}</Text>
            </View>
          </View>
        );
      })}
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
  label: {
    color: colors.caretakerLabel,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.caretakerInk,
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.caretakerMuted,
  },
});
