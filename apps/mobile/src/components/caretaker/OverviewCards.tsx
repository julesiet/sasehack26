import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CaretakerAppointmentCard, CaretakerRideCard } from "@kasama/shared";
import { colors, radius } from "../../theme";

type Props = {
  appointment: CaretakerAppointmentCard;
  ride: CaretakerRideCard | null;
};

export function OverviewCards({ appointment, ride }: Props) {
  return (
    <View style={styles.stack}>
      <WhiteCard>
        <CardHeader label="APPOINTMENT" icon="medkit-outline" />
        <Text style={styles.title}>{appointment.title}</Text>
        <MetaRow icon="location-outline" text={appointment.location} />
        <MetaRow icon="calendar-outline" text={appointment.whenLabel} />
      </WhiteCard>

      <WhiteCard>
        <CardHeader label="SELECTED RIDE" icon="car-outline" />
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
      </WhiteCard>
    </View>
  );
}

function WhiteCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function CardHeader({
  label,
  icon,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.caretakerLabel} />
      </View>
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
  card: {
    backgroundColor: colors.caretakerCard,
    borderRadius: radius.card,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 10,
    shadowColor: "#111111",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: colors.caretakerLabel,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF4EA",
    alignItems: "center",
    justifyContent: "center",
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
