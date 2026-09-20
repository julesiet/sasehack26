import { StyleSheet, Text, View } from "react-native";
import { colors, type } from "../theme";

/** Placeholder. Task list comes later. */
export function TasksScreen() {
  return (
    <View style={styles.screen} accessibilityLabel="Tasks. Nothing here yet.">
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.body}>Nothing here yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    ...type.greeting,
    color: colors.ink,
  },
  body: {
    ...type.label,
    color: colors.inkSoft,
    textAlign: "center",
  },
});
