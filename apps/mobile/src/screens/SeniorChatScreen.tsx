import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  familyMessageFromApproval,
  pendingHospitalVisit,
  pendingMedicationReminder,
  selectedRideOption,
  announcesRideOptions,
  type ActiveRequest,
  type ConversationIntent,
  type ConversationTurn,
  type LastApproval,
  type PendingApproval,
  type SessionBooking,
  type SessionHospitalVisit,
  type UberRideOption,
} from "@kasama/shared";
import { ChatBubble } from "../components/ChatBubble";
import { ConfirmationCard, type ConfirmationStatus } from "../components/ConfirmationCard";
import { FamilyMessageCard } from "../components/FamilyMessageCard";
import { HospitalAppointmentCard } from "../components/HospitalAppointmentCard";
import { MedicationReminderCard } from "../components/MedicationReminderCard";
import { RideOptionsCard } from "../components/RideOptionsCard";
import { RideStatusCard } from "../components/RideStatusCard";
import type { ConversationPhase, RideWork } from "../hooks/useKasamaConversation";
import { confirmationFromPending } from "../lib/mvp-confirmation";
import { colors, type } from "../theme";

type Props = {
  title: string;
  intent: ConversationIntent;
  liveCards: boolean;
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
  onBack: () => void;
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
  title,
  intent,
  liveCards,
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
  onBack,
  onSelectRide,
  onConfirm,
  onCancel,
  onOpenSettings,
}: Props) {
  const scroll = useRef<ScrollView>(null);
  const card = confirmationFromPending(
    pendingApproval,
    justResolved,
    lastRideOptions,
    lastBooking,
    new Date(),
    activeRequest,
  );
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
  const rideIntent = intent === "ride" || intent === "unknown";
  const reminderIntent = intent === "medication_reminder" || intent === "unknown";
  const hospitalIntent = intent === "hospital_schedule" || intent === "unknown";
  const notifyIntent = intent === "family_update" || intent === "unknown";
  const notify = familyMessageFromApproval(pendingApproval, justResolved);
  const showOptions =
    liveCards &&
    rideIntent &&
    lastRideOptions.length > 0 &&
    justResolved?.decision !== "approved" &&
    !rideFinished &&
    !reminder &&
    !hospitalPending;
  const showRideConfirmation =
    liveCards &&
    rideIntent &&
    Boolean(card && cardStatus && !reminder && !hospitalPending) &&
    (pendingApproval?.tool === "book_ride" || justResolved?.tool === "book_ride");
  const showNotify =
    liveCards &&
    notifyIntent &&
    (pendingApproval?.tool === "notify_caretaker" || justResolved?.tool === "notify_caretaker");
  const busy = phase === "thinking" || rideWork !== "none";

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scroll.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [turns.length, cardStatus, lastRideOptions.length, rideWork, reminder, hospitalPending, lastHospitalVisit?.status, showNotify]);

  return (
    <ScrollView
      ref={scroll}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
    >
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Chat"
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Ionicons name="chevron-back" size={28} color={colors.bowlTop} />
          <Text style={styles.backLabel}>Chat</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>

      {turns
        .filter((turn) => !(turn.speaker === "kasama" && announcesRideOptions(turn.text)))
        .map((turn) => (
          <ChatBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
        ))}

      {liveCards && rideIntent && (rideWork === "finding" || rideWork === "booking") ? (
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

      {liveCards && reminderIntent && reminder ? (
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

      {liveCards && hospitalIntent && hospitalPending ? (
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

      {liveCards && hospitalIntent && hospitalSaved && lastHospitalVisit ? (
        <View style={styles.cardWrap}>
          <HospitalAppointmentCard
            visit={lastHospitalVisit}
            status="saved"
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {liveCards && hospitalIntent && hospitalCancelled && lastHospitalVisit ? (
        <View style={styles.cardWrap}>
          <HospitalAppointmentCard
            visit={lastHospitalVisit}
            status="cancelled"
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </View>
      ) : null}

      {showNotify && notify ? (
        <View style={styles.cardWrap}>
          <FamilyMessageCard
            recipientName={notify.recipientName}
            summary={notify.summary}
            urgency={notify.urgency}
            status={notify.status}
            disabled={notify.status === "pending" && busy}
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
  header: {
    marginBottom: 16,
    gap: 8,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
  },
  backLabel: {
    ...type.button,
    color: colors.bowlTop,
    fontWeight: "600",
  },
  title: {
    ...type.greeting,
    color: colors.ink,
  },
  pressed: {
    opacity: 0.85,
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
