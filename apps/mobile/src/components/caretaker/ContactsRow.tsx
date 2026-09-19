import { useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { FamilyContact } from "@kasama/shared";
import { colors } from "../../theme";

type Props = {
  contacts: FamilyContact[];
};

const AVATAR_COLORS = [
  colors.caretakerAvatarSarah,
  colors.caretakerAvatarJames,
  colors.caretakerAvatarEmily,
];

export function ContactsRow({ contacts }: Props) {
  const [sheet, setSheet] = useState<"all" | "invite" | null>(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts for Maria</Text>
        <Pressable
          onPress={() => setSheet("all")}
          accessibilityRole="button"
          accessibilityLabel="See all contacts"
          hitSlop={12}
          style={({ pressed }) => [pressed ? styles.pressed : null]}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <ContactChip
          label="Invite"
          onPress={() => setSheet("invite")}
          accessibilityLabel="Invite a contact. Invites are not sent in this demo."
        >
          <View style={[styles.avatar, styles.invite]}>
            <Ionicons name="add" size={28} color={colors.caretakerInk} />
          </View>
        </ContactChip>
        {contacts.map((contact, index) => (
          <ContactChip key={contact.id} label={contact.name}>
            <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
              <Text style={styles.initial}>{contact.initial}</Text>
            </View>
          </ContactChip>
        ))}
      </View>

      <Modal visible={sheet === "all"} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel="Close contacts">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Contacts for Maria</Text>
            {contacts.map((contact) => (
              <Text key={contact.id} style={styles.sheetLine}>
                {contact.name}
              </Text>
            ))}
            <Pressable onPress={() => setSheet(null)} accessibilityRole="button" style={styles.sheetClose}>
              <Text style={styles.sheetCloseLabel}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={sheet === "invite"} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel="Close invite">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Invite</Text>
            <Text style={styles.sheetLine}>Invites are not sent from this demo.</Text>
            <Pressable onPress={() => setSheet(null)} accessibilityRole="button" style={styles.sheetClose}>
              <Text style={styles.sheetCloseLabel}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ContactChip({
  label,
  children,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const inner = (
    <>
      {children}
      <Text style={styles.chipLabel}>{label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.chip}>{inner}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
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
  seeAll: {
    color: colors.caretakerLabel,
    fontSize: 16,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: 8,
  },
  chip: {
    alignItems: "center",
    gap: 8,
    minWidth: 68,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  invite: {
    backgroundColor: colors.caretakerCard,
  },
  initial: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.caretakerInk,
  },
  chipLabel: {
    fontSize: 14,
    color: colors.caretakerMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 16, 12, 0.4)",
    justifyContent: "flex-end",
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.caretakerCard,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  sheetTitle: {
    fontFamily: "Georgia",
    fontSize: 26,
    color: colors.caretakerInk,
  },
  sheetLine: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.caretakerInk,
  },
  sheetClose: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  sheetCloseLabel: {
    color: colors.onOrange,
    fontSize: 18,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
