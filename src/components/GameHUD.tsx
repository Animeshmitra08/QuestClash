import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatTime } from "@/systems/ScoreSystem";
import type { ItemDefinition } from "@/types/game";

import { Inventory } from "./Inventory";

interface GameHUDProps {
  objective: string;
  elapsedSeconds: number;
  /** When set, the timer counts down to zero instead of up. */
  timeLimitSeconds: number | null;
  score: number;
  inventory: readonly ItemDefinition[];
  onPause: () => void;
}

/** Below this many seconds left, the countdown turns red. */
const LOW_TIME_SECONDS = 15;

/**
 * Top bar shown during play: inventory (left), current objective (center),
 * timer, score and pause button (right). Bottom-corner controls live in GameControls.
 */
export function GameHUD({ objective, elapsedSeconds, timeLimitSeconds, score, inventory, onPause }: GameHUDProps) {
  const insets = useSafeAreaInsets();
  const remaining = timeLimitSeconds === null ? null : Math.max(0, timeLimitSeconds - elapsedSeconds);
  const timeText = formatTime(remaining ?? elapsedSeconds);
  const lowTime = remaining !== null && remaining <= LOW_TIME_SECONDS;

  return (
    <View
      style={[
        styles.bar,
        { top: insets.top + 10, left: insets.left + 16, right: insets.right + 16 },
      ]}
      pointerEvents="box-none"
    >
      <Inventory items={inventory} />

      <View style={styles.objective} pointerEvents="none" accessibilityLabel={`Objective: ${objective}`}>
        <Text style={styles.objectiveLabel}>OBJECTIVE</Text>
        <Text style={styles.objectiveText} numberOfLines={2}>
          {objective}
        </Text>
      </View>

      <View style={styles.right} pointerEvents="box-none">
        <View style={styles.stats} pointerEvents="none">
          <Text
            style={[styles.stat, lowTime && styles.lowTime]}
            accessibilityLabel={remaining === null ? `Time ${timeText}` : `Time left ${timeText}`}
          >
            {remaining === null ? "⏱" : "⌛"} {timeText}
          </Text>
          <Text style={styles.stat} accessibilityLabel={`Score ${score}`}>
            ★ {score}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.pause, pressed && styles.pausePressed]}
          onPress={onPause}
          accessibilityRole="button"
          accessibilityLabel="Pause"
          hitSlop={10}
        >
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </Pressable>
      </View>
    </View>
  );
}

const PANEL = "rgba(27, 23, 18, 0.7)";

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  objective: {
    flexShrink: 1,
    maxWidth: "40%",
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: PANEL,
    alignItems: "center",
  },
  objectiveLabel: {
    color: "#f2c230",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  objectiveText: {
    color: "#f2e6d0",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stats: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: PANEL,
    alignItems: "flex-end",
  },
  stat: {
    color: "#f2e6d0",
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  lowTime: {
    color: "#ff7a6b",
  },
  pause: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: "rgba(242, 230, 208, 0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pausePressed: {
    opacity: 0.7,
  },
  pauseBar: {
    width: 5,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#f2e6d0",
  },
});
