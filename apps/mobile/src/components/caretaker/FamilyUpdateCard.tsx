import { StyleSheet, Text } from "react-native";
import type { CaretakerFamilyUpdate } from "@kasama/shared";
import { colors } from "../../theme";
import { CaretakerCard, CaretakerCardHeader } from "./CaretakerCard";

type Props = {
  update: CaretakerFamilyUpdate;
};

/**
 * Caretaker Overview FAMILY UPDATE (#11). Draft / sent / cancelled copy
 * matches Maria's notify checkpoint, including relationship and health sharing.
 */
export function FamilyUpdateCard({ update }: Props) {
  return (
    <CaretakerCard accessibilityLabel={`${update.kicker}. ${update.headline}. ${update.summary}`}>
      <CaretakerCardHeader label={update.kicker} icon="mail-outline" />
      <Text style={styles.title}>{update.headline}</Text>
      {update.status === "draft" ? (
        <Text style={styles.meta}>Preview only. Nothing is sent yet.</Text>
      ) : null}
      {update.status === "not_sent" ? (
        <Text style={styles.meta}>Not sent.</Text>
      ) : null}
      <Text style={styles.summary}>{update.summary}</Text>
      {update.status === "sent" && update.sentLine ? (
        <Text style={styles.meta}>{update.sentLine}</Text>
      ) : null}
      {update.status === "sent" && update.whenLabel ? (
        <Text style={styles.meta}>{update.whenLabel}</Text>
      ) : null}
      <Text style={styles.meta}>Recipient: {update.recipientName}</Text>
      <Text style={styles.meta}>Relationship: {update.relationshipLabel}</Text>
      <Text style={styles.meta}>Urgency: {update.urgencyLabel}</Text>
      <Text style={styles.meta}>Health information: {update.healthLabel}</Text>
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
