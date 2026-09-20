import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export type SeniorTab = "home" | "chat" | "tasks";

/** Tab row. The bar is taller by the home-indicator inset; tabs stay centered. */
export const SENIOR_TAB_ROW_HEIGHT = 40;

type Props = {
  active: SeniorTab;
  bottomInset: number;
  chatAvailable: boolean;
  onChange: (tab: SeniorTab) => void;
};

/**
 * Home is the sun welcome. Chat is the history list (current thread first).
 * Tasks lists confirmed reminders and saved hospital visits. On Home the
 * bar is 80% translucent so the sun shows through.
 */
export function SeniorTabBar({ active, bottomInset, chatAvailable, onChange }: Props) {
  const onHome = active === "home";
  const inset = Math.max(bottomInset, 8);
  return (
    <View
      style={[
        styles.bar,
        onHome ? styles.barHome : styles.barSolid,
        { height: SENIOR_TAB_ROW_HEIGHT + inset, justifyContent: "center" },
      ]}
    >
      <View style={styles.row}>
        <TabButton
          label="Home"
          icon={active === "home" ? "sunny" : "sunny-outline"}
          active={active === "home"}
          onPress={() => onChange("home")}
        />
        <TabButton
          label="Chat"
          icon={active === "chat" ? "chatbubble" : "chatbubble-outline"}
          active={active === "chat"}
          disabled={!chatAvailable}
          onPress={() => onChange("chat")}
        />
        <TabButton
          label="Tasks"
          icon={active === "tasks" ? "time" : "time-outline"}
          active={active === "tasks"}
          onPress={() => onChange("tasks")}
        />
      </View>
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = disabled ? colors.orbMuted : active ? colors.bowlTop : colors.inkSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, pressed && !disabled ? styles.pressed : null]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barSolid: {
    backgroundColor: colors.sky,
    borderTopColor: colors.chatLine,
  },
  barHome: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderTopColor: "transparent",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.7,
  },
});
