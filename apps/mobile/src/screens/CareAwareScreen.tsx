import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildCareAwareView,
  DEFAULT_SESSION_ID,
  formatSeconds,
  titleCaseUrgency,
  type CareAwareAction,
  type CareAwareResponseTone,
  type CareAwareUsagePeriod,
} from "@kasama/shared";
import { CaretakerCard, CaretakerCardHeader } from "../components/caretaker/CaretakerCard";
import { postApproval, postNotifyCaretaker } from "../lib/api";
import { colors } from "../theme";

type Props = {
  onBack: () => void;
  sessionId?: string;
  onFamilyUpdateChanged?: () => void;
};

const NOTIFY_DAUGHTER_SUMMARY = "Maria missed her medication reminder.";
const NOTIFY_DAUGHTER_RECIPIENT = "Sarah";
const NOTIFY_DAUGHTER_URGENCY = "normal" as const;

const CHIP: Record<CareAwareResponseTone, string> = {
  fast: colors.careAwareChipFast,
  mid: colors.careAwareChipMid,
  slow: colors.careAwareChipSlow,
};

/**
 * Care-aware update (#10). Opened from Care notes on the caretaker dashboard.
 * Copy is worth-reviewing only — never a diagnosis. Layout matches caretaker
 * Overview: cream sky, then a peach wash of white cards. Notify daughter
 * drafts a family update on the shared session; Confirm sends as caretaker.
 */
