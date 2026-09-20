import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { chatsNewestFirst, type ConversationChat } from "@kasama/shared";
import { colors, radius, type } from "../theme";

type Props = {
  chats: ConversationChat[];
  activeChatId: string | null;
  onOpen: (chatId: string) => void;
  onNewChat: () => void;
};

function chatTimeLabel(chat: ConversationChat): string {
  const stamp = chat.turns.at(-1)?.timestamp ?? chat.startedAt;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Chat tab list (#45). Newest thread first. Titles are short topic labels.
 */
export function ChatHistoryScreen({ chats, activeChatId, onOpen, onNewChat }: Props) {
  const rows = chatsNewestFirst(chats, activeChatId);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Chats</Text>
      {rows.map((chat) => (
        <Pressable
          key={chat.id}
          onPress={() => onOpen(chat.id)}
          accessibilityRole="button"
          accessibilityLabel={`${chat.title}${chat.id === activeChatId ? ", current" : ""}`}
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        >
          <View style={styles.copy}>
            {chat.id === activeChatId ? <Text style={styles.eyebrow}>CURRENT</Text> : null}
            <Text style={styles.title}>{chat.title}</Text>
            <Text style={styles.time}>{chatTimeLabel(chat)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.inkSoft} />
        </Pressable>
      ))}
      <Pressable
        onPress={onNewChat}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        style={({ pressed }) => [styles.newChat, pressed ? styles.pressed : null]}
      >
        <Ionicons name="add" size={28} color={colors.onOrange} />
        <Text style={styles.newChatLabel}>New chat</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  heading: {
    ...type.greeting,
    color: colors.ink,
    marginBottom: 8,
  },
  card: {
    minHeight: 68,
    backgroundColor: colors.chatCard,
    borderRadius: radius.card,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.chatLine,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.bowlTop,
  },
  title: {
    ...type.cardTitle,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
  },
  time: {
    ...type.label,
    color: colors.inkSoft,
  },
  newChat: {
    minHeight: 68,
    marginTop: 8,
    borderRadius: radius.button,
    backgroundColor: colors.bowlTop,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newChatLabel: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
