import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../theme";

const BARS = [0, 1, 2, 3, 4];

/** Five bars that rise and fall while Kasama listens. */
export function Waveform({ color = colors.micLive }: { color?: string }) {
  const values = useRef(BARS.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(value, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);

  return (
    <View style={styles.row} accessibilityElementsHidden>
      {values.map((value, index) => (
        <Animated.View key={index} style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: value }] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
  },
  bar: {
    width: 6,
    height: 32,
    borderRadius: 3,
  },
});
