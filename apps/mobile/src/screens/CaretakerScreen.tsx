import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildCaretakerDashboard, DEFAULT_SESSION_ID, type SessionView } from "@kasama/shared";
import { ActivitySummary } from "../components/caretaker/ActivitySummary";
import { CareNotesCard } from "../components/caretaker/CareNotesCard";
import { ConsentRecord } from "../components/caretaker/ConsentRecord";
import { ContactsRow } from "../components/caretaker/ContactsRow";
import { OverviewCards } from "../components/caretaker/OverviewCards";
import { fetchSession } from "../lib/api";
import { CareAwareScreen } from "./CareAwareScreen";
import { colors } from "../theme";

type Props = {
  onBack: () => void;
  onOpenSenior: () => void;
};

/**
 * Designed caretaker dashboard (#9). Polls the same session Maria uses so a
 * booking shows up here without a manual refresh. Care notes opens the
 * care-aware view (#10).
 */
export function CaretakerScreen({ onBack, onOpenSenior }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState<"overview" | "careAware">("overview");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchSession(DEFAULT_SESSION_ID);
        if (!cancelled) {
          setView(next);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not reach Kasama. Seeded details still show.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const dashboard = useMemo(() => buildCaretakerDashboard({ view }), [view]);

  if (page === "careAware") {
    return <CareAwareScreen onBack={() => setPage("overview")} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 18 }]}
      >
        <View style={styles.sky}>
          <View style={styles.dateRow}>
            <Text style={styles.date}>{dashboard.dateLabel}</Text>
            <Pressable
              onPress={onOpenSenior}
              accessibilityRole="button"
              accessibilityLabel="Switch to Maria"
              hitSlop={12}
              style={({ pressed }) => [pressed ? styles.pressed : null]}
            >
              <Text style={styles.switch}>Maria</Text>
            </Pressable>
          </View>
          <Text style={styles.hello}>Hello, {dashboard.viewerFirstName}</Text>
          <Text style={styles.subtitle}>{dashboard.subtitle}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <CareNotesCard notes={dashboard.careNotes} onPress={() => setPage("careAware")} />
          <ContactsRow contacts={dashboard.contacts} />
        </View>

        <LinearGradient
          colors={[
            colors.caretakerSky,
            colors.careAwareWash,
            colors.careAwareWashDeep,
          ]}
          locations={[0, 0.55, 1]}
          style={[styles.wash, { paddingBottom: Math.max(insets.bottom, 20) }]}
        >
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Overview</Text>
            {dashboard.overviewBadge ? (
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeLabel}>{dashboard.overviewBadge}</Text>
              </View>
            ) : null}
          </View>

          <OverviewCards
            appointment={dashboard.appointment}
            ride={dashboard.ride}
            familyUpdate={dashboard.familyUpdate}
          />
          <ConsentRecord items={dashboard.consentItems} />
          <ActivitySummary
            items={dashboard.activity}
            expanded={expanded}
            onToggle={() => setExpanded((current) => !current)}
          />

          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            style={({ pressed }) => [styles.home, pressed ? styles.pressed : null]}
          >
            <Text style={styles.homeLabel}>Back to Home</Text>
          </Pressable>
        </LinearGradient>
      </ScrollView>
    </View>
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
    gap: 22,
    paddingBottom: 24,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    color: colors.caretakerMuted,
    fontSize: 16,
  },
  switch: {
    color: colors.caretakerLabel,
    fontSize: 16,
    fontWeight: "600",
  },
  hello: {
    fontFamily: "Georgia",
    fontSize: 40,
    lineHeight: 46,
    color: colors.caretakerInk,
    marginTop: -8,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.caretakerMuted,
    marginTop: -12,
  },
  error: {
    fontSize: 15,
    color: colors.danger,
  },
  wash: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 16,
    flexGrow: 1,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  overviewTitle: {
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 38,
    color: colors.caretakerInk,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.caretakerCard,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bowlTop,
  },
  badgeLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: colors.caretakerInk,
  },
  home: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  homeLabel: {
    color: colors.caretakerInk,
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
