import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CaretakerTimelineItem } from "@kasama/shared";
import { colors, radius } from "../../theme";

type Props = {
  items: CaretakerTimelineItem[];
  expanded: boolean;
  onToggle: () => void;
};

const COLLAPSED_COUNT = 3;

export function ActivitySummary({ items, expanded, onToggle }: Props) {
  const visible = expanded ? items : items.slice(-COLLAPSED_COUNT);
  const canExpand = items.length > COLLAPSED_COUNT;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity Summary</Text>
        {canExpand ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Collapse activity" : "Expand activity"}
            hitSlop={12}
            style={({ pressed }) => [pressed ? styles.pressed : null]}
          >
            <Text style={styles.expand}>{expanded ? "Collapse" : "Expand >"}</Text>
          </Pressable>
        ) : items.length === 0 ? (
          <Text style={styles.expand}>None yet</Text>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>No conversation yet. Switch to Maria to talk to Kasama.</Text>
        </View>
      ) : (
        visible.map((item) => (
          <View key={item.id} style={styles.card} accessibilityLabel={`${item.title}. ${item.timeLabel}`}>
            <View
              style={[
                styles.avatar,
                item.actor === "kasama" ? styles.avatarKasama : styles.avatarMaria,
              ]}
            >
              <Text style={[styles.initial, item.actor === "kasama" ? styles.initialKasama : null]}>
                {item.initial}
              </Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.time}>{item.timeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.caretakerMuted} />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    color: colors.caretakerInk,
  },
  expand: {
    color: colors.caretakerLabel,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.caretakerCard,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#111111",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMaria: {
    backgroundColor: colors.caretakerAvatarSarah,
  },
  avatarKasama: {
    backgroundColor: colors.bowlTop,
  },
  initial: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.caretakerInk,
  },
  initialKasama: {
    color: colors.onOrange,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.caretakerInk,
  },
  time: {
    fontSize: 13,
    color: colors.caretakerMuted,
  },
  empty: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.caretakerMuted,
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
