import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FailReason } from "@/types/state";

interface StageFailedDialogProps {
  levelName: string;
  reason: FailReason;
  /** Omitted when this player can't restart (online, not the host). */
  onRestart?: () => void;
  onExit: () => void;
  /** Online, for everyone but the host: who decides what happens next. */
  waitingNote?: string;
  exitLabel?: string;
}

const TITLES: Record<FailReason, string> = {
  timeUp: "Out of time",
  allEliminated: "Everyone is out",
};

/** Shown when a match fails: time ran out, or every player was eliminated. */
export function StageFailedDialog({
  levelName,
  reason,
  onRestart,
  onExit,
  waitingNote,
  exitLabel = "Main menu",
}: StageFailedDialogProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>{TITLES[reason]}</Text>
        <Text style={styles.subtitle}>{levelName} has sealed itself again.</Text>
        <View style={styles.buttons}>
          {onRestart && (
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={onRestart}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Try again</Text>
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
    width: "50%",
    maxWidth: 420,
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 2,
    borderColor: "#d9534f",
    alignItems: "center",
  },
  title: {
    color: "#e8826f",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#f2e6d0",
    fontSize: 15,
    marginTop: 4,
  },
  waiting: {
    color: "#c9b99c",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 12,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
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
