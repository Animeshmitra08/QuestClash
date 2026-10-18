import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PuzzleDefinition } from "@/types/game";

interface PuzzleDialogProps {
  puzzle: PuzzleDefinition;
  /** Resolves true if the answer was correct; the parent then closes the dialog. Online this waits for the server. */
  onAnswer: (optionIndex: number) => Promise<boolean>;
  onClose: () => void;
}

/** Multiple-choice puzzle panel. Wrong answers show a hint and let the player try again. */
export function PuzzleDialog({ puzzle, onAnswer, onClose }: PuzzleDialogProps) {
  const [showHint, setShowHint] = useState(false);
  // One answer at a time: online, a second tap while waiting would be a second answer.
  const [checking, setChecking] = useState(false);

  const choose = async (index: number) => {
    if (checking) return;
    setChecking(true);
    const correct = await onAnswer(index);
    setChecking(false);
    if (!correct) setShowHint(true);
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>{puzzle.title}</Text>
        <Text style={styles.question}>{puzzle.question}</Text>

        <View style={styles.options}>
          {puzzle.options.map((option, index) => (
            <Pressable
              key={option}
              style={({ pressed }) => [styles.option, (pressed || checking) && styles.optionPressed]}
              onPress={() => choose(index)}
              disabled={checking}
              accessibilityRole="button"
            >
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          ))}
        </View>

        {showHint && <Text style={styles.hint}>{puzzle.wrongAnswerHint}</Text>}

        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.close}>Step away</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  panel: {
    width: "70%",
    maxWidth: 560,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 2,
    borderColor: "#8a7654",
    alignItems: "center",
  },
  title: {
    color: "#f2c230",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  question: {
    color: "#f2e6d0",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  option: {
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f2c230",
    alignItems: "center",
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionText: {
    color: "#1b1712",
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    color: "#e8a07a",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 14,
  },
  close: {
    color: "#c9b99c",
    fontSize: 15,
    marginTop: 16,
    textDecorationLine: "underline",
  },
});
