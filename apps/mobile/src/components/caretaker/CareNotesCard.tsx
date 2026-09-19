import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../../theme";

type Props = {
  notes: string;
};

export function CareNotesCard({ notes }: Props) {
  return (
    <View style={styles.card} accessibilityLabel={`Care notes. ${notes}`}>
      <Text style={styles.label}>CARE NOTES</Text>
      <Text style={styles.body}>{notes}</Text>
    </View>
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
