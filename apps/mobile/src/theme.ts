/**
 * Kasama senior-mode design tokens, taken from the #4 baseline mockup
 * (white sky → warm glow → orange sun bowl, serif greeting, peach composer pill).
 * Sizes are tuned for seniors: body text ≥ 28pt, tap targets ≥ 68pt.
 */

export const colors = {
  sky: "#FFFFFF",
  skyGlowSoft: "#FFF3E2",
  skyGlowWarm: "#FFC46A",
  skyMutedSoft: "#F4F0EB",
  skyMutedWarm: "#DDD6CE",
  bowlTop: "#FF6A00",
  bowlBottom: "#FF9E1B",
  orbTop: "#FFB300",
  orbBottom: "#FF6A00",
  orbGlow: "#FF8A00",
  orbMuted: "#B9B4AD",
  orbMutedDark: "#8F8A83",
  greeting: "#8E939B",
  ink: "#3A3530",
  inkSoft: "#6B645C",
  onOrange: "#FFFFFF",
  pill: "#F6E3CF",
  pillActive: "#FBD2AE",
  control: "#FFFFFF",
  controlIcon: "#3A3530",
  micLive: "#FF6A00",
  micLiveIcon: "#FFFFFF",
  caret: "#1E88E5",
  danger: "#B3261E",
  noFill: "#FFFFFF",
  noBorder: "#D7CFC6",
  userBubble: "#111111",
  onUserBubble: "#FFFFFF",
  chatCard: "#FFFFFF",
  chatLine: "#EEF1EF",
  mapWash: "#E7F6F1",
  pin: "#0F6B5C",
  saved: "#0F6B5C",
  bookedWash: "#E8F6F1",
  selectedFill: "#FFF4E8",
  selectedLine: "#FF6A00",
  statusTrack: "#EEF1EF",
  failWash: "#FDECEC",
  cancelFill: "#F2F2F2",
} as const;

export const type = {
  greeting: { fontFamily: "Georgia", fontSize: 36, lineHeight: 42 },
  reply: { fontFamily: "Georgia", fontSize: 30, lineHeight: 38 },
  transcript: { fontSize: 28, lineHeight: 36 },
  label: { fontSize: 20, lineHeight: 26 },
  button: { fontSize: 22, lineHeight: 28 },
  yesNo: { fontFamily: "Georgia", fontSize: 32, lineHeight: 38 },
  price: { fontFamily: "Georgia", fontSize: 44, lineHeight: 50 },
  input: { fontSize: 24, lineHeight: 30 },
  eyebrow: { fontSize: 13, lineHeight: 16, letterSpacing: 1.2, fontWeight: "700" as const },
  cardTitle: { fontSize: 22, lineHeight: 28, fontWeight: "600" as const },
} as const;

export const size = {
  orb: 72,
  orbGlyph: 32,
  pillHeight: 84,
  micButton: 68,
  yesNo: 76,
  overflowWidth: 68,
  iconLg: 32,
  iconMd: 26,
  screenGutter: 24,
} as const;

export const radius = {
  pill: 42,
  overflow: 34,
  button: 22,
  card: 28,
  bubble: 22,
  chip: 18,
} as const;
