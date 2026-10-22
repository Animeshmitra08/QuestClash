/** Shared look for the menu screens (home, online). The in-game HUD keeps its own styles. */
export const COLORS = {
  gold: "#f6c445",
  goldDeep: "#e08a1e",
  ink: "#120d1f",
  text: "#fbf3e4",
  textMuted: "#cfc2ae",
  textDim: "#8f8499",
  panel: "rgba(22, 16, 38, 0.62)",
  panelBorder: "rgba(255, 236, 200, 0.16)",
  field: "rgba(255, 255, 255, 0.07)",
  fieldBorder: "rgba(255, 236, 200, 0.22)",
  success: "#4fe3a8",
  danger: "#ff7d6e",
} as const;

/** Gold call-to-action fill (React Native's CSS gradient support; plain gold where unsupported). */
export const GOLD_GRADIENT = `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldDeep} 100%)`;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 22,
  pill: 999,
} as const;
