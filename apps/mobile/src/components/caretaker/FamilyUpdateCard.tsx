import { StyleSheet, Text } from "react-native";
import type { CaretakerFamilyUpdate } from "@kasama/shared";
import { colors } from "../../theme";
import { CaretakerCard, CaretakerCardHeader } from "./CaretakerCard";

type Props = {
  update: CaretakerFamilyUpdate;
};

/**
 * Caretaker Overview FAMILY UPDATE (#11). Draft / sent / cancelled copy
 * matches Maria's notify checkpoint. Confirm on this card is Task 7.
 */
export function FamilyUpdateCard({ update }: Props) {
  return (
    <CaretakerCard accessibilityLabel={`${update.kicker}. ${update.headline}. ${update.summary}`}>
      <CaretakerCardHeader label={update.kicker} icon="mail-outline" />
      <Text style={styles.title}>{update.headline}</Text>
      <Text style={styles.summary}>{update.summary}</Text>
      {update.status === "sent" && update.sentLine ? (
        <Text style={styles.meta}>{update.sentLine}</Text>
      ) : null}
      {update.status === "sent" && update.whenLabel ? (
        <Text style={styles.meta}>{update.whenLabel}</Text>
      ) : null}
      {update.status !== "not_sent" ? (
        <Text style={styles.meta}>Urgency: {update.urgencyLabel}</Text>
      ) : null}
      {update.status === "draft" ? (
        <Text style={styles.meta}>Recipient: {update.recipientName}</Text>
      ) : null}
    </CaretakerCard>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    color: colors.caretakerInk,
  },
  summary: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.caretakerInk,
  },
  meta: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.caretakerMuted,
  },
});
