import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, type } from "../theme";

type Props = {
  visible: boolean;
  canRepeat: boolean;
  onClose: () => void;
  onRepeat: () => void;
  onHome: () => void;
};

/** The "•••" sheet. Few, large choices. */
export function OverflowMenu({ visible, canRepeat, onClose, onRepeat, onHome }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <MenuButton
            icon="volume-high"
            label="Say that again"
            disabled={!canRepeat}
            onPress={() => {
              onClose();
              onRepeat();
            }}
          />
          <MenuButton
            icon="home"
            label="Back to Home"
            onPress={() => {
              onClose();
              onHome();
            }}
          />
          <MenuButton icon="close" label="Close" onPress={onClose} subtle />
        </View>
      </Pressable>
    </Modal>
  );
}

type ButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  subtle?: boolean;
};

function MenuButton({ icon, label, onPress, disabled, subtle }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        subtle ? styles.buttonSubtle : null,
        disabled ? styles.buttonDisabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons name={icon} size={28} color={subtle ? colors.inkSoft : colors.onOrange} />
      <Text style={[styles.label, subtle ? styles.labelSubtle : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(40, 24, 8, 0.45)",
    justifyContent: "flex-end",
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.control,
    borderRadius: 32,
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 72,
    paddingHorizontal: 24,
    borderRadius: radius.button,
    backgroundColor: colors.bowlTop,
  },
  buttonSubtle: {
    backgroundColor: colors.pill,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  label: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  labelSubtle: {
    color: colors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});
