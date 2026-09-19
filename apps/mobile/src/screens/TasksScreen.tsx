import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SeniorTask } from "@kasama/shared";
import { colors, radius, type } from "../theme";

type Props = {
  tasks: SeniorTask[];
};

/** Confirmed reminders and saved hospital visits (#41). */
export function TasksScreen({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <View style={styles.empty} accessibilityLabel="Tasks. Nothing here yet.">
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.body}>Nothing here yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tasks</Text>
      {tasks.map((task) => (
        <View
          key={task.id}
          style={styles.card}
          accessibilityLabel={`${task.title}. ${task.detail}${task.savedLocally ? ". Saved on this phone." : ""}`}
        >
          <View style={styles.iconWrap}>
            <Ionicons
              name={task.kind === "medication_reminder" ? "medical-outline" : "business-outline"}
              size={22}
              color={task.kind === "medication_reminder" ? colors.careBlue : colors.pin}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>
              {task.kind === "medication_reminder" ? "MEDICATION REMINDER" : "APPOINTMENT"}
            </Text>
            <Text style={styles.cardTitle}>{task.title}</Text>
            <Text style={styles.detail}>{task.detail}</Text>
            {task.savedLocally ? <Text style={styles.meta}>Saved on this phone</Text> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  title: {
    ...type.greeting,
    color: colors.ink,
    marginBottom: 8,
  },
  body: {
    ...type.label,
    color: colors.inkSoft,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.chatCard,
    borderRadius: radius.card,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.chatLine,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.careBlueIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.careBlue,
  },
  cardTitle: {
    ...type.cardTitle,
    color: colors.ink,
  },
  detail: {
    ...type.label,
    color: colors.inkSoft,
  },
  meta: {
    ...type.label,
    color: colors.pin,
    fontSize: 16,
  },
});
