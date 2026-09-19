import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { healthSchema } from "@kasama/shared";

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

type Props = {
  onOpenSenior: () => void;
  onOpenCaretaker: () => void;
};

export function HomeScreen({ onOpenSenior, onOpenCaretaker }: Props) {
  const [devOpen, setDevOpen] = useState(false);
  const [health, setHealth] = useState("checking API…");

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((json) => {
        const parsed = healthSchema.safeParse(json);
        setHealth(parsed.success ? "API ok" : "API returned unexpected JSON");
      })
      .catch(() => {
        setHealth("API unreachable");
      });
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Kasama</Text>
      <Text style={styles.meta}>{health}</Text>
      {devOpen ? (
        <View style={styles.devPanel}>
          <Pressable style={styles.devButton} onPress={onOpenSenior}>
            <Text style={styles.devButtonLabel}>Senior</Text>
          </Pressable>
          <Pressable style={styles.devButton} onPress={onOpenCaretaker}>
            <Text style={styles.devButtonLabel}>Caretaker</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setDevOpen(true)} hitSlop={12}>
          <Text style={styles.devToggle}>Dev</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    marginBottom: 12,
  },
  meta: {
    fontSize: 16,
    marginBottom: 32,
  },
  devToggle: {
    fontSize: 14,
    color: "#888",
  },
  devPanel: {
    gap: 12,
    alignItems: "center",
  },
  devButton: {
    minWidth: 160,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#111",
  },
  devButtonLabel: {
    fontSize: 16,
    textAlign: "center",
  },
});
