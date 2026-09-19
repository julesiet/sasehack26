import { StyleSheet, Text, View } from "react-native";
import { colors, radius, type } from "../theme";

type Props = {
  speaker: "senior" | "kasama";
  text: string;
};

/** One line in the chat thread. Maria is the dark pill on the right. */
export function ChatBubble({ speaker, text }: Props) {
  const mine = speaker === "senior";
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowKasama]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.kasama]}>
        <Text style={[styles.text, mine ? styles.mineText : styles.kasamaText]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    marginBottom: 14,
  },
  rowMine: {
    alignItems: "flex-end",
  },
  rowKasama: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.bubble,
  },
  mine: {
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: 8,
  },
  kasama: {
    backgroundColor: colors.chatCard,
    borderBottomLeftRadius: 8,
  },
  text: {
    ...type.transcript,
    fontSize: 22,
    lineHeight: 30,
  },
  mineText: {
    color: colors.onUserBubble,
  },
  kasamaText: {
    color: colors.ink,
  },
});
