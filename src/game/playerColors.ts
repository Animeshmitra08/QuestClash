/**
 * Body colour per player slot (0–4). Slot 0 keeps the original blue.
 * Kept apart from Player.tsx so menus (lobby, results) can use it without loading the 3D engine.
 */
const SLOT_COLORS = ["#2f6fb3", "#c0392b", "#2e9e5b", "#8e44ad", "#d9822b"] as const;

export function playerColor(slot: number): string {
  return SLOT_COLORS[slot % SLOT_COLORS.length];
}
