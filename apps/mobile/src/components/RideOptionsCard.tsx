import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { rideProductTitle, type UberRideOption } from "@kasama/shared";
import { colors, radius, type } from "../theme";

type Props = {
  options: UberRideOption[];
  selectedOptionId?: string;
  disabled?: boolean;
  onSelect: (option: UberRideOption) => void;
};

/**
 * Two Uber choices for Maria (#8). WAV is the accessible option; price stays
 * large enough to read from a few feet away.
 */
export function RideOptionsCard({ options, selectedOptionId, disabled, onSelect }: Props) {
  return (
    <View style={styles.card} accessibilityLabel="Select a ride">
      <View style={styles.header}>
        <Ionicons name="car-outline" size={22} color={colors.pin} />
        <Text style={styles.eyebrow}>SELECT A RIDE</Text>
      </View>

      <View style={styles.list}>
        {options.map((option) => {
          const selected = option.optionId === selectedOptionId;
          const title = rideProductTitle(option.product);
          const eta = option.etaMinutes != null ? `${option.etaMinutes} min away` : "Pickup time on confirm";
          const a11y = [
            title,
            option.accessible ? "wheelchair accessible" : null,
            option.estimate,
            eta,
            selected ? "selected" : null,
          ]
            .filter(Boolean)
            .join(". ");

          return (
            <Pressable
              key={option.optionId}
              onPress={() => onSelect(option)}
              disabled={disabled || selected}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
              accessibilityLabel={a11y}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : null,
                pressed && !disabled ? styles.pressed : null,
              ]}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name={option.accessible ? "accessibility-outline" : "car-outline"}
                  size={26}
                  color={selected ? colors.selectedLine : colors.ink}
                />
                <View style={styles.optionCopy}>
                  <Text style={styles.product}>{title}</Text>
                  <Text style={styles.meta}>
                    {option.accessible ? `Wheelchair van · ${eta}` : eta}
                  </Text>
                </View>
              </View>
              <Text style={[styles.price, selected ? styles.priceSelected : null]}>
                {option.estimate ?? "—"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.chatCard,
    borderRadius: radius.card,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.chatLine,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.pin,
  },
  list: {
    gap: 12,
  },
  option: {
    minHeight: 88,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.chatLine,
    backgroundColor: colors.control,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionSelected: {
    borderColor: colors.selectedLine,
    backgroundColor: colors.selectedFill,
  },
  optionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  product: {
    ...type.cardTitle,
    color: colors.ink,
  },
  meta: {
    ...type.label,
    color: colors.inkSoft,
    fontSize: 18,
    lineHeight: 24,
  },
  price: {
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 38,
    color: colors.ink,
  },
  priceSelected: {
    color: colors.selectedLine,
  },
  pressed: {
    opacity: 0.85,
  },
});
