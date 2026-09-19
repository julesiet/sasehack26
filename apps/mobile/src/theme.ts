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
} as const;

export const type = {
  greeting: { fontFamily: "Georgia", fontSize: 36, lineHeight: 42 },
  reply: { fontFamily: "Georgia", fontSize: 30, lineHeight: 38 },
  transcript: { fontSize: 28, lineHeight: 36 },
  label: { fontSize: 20, lineHeight: 26 },
  button: { fontSize: 22, lineHeight: 28 },
  input: { fontSize: 24, lineHeight: 30 },
} as const;

export const size = {
  orb: 72,
  orbGlyph: 32,
  pillHeight: 84,
  micButton: 68,
  overflowWidth: 68,
  iconLg: 32,
  iconMd: 26,
  screenGutter: 24,
} as const;

export const radius = {
  pill: 42,
  overflow: 34,
  button: 22,
} as const;
