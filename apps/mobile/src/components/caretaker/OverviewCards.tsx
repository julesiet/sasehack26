import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  CaretakerAppointmentCard,
  CaretakerFamilyUpdate,
  CaretakerRideCard,
} from "@kasama/shared";
import { colors } from "../../theme";
import { CaretakerCard, CaretakerCardHeader } from "./CaretakerCard";
import { FamilyUpdateCard } from "./FamilyUpdateCard";

type Props = {
  appointment: CaretakerAppointmentCard;
  ride: CaretakerRideCard | null;
  familyUpdate: CaretakerFamilyUpdate | null;
};

export function OverviewCards({ appointment, ride, familyUpdate }: Props) {
  return (
    <View style={styles.stack}>
      <CaretakerCard>
        <CaretakerCardHeader label="APPOINTMENT" icon="medkit-outline" />
        <Text style={styles.title}>{appointment.title}</Text>
        <MetaRow icon="location-outline" text={appointment.location} />
        <MetaRow icon="calendar-outline" text={appointment.whenLabel} />
      </CaretakerCard>

      <CaretakerCard>
        <CaretakerCardHeader label="SELECTED RIDE" icon="car-outline" />
        {ride ? (
          <>
            <Text style={styles.title}>{ride.title}</Text>
            <MetaRow icon="navigate-outline" text={`Pickup: ${ride.pickup}`} />
            <MetaRow icon="time-outline" text={ride.arrivalLabel} />
            {ride.confirmationId ? (
              <Text style={styles.confirm}>Confirmation {ride.confirmationId}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.title}>No ride selected yet</Text>
        )}
      </CaretakerCard>

      {familyUpdate ? <FamilyUpdateCard update={familyUpdate} /> : null}
    </View>
  );
}

function MetaRow({
  icon,
  text,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={16} color={colors.caretakerMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    color: colors.caretakerInk,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.caretakerMuted,
  },
  confirm: {
    fontSize: 15,
    color: colors.caretakerInk,
    fontWeight: "600",
  },
});
