import { StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

type Props = {
  /** 0–1 fraction of screen height where the top of the arc sits. */
  crest?: number;
  muted?: boolean;
};

/** The orange sun rising from the bottom of the screen. Purely decorative. */
export function SunBowl({ crest = 0.66, muted = false }: Props) {
  const { width, height } = useWindowDimensions();
  const diameter = width * 1.7;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: height * crest }]}>
      <LinearGradient
        colors={muted ? [colors.orbMuted, colors.orbMutedDark] : [colors.bowlTop, colors.bowlBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          marginLeft: -(diameter - width) / 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
