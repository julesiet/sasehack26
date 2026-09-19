import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, size } from "../theme";

export type OrbMode = "idle" | "listening" | "thinking" | "speaking" | "muted";

type Props = {
  mode: OrbMode;
};

/**
 * Kasama's sun. The one element that changes with every phase:
 * idle breathes, listening sends out rings, thinking turns, speaking glows, muted goes gray.
 */
export function SunOrb({ mode }: Props) {
  const breathe = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    breathe.setValue(1);
    ring.setValue(0);
    spin.setValue(0);

    const loops: Animated.CompositeAnimation[] = [];

    if (mode === "idle") {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, { toValue: 1.05, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(breathe, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      );
    }

    if (mode === "listening" || mode === "speaking") {
      loops.push(
        Animated.loop(
          Animated.timing(ring, {
            toValue: 1,
            duration: mode === "listening" ? 1400 : 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ),
      );
    }

    if (mode === "thinking") {
      loops.push(
        Animated.loop(
          Animated.timing(spin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
        ),
      );
    }

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [breathe, mode, ring, spin]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, mode === "listening" ? 1.9 : 1.45] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const muted = mode === "muted";
  const gradient = muted ? [colors.orbMuted, colors.orbMutedDark] : [colors.orbTop, colors.orbBottom];

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Kasama is ${describe(mode)}`}>
      {(mode === "listening" || mode === "speaking") && (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        />
      )}
      <Animated.View
        style={[
          styles.glow,
          muted ? styles.glowMuted : null,
          mode === "thinking" ? styles.glowDim : null,
          { transform: [{ scale: breathe }] },
        ]}
      >
        <LinearGradient colors={gradient as [string, string]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.orb}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name={muted ? "mic-off" : "sunny"} size={size.orbGlyph} color={colors.onOrange} />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function describe(mode: OrbMode): string {
  switch (mode) {
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    case "muted":
      return "unable to hear";
    default:
      return "ready";
  }
}

const styles = StyleSheet.create({
  wrap: {
    width: size.orb * 2,
    height: size.orb * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: size.orb,
    height: size.orb,
    borderRadius: size.orb / 2,
    backgroundColor: colors.orbGlow,
  },
  glow: {
    shadowColor: colors.orbGlow,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  glowDim: {
    shadowOpacity: 0.25,
  },
  glowMuted: {
    shadowOpacity: 0.15,
    shadowColor: colors.orbMutedDark,
  },
  orb: {
    width: size.orb,
    height: size.orb,
    borderRadius: size.orb / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
