import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatTime, type ScoreBreakdown } from "@/systems/ScoreSystem";

interface StageCompleteDialogProps {
  elapsedSeconds: number;
  score: ScoreBreakdown;
  onRestart: () => void;
  onExit: () => void;
}

/** Shown when the player reaches the exit: final time, score breakdown, and what next. */
export function StageCompleteDialog({ elapsedSeconds, score, onRestart, onExit }: StageCompleteDialogProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>Stage Complete!</Text>
        <Text style={styles.subtitle}>You escaped the Forgotten Temple in {formatTime(elapsedSeconds)}</Text>

        {/* Scrolls if the breakdown doesn't fit on a short landscape screen. */}
        <ScrollView style={styles.breakdown} contentContainerStyle={styles.breakdownContent}>
          {score.lines.map((line) => (
            <View key={line.label} style={styles.line}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text style={[styles.linePoints, line.points < 0 && styles.negative]}>
                {line.points > 0 ? `+${line.points}` : line.points}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.line, styles.totalLine]}>
          <Text style={styles.totalLabel}>Score</Text>
          <Text style={styles.totalPoints}>{score.total}</Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={onRestart}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Play again</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            onPress={onExit}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Main menu</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  panel: {
    width: "55%",
    maxWidth: 460,
    maxHeight: "92%",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 2,
    borderColor: "#3fe0b0",
  },
  title: {
    color: "#3fe0b0",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#f2e6d0",
    fontSize: 15,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 10,
  },
  breakdown: {
    flexGrow: 0,
  },
  breakdownContent: {
    gap: 2,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  lineLabel: {
    color: "#c9b99c",
    fontSize: 14,
  },
  linePoints: {
    color: "#f2e6d0",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  negative: {
    color: "#e8826f",
  },
  totalLine: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(242, 230, 208, 0.25)",
  },
  totalLabel: {
    color: "#f2c230",
    fontSize: 18,
    fontWeight: "800",
  },
  totalPoints: {
    color: "#f2c230",
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 14,
  },
  button: {
    backgroundColor: "#f2c230",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#f2c230",
  },
  pressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#1b1712",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryText: {
    color: "#f2c230",
  },
});
