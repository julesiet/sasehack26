import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEFAULT_SESSION_ID, type SessionView } from "@kasama/shared";
import { fetchSession } from "../lib/api";
import { colors, radius, type } from "../theme";

type Props = {
  onBack: () => void;
};

/**
 * Family view of the same session Maria is on. #6 only needs pending and
 * decided approvals here — the full dashboard is #9.
 */
export function CaretakerScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) setError("Could not reach Kasama.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const pending = view?.pendingApproval;
  const last = view?.lastApproval;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.kicker}>James · Caretaker</Text>
        <Text style={styles.title}>Maria's activity</Text>
        <Text style={styles.meta}>Same session as Maria. Approvals show up here.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Waiting for Maria</Text>
          {pending ? (
            <>
              <Text style={styles.cardTitle}>{pending.prompt ?? pending.summary}</Text>
              {pending.preview ? <Text style={styles.preview}>{pending.preview}</Text> : null}
              {pending.estimate ? <Text style={styles.amount}>{pending.estimate}</Text> : null}
              <Text style={styles.status}>Not booked or sent yet.</Text>
            </>
          ) : (
            <Text style={styles.cardTitle}>Nothing waiting.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Last yes or no</Text>
          {last ? (
            <>
              <Text style={styles.cardTitle}>
                {last.decision === "approved" ? "Approved" : "Declined"}
              </Text>
              <Text style={styles.meta}>
                {last.actor === "senior" ? "Maria" : "Family"} · {formatWhen(last.timestamp)}
              </Text>
              <Text style={styles.status}>{last.summary}</Text>
            </>
          ) : (
            <Text style={styles.cardTitle}>No decision yet.</Text>
          )}
        </View>

        {view?.events.length ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Audit</Text>
            {view.events
              .slice()
              .reverse()
              .slice(0, 8)
              .map((event) => (
                <Text key={event.id} style={styles.event}>
                  {event.proposed.tool} · {event.outcome.reason ?? (event.approved?.allowed ? "allowed" : "denied")}
                </Text>
              ))}
          </View>
        ) : null}

        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sky,
  },
  body: {
    paddingHorizontal: 24,
    gap: 16,
  },
  kicker: {
    ...type.label,
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 16,
  },
  title: {
    ...type.greeting,
    color: colors.ink,
  },
  meta: {
    ...type.label,
    color: colors.inkSoft,
  },
  error: {
    ...type.label,
    color: colors.danger,
  },
  card: {
    backgroundColor: colors.pill,
    borderRadius: radius.button,
    padding: 20,
    gap: 8,
  },
  cardLabel: {
    ...type.label,
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 15,
  },
  cardTitle: {
    ...type.transcript,
    color: colors.ink,
  },
  preview: {
    ...type.label,
    color: colors.ink,
  },
  amount: {
    ...type.reply,
    color: colors.ink,
  },
  status: {
    ...type.label,
    color: colors.inkSoft,
  },
  event: {
    ...type.label,
    color: colors.ink,
  },
  back: {
    minHeight: 68,
    borderRadius: radius.button,
    backgroundColor: colors.bowlTop,
    alignItems: "center",
    justifyContent: "center",
  },
  backLabel: {
    ...type.button,
    color: colors.onOrange,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
