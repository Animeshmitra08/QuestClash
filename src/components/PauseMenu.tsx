import { Pressable, StyleSheet, Text, View } from "react-native";

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Shown while the game is paused. The game world and timer are frozen behind it. */
export function PauseMenu({ onResume, onRestart, onQuit }: PauseMenuProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>Paused</Text>
        <MenuButton label="Resume" onPress={onResume} primary />
        <MenuButton label="Restart stage" onPress={onRestart} />
        <MenuButton label="Quit to menu" onPress={onQuit} />
      </View>
    </View>
  );
}

function MenuButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, !primary && styles.secondary, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, !primary && styles.secondaryText]}>{label}</Text>
    </Pressable>
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
    width: 280,
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 2,
    borderColor: "#8a7654",
    alignItems: "stretch",
    gap: 10,
  },
  title: {
    color: "#f2c230",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  button: {
    backgroundColor: "#f2c230",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
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
