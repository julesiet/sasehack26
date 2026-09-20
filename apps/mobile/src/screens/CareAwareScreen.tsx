import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildCareAwareView,
  formatSeconds,
  type CareAwareAction,
  type CareAwareResponseTone,
  type CareAwareUsagePeriod,
} from "@kasama/shared";
import { CaretakerCard, CaretakerCardHeader } from "../components/caretaker/CaretakerCard";
import { colors } from "../theme";

type Props = {
  onBack: () => void;
};

const CHIP: Record<CareAwareResponseTone, string> = {
  fast: colors.careAwareChipFast,
  mid: colors.careAwareChipMid,
  slow: colors.careAwareChipSlow,
};

/**
 * Care-aware update (#10). Opened from Care notes on the caretaker dashboard.
 * Copy is worth-reviewing only — never a diagnosis. Layout matches caretaker
 * Overview: cream sky, then a peach wash of white cards.
 */
export function CareAwareScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const view = buildCareAwareView();
  const [action, setAction] = useState<CareAwareAction | null>(null);
  const barMax = Math.max(...view.periods.map((period) => period.minutes), 1);

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
                  onPress={() => setAction(item)}
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
                onPress={() => setAction(item)}
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

      <Modal visible={action !== null} transparent animationType="fade" onRequestClose={() => setAction(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAction(null)} accessibilityLabel="Close">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{action?.label}</Text>
            <Text style={styles.sheetBody}>{action?.detail}</Text>
            <Pressable
              onPress={() => setAction(null)}
              accessibilityRole="button"
              style={styles.sheetClose}
            >
              <Text style={styles.sheetCloseLabel}>Close</Text>
            </Pressable>
          </View>
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
  pressed: {
    opacity: 0.85,
  },
});
