import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export type SeniorTab = "home" | "chat" | "tasks";

type Props = {
  active: SeniorTab;
  bottomInset: number;
  chatAvailable: boolean;
  onChange: (tab: SeniorTab) => void;
};

/**
 * Home is the sun welcome. Chat is the last started conversation.
 * Tasks is empty. Active icon and label use the sun orange.
 */
export function SeniorTabBar({ active, bottomInset, chatAvailable, onChange }: Props) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 4) }]}>
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
    flexDirection: "row",
    backgroundColor: colors.sky,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.chatLine,
    paddingTop: 4,
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
