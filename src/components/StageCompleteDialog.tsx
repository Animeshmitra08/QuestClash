import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatTime, type ScoreBreakdown } from "@/systems/ScoreSystem";

interface StageCompleteDialogProps {
  levelName: string;
  elapsedSeconds: number;
  score: ScoreBreakdown;
  /** Omitted when this player can't restart (online, not the host). */
  onRestart?: () => void;
  /** Shown as the main button when there is a next level. */
  onNextLevel?: () => void;
  onExit: () => void;
  /** Online, for everyone but the host: who decides what happens next. */
  waitingNote?: string;
  /** Label for the exit button (e.g. "Leave room" online). */
  exitLabel?: string;
}

const MAX_STARS = 3;

/** Shown when the player reaches the exit: stars, final time, score breakdown, and what next. */
export function StageCompleteDialog({
  levelName,
  elapsedSeconds,
  score,
  onRestart,
  onNextLevel,
  onExit,
  waitingNote,
  exitLabel = "Main menu",
}: StageCompleteDialogProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>Level Complete!</Text>
        <Text style={styles.stars} accessibilityLabel={`${score.stars} of ${MAX_STARS} stars`}>
          {"★".repeat(score.stars)}
          <Text style={styles.starsEmpty}>{"★".repeat(MAX_STARS - score.stars)}</Text>
        </Text>
        <Text style={styles.subtitle}>
          You escaped {levelName} in {formatTime(elapsedSeconds)}
        </Text>

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
          {onNextLevel && (
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={onNextLevel}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Next level</Text>
            </Pressable>
          )}
          {onRestart && (
            <Pressable
              style={({ pressed }) => [styles.button, onNextLevel && styles.secondary, pressed && styles.pressed]}
              onPress={onRestart}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, onNextLevel && styles.secondaryText]}>Play again</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            onPress={onExit}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>{exitLabel}</Text>
          </Pressable>
        </View>
        {waitingNote && <Text style={styles.waiting}>{waitingNote}</Text>}
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
  waiting: {
    color: "#c9b99c",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
  },
  stars: {
    color: "#f2c230",
    fontSize: 30,
    textAlign: "center",
    letterSpacing: 4,
  },
  starsEmpty: {
    color: "rgba(242, 230, 208, 0.2)",
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
