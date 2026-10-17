import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface LevelErrorScreenProps {
  levelId: string;
  errors: string[];
  onRetry: () => void;
  onExit: () => void;
}

/**
 * Shown instead of the game when a level's configuration fails validation, so a
 * broken level is a readable message rather than a crash.
 */
export function LevelErrorScreen({ levelId, errors, onRetry, onExit }: LevelErrorScreenProps) {
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.panel}>
        <Text style={styles.title}>This level couldn&apos;t be loaded</Text>
        <Text style={styles.subtitle}>Level &quot;{levelId}&quot; has configuration problems:</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {errors.map((error) => (
            <Text key={error} style={styles.error}>
              • {error}
            </Text>
          ))}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onExit} accessibilityRole="button">
            <Text style={styles.buttonText}>Back to menu</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Try again</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b1712",
  },
  panel: {
    width: "70%",
    maxWidth: 600,
    maxHeight: "90%",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 2,
    borderColor: "#d9534f",
  },
  title: {
    color: "#f2e6d0",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#c9b99c",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 4,
  },
  error: {
    color: "#e8a07a",
    fontSize: 13,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    backgroundColor: "#f2c230",
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryText: {
    color: "#f2c230",
  },
});