export function CareAwareScreen({
  onBack,
  sessionId = DEFAULT_SESSION_ID,
  onFamilyUpdateChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const view = buildCareAwareView();
  const [action, setAction] = useState<CareAwareAction | null>(null);
  const [notifyReady, setNotifyReady] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const barMax = Math.max(...view.periods.map((period) => period.minutes), 1);
  const notifySheet = action?.id === "notify_caretaker";

  async function openAction(item: CareAwareAction) {
    setAction(item);
    setNotifyError(null);
    setNotifyReady(false);
    if (item.id !== "notify_caretaker") return;
    setNotifyBusy(true);
    try {
      await postNotifyCaretaker({
        sessionId,
        summary: NOTIFY_DAUGHTER_SUMMARY,
        urgency: NOTIFY_DAUGHTER_URGENCY,
        recipientName: NOTIFY_DAUGHTER_RECIPIENT,
        actor: "caretaker",
      });
      setNotifyReady(true);
      onFamilyUpdateChanged?.();
    } catch {
      setNotifyError("Could not open a family update.");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function confirmNotify() {
    if (notifyBusy || !notifyReady) return;
    setNotifyBusy(true);
    try {
      await postApproval("approve", sessionId, "caretaker");
      onFamilyUpdateChanged?.();
      setAction(null);
      setNotifyReady(false);
    } catch {
      setNotifyError("Could not send that family update.");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function cancelNotify() {
    if (notifyBusy || !notifyReady) return;
    setNotifyBusy(true);
    try {
      await postApproval("decline", sessionId, "caretaker");
      onFamilyUpdateChanged?.();
      setAction(null);
      setNotifyReady(false);
    } catch {
      setNotifyError("Could not cancel that family update.");
    } finally {
      setNotifyBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 18 }]}
      >
        <View style={styles.sky}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to caretaker dashboard"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.onOrange} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Here's an update on {view.seniorFirstName}
          </Text>
          <Text style={styles.date}>{view.dateTimeLabel}</Text>
        </View>

        <LinearGradient
          colors={[colors.caretakerSky, colors.careAwareWash, colors.careAwareWashDeep]}
          locations={[0, 0.55, 1]}
          style={[styles.wash, { paddingBottom: Math.max(insets.bottom, 20) }]}
        >
          <CaretakerCard accessibilityLabel={`Total usage ${view.totalUsageMinutes} minutes`}>
            <CaretakerCardHeader label="TOTAL USAGE" icon="time-outline" />
            <Text style={styles.cardTitle}>{view.totalUsageMinutes} min</Text>
            <View style={styles.periods}>
              {view.periods.map((period) => (
                <UsageRow key={period.id} period={period} max={barMax} />
              ))}
            </View>
            <Text style={styles.meta}>
              Peak activity:{" "}
              <Text style={styles.metaStrong}>{view.peakActivity.split(" during ")[0]}</Text>
              {view.peakActivity.includes("during")
                ? ` during ${view.peakActivity.split(" during ")[1]}`
                : null}
            </Text>
          </CaretakerCard>

          <CaretakerCard accessibilityLabel={view.repeatedQuestionsNote}>
            <CaretakerCardHeader label="REPEATED QUESTIONS" icon="chatbubbles-outline" />
            <EmphasizedNote text={view.repeatedQuestionsNote} />
          </CaretakerCard>

          <CaretakerCard accessibilityLabel={`Response time ${formatSeconds(view.responseAverageSeconds)} average`}>
            <CaretakerCardHeader label="RESPONSE TIME" icon="trending-up-outline" />
            <Text style={styles.cardTitle}>{formatSeconds(view.responseAverageSeconds)} avg</Text>
            <View style={styles.chips}>
              {view.responseDays.map((day) => (
                <View key={day.weekday} style={styles.chipCol}>
                  <View style={[styles.chip, { backgroundColor: CHIP[day.tone] }]}>
                    <Text style={styles.chipValue}>{formatSeconds(day.seconds)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <Text style={styles.legendLabel}>Fast</Text>
              <LinearGradient
                colors={["#7BE0B0", "#F0D36A", "#F0A04A", "#E86B6B"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.legendBar}
              />
              <Text style={styles.legendLabel}>Slow</Text>
            </View>
            <View style={styles.weekdays}>
              {view.responseDays.map((day) => (
                <Text key={day.weekday} style={styles.weekday}>
                  {day.weekday}
                </Text>
              ))}
            </View>
            <Text style={styles.meta}>{view.responseInsight}</Text>
          </CaretakerCard>

          <CaretakerCard
            accessibilityLabel={`Worth reviewing. ${view.worthReviewingQuote} ${view.disclaimer}`}
          >
            <CaretakerCardHeader label="WORTH REVIEWING" icon="alert-circle-outline" />
            <Text style={styles.quote}>“{view.worthReviewingQuote}”</Text>
            <Text style={styles.meta}>{view.disclaimer}</Text>
          </CaretakerCard>

          <Text style={styles.actionsKicker}>QUICK ACTIONS</Text>
          <View style={styles.actionRow}>
            {view.actions
              .filter((item) => item.id !== "doctor_summary")
              .map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void openAction(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={({ pressed }) => [styles.actionPill, pressed ? styles.pressed : null]}
                >
                  <Ionicons
                    name={item.id === "remind" ? "notifications-outline" : "call-outline"}
                    size={18}
                    color={colors.caretakerInk}
                  />
                  <Text style={styles.actionPillLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
          </View>
          {view.actions
            .filter((item) => item.id === "doctor_summary")
            .map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void openAction(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [styles.actionFill, pressed ? styles.pressed : null]}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.onOrange} />
                <Text style={styles.actionFillLabel}>{item.label}</Text>
              </Pressable>
            ))}
        </LinearGradient>
      </ScrollView>

      <Modal
        visible={action !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!notifyBusy) setAction(null);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!notifyBusy) setAction(null);
          }}
          accessibilityLabel="Close"
        >
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{action?.label}</Text>
            {notifySheet ? (
              <>
                <Text style={styles.sheetBody}>Recipient: {NOTIFY_DAUGHTER_RECIPIENT}</Text>
                <Text style={styles.sheetBody}>{NOTIFY_DAUGHTER_SUMMARY}</Text>
                <Text style={styles.sheetBody}>
                  Urgency: {titleCaseUrgency(NOTIFY_DAUGHTER_URGENCY)}
                </Text>
                {notifyBusy ? <Text style={styles.sheetMeta}>Working…</Text> : null}
                {notifyError ? <Text style={styles.sheetError}>{notifyError}</Text> : null}
                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={() => void cancelNotify()}
                    disabled={notifyBusy || !notifyReady}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    style={({ pressed }) => [
                      styles.sheetCancel,
                      notifyBusy || !notifyReady ? styles.disabled : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.sheetCancelLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void confirmNotify()}
                    disabled={notifyBusy || !notifyReady}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm"
                    style={({ pressed }) => [
                      styles.sheetConfirm,
                      notifyBusy || !notifyReady ? styles.disabled : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.sheetCloseLabel}>Confirm</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sheetBody}>{action?.detail}</Text>
                <Pressable
                  onPress={() => setAction(null)}
                  accessibilityRole="button"
                  style={styles.sheetClose}
                >
                  <Text style={styles.sheetCloseLabel}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function UsageRow({ period, max }: { period: CareAwareUsagePeriod; max: number }) {
  const fill = Math.max(0, Math.min(1, period.minutes / max));
  return (
    <View style={styles.periodRow}>
      <View style={styles.periodCopy}>
        <Text style={styles.periodLabel}>{period.label}</Text>
        <Text style={styles.periodWindow}>{period.window}</Text>
      </View>
      <View style={styles.track}>
        {period.minutes > 0 ? (
          <LinearGradient
            colors={period.id === "morning" ? [colors.orbBottom, colors.orbTop] : [colors.orbTop, "#F0C24A"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fill, { width: `${fill * 100}%` }]}
          />
        ) : null}
      </View>
      <Text style={styles.periodMinutes}>{period.minutes}m</Text>
    </View>
  );
}

function EmphasizedNote({ text }: { text: string }) {
  const parts = text.split(/(\d+ times|once|\d+ repeated questions)/i);
  return (
    <Text style={styles.note}>
      {parts.map((part, index) =>
        /\d+ times|once|\d+ repeated questions/i.test(part) ? (
          <Text key={`${part}-${index}`} style={styles.noteStrong}>
            {part}
          </Text>
        ) : (
          <Text key={`${part}-${index}`}>{part}</Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.caretakerSky,
  },
  body: {
    flexGrow: 1,
  },
  sky: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 24,
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    color: colors.caretakerInk,
  },
  date: {
    fontSize: 16,
    fontStyle: "italic",
    color: colors.caretakerMuted,
    marginTop: -8,
  },
  wash: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 16,
    flexGrow: 1,
  },
  cardTitle: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    color: colors.caretakerInk,
  },
  periods: {
    gap: 14,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  periodCopy: {
    width: 92,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.caretakerInk,
  },
  periodWindow: {
    fontSize: 13,
    color: colors.caretakerMuted,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.careAwareTrack,
    overflow: "hidden",
  },
  fill: {
    height: 10,
    borderRadius: 6,
  },
  periodMinutes: {
    width: 28,
    textAlign: "right",
    fontSize: 15,
    color: colors.caretakerMuted,
  },
  meta: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.caretakerMuted,
  },
  metaStrong: {
    color: colors.caretakerInk,
    fontWeight: "600",
  },
  note: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.caretakerInk,
  },
  noteStrong: {
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  chipCol: {
    flex: 1,
  },
  chip: {
    borderRadius: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  chipValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.caretakerInk,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.caretakerMuted,
  },
  legendBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  weekdays: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: colors.caretakerMuted,
  },
  quote: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    color: colors.caretakerInk,
  },
  actionsKicker: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 1.6,
    fontWeight: "700",
    color: colors.caretakerMuted,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionPill: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.careAwareActionLine,
    backgroundColor: colors.caretakerCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  actionPillLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.caretakerInk,
  },
  actionFill: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.careAwareActionFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionFillLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.onOrange,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 16, 12, 0.4)",
    justifyContent: "flex-end",
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.caretakerCard,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  sheetTitle: {
    fontFamily: "Georgia",
    fontSize: 26,
    color: colors.caretakerInk,
  },
  sheetBody: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.caretakerInk,
  },
  sheetClose: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  sheetCloseLabel: {
    color: colors.onOrange,
    fontSize: 18,
    fontWeight: "600",
  },
  sheetMeta: {
    fontSize: 16,
    color: colors.caretakerMuted,
  },
  sheetError: {
    fontSize: 16,
    color: colors.danger,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  sheetCancel: {
    flex: 1,
    minHeight: 68,
    borderRadius: 28,
    backgroundColor: colors.cancelFill,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetConfirm: {
    flex: 1,
    minHeight: 68,
    borderRadius: 28,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelLabel: {
    color: colors.caretakerInk,
    fontSize: 18,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
