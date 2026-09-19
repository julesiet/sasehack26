import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  onBack: () => void;
};

export function SeniorScreen({ onBack }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Senior</Text>
      <Text style={styles.meta}>Placeholder. Designs will replace this screen.</Text>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
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
    textAlign: "center",
    marginBottom: 24,
  },
  back: {
    fontSize: 16,
  },
});
