import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  pendingHospitalVisit,
  pendingMedicationReminder,
  selectedRideOption,
  type ActiveRequest,
  type ConversationTurn,
  type LastApproval,
  type PendingApproval,
  type SessionBooking,
  type SessionHospitalVisit,
  type UberRideOption,
} from "@kasama/shared";
import { ChatBubble } from "../components/ChatBubble";
import { ConfirmationCard, type ConfirmationStatus } from "../components/ConfirmationCard";
import { HospitalAppointmentCard } from "../components/HospitalAppointmentCard";
import { MedicationReminderCard } from "../components/MedicationReminderCard";
import { RideOptionsCard } from "../components/RideOptionsCard";
import { RideStatusCard } from "../components/RideStatusCard";
import type { ConversationPhase, RideWork } from "../hooks/useKasamaConversation";
import { confirmationFromPending } from "../lib/mvp-confirmation";
import { colors, type } from "../theme";

type Props = {
  phase: ConversationPhase;
  turns: ConversationTurn[];
  pendingApproval: PendingApproval | null;
  justResolved: LastApproval | null;
  lastRideOptions: UberRideOption[];
  lastBooking: SessionBooking | null;
  lastHospitalVisit: SessionHospitalVisit | null;
  activeRequest: ActiveRequest | null;
  rideWork: RideWork;
  notice: string | null;
  onSelectRide: (option: UberRideOption) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
};

function confirmationStatus(
  pendingApproval: PendingApproval | null,
  justResolved: LastApproval | null,
  lastBooking: SessionBooking | null,
  rideWork: RideWork,
): ConfirmationStatus | null {
  if (pendingApproval) return rideWork === "booking" ? "booking" : "pending";
  if (justResolved?.decision === "approved") {
    if (justResolved.tool === "book_ride" && lastBooking?.status !== "booked") return "failed";
    return "approved";
  }
  if (justResolved) return "declined";
  return null;
}

/**
 * Chat thread after Kasama's first reply. The composer and tab bar stay
 * outside this screen so they stay fixed.
 */
export function SeniorChatScreen({
  phase,
  turns,
  pendingApproval,
  justResolved,
  lastRideOptions,
  lastBooking,
  lastHospitalVisit,
  activeRequest,
  rideWork,
  notice,
  onSelectRide,
  onConfirm,
  onCancel,
  onOpenSettings,
}: Props) {
  const scroll = useRef<ScrollView>(null);
  const card = confirmationFromPending(pendingApproval, justResolved, lastRideOptions, lastBooking);
  const cardStatus = confirmationStatus(pendingApproval, justResolved, lastBooking, rideWork);
  const selected = selectedRideOption(lastRideOptions, pendingApproval, activeRequest?.product);
  const reminder = pendingMedicationReminder(pendingApproval);
  const hospitalPending = pendingHospitalVisit(pendingApproval);
  const hospitalJustResolved = justResolved?.tool === "save_hospital_visit";
  const hospitalSaved =
    lastHospitalVisit?.status === "saved" && hospitalJustResolved && justResolved?.decision === "approved";
  const hospitalCancelled =
    lastHospitalVisit?.status === "cancelled" && hospitalJustResolved;
  const rideFinished =
    lastBooking?.status === "booked" && !pendingApproval && activeRequest?.status !== "proposed";
  const showOptions =
    lastRideOptions.length > 0 &&
    justResolved?.decision !== "approved" &&
    !rideFinished &&
    !reminder &&
    !hospitalPending;
  const showRideConfirmation =
    Boolean(card && cardStatus && !reminder && !hospitalPending) &&
    (pendingApproval?.tool === "book_ride" ||
      pendingApproval?.tool === "notify_caretaker" ||
      justResolved?.tool === "book_ride" ||
      justResolved?.tool === "notify_caretaker");
  const busy = phase === "thinking" || rideWork !== "none";

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scroll.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [turns.length, cardStatus, lastRideOptions.length, rideWork, reminder, hospitalPending, lastHospitalVisit?.status]);

  return (
    <ScrollView
      ref={scroll}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
    >
      {turns.map((turn) => (
        <ChatBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
      ))}

      {rideWork === "finding" || rideWork === "booking" ? (
        <View style={styles.cardWrap}>
          <RideStatusCard work={rideWork} />
        </View>
      ) : null}

      {phase === "thinking" && rideWork === "none" ? <Text style={styles.hint}>Thinking…</Text> : null}
      {phase === "listening" ? <Text style={styles.hint}>I'm listening.</Text> : null}

      {showOptions ? (
        <View style={styles.cardWrap}>
          <RideOptionsCard
            options={lastRideOptions}
            selectedOptionId={selected?.optionId}
            disabled={busy}
            onSelect={onSelectRide}
          />
        </View>
      ) : null}

      {reminder ? (
        <View style={styles.cardWrap}>
          <MedicationReminderCard
            reminder={reminder}
            status={reminder.saveLocally ? "sync_failed" : "proposed"}
            disabled={busy}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {hospitalPending ? (
        <View style={styles.cardWrap}>
          <HospitalAppointmentCard
            visit={hospitalPending}
            status="pending"
            disabled={busy}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {hospitalSaved && lastHospitalVisit ? (
        <View style={styles.cardWrap}>
          <HospitalAppointmentCard
            visit={lastHospitalVisit}
            status="saved"
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {hospitalCancelled && lastHospitalVisit ? (
        <View style={styles.cardWrap}>
          <HospitalAppointmentCard
            visit={lastHospitalVisit}
            status="cancelled"
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {card && cardStatus && showRideConfirmation ? (
        <View style={styles.cardWrap}>
          <ConfirmationCard
            data={card}
            status={cardStatus}
            disabled={cardStatus === "pending" && busy}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {phase === "micDenied" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Kasama can't hear you yet.</Text>
          <Text style={styles.hint}>Allow the microphone in Settings, or type below.</Text>
          <Pressable onPress={onOpenSettings} accessibilityRole="button" style={styles.settings}>
            <Text style={styles.settingsLabel}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === "error" && notice ? <Text style={styles.error}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  cardWrap: {
    marginTop: 4,
    marginBottom: 12,
  },
  hint: {
    ...type.label,
    color: colors.inkSoft,
    marginBottom: 12,
  },
  notice: {
    gap: 10,
    marginTop: 8,
  },
  noticeTitle: {
    ...type.reply,
    color: colors.ink,
  },
  settings: {
    minHeight: 68,
    borderRadius: 22,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  error: {
    ...type.reply,
    color: colors.ink,
    marginTop: 8,
  },
});
