import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme";

type Props = {
  notes: string;
  onPress?: () => void;
};

export function CareNotesCard({ notes, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Care notes. ${notes}`}
      accessibilityHint="Opens the care-aware update"
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
    >
      <Text style={styles.label}>CARE NOTES</Text>
      <Text style={styles.body}>{notes}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.caretakerNotes,
    borderRadius: 36,
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 16,
  },
  pressed: {
    opacity: 0.92,
  },
  label: {
    color: colors.caretakerNotesLabel,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  body: {
    color: colors.onOrange,
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 36,
  },
});
