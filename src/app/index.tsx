import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HOW_TO_PLAY = [
  ["🕹️", "Drag the joystick (bottom-left) to walk."],
  ["✋", "Tap USE (bottom-right) next to glowing objects."],
  ["🗝️", "Find the key and the clue, solve the sun dial, open the door."],
  ["⚠️", "Time your run past the spikes and reach the exit."],
] as const;

export default function StartScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingLeft: insets.left + 32, paddingRight: insets.right + 32 },
      ]}
    >
      <StatusBar hidden />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>A TEMPLE PUZZLE ADVENTURE</Text>
        <Text style={styles.title}>QuestClash</Text>
        <Text style={styles.subtitle}>Stage 1 · The Forgotten Temple</Text>

        {/*
          Navigate with router.push rather than <Link asChild>: Link's Slot merges the
          child's style as a plain object, which drops a function style like this one
          (the button lost its background and became invisible).
        */}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.push("/game")}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Start Game</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How to play</Text>
        {HOW_TO_PLAY.map(([icon, text]) => (
          <View key={text} style={styles.tip}>
            <Text style={styles.tipIcon}>{icon}</Text>
            <Text style={styles.tipText}>{text}</Text>
          </View>
        ))}
        <Text style={styles.cardFooter}>Faster runs with fewer mistakes score higher.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 32,
    backgroundColor: "#1b1712",
  },
  hero: {
    flex: 1,
  },
  eyebrow: {
    color: "#f2c230",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: "#f2e6d0",
    fontSize: 48,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#c9b99c",
    fontSize: 18,
    marginBottom: 28,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#f2c230",
    paddingHorizontal: 44,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#1b1712",
    fontSize: 20,
    fontWeight: "800",
  },
  card: {
    flex: 1,
    maxWidth: 420,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 1,
    borderColor: "#8a7654",
    gap: 10,
  },
  cardTitle: {
    color: "#f2c230",
    fontSize: 18,
    fontWeight: "800",
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tipIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  tipText: {
    flex: 1,
    color: "#f2e6d0",
    fontSize: 14,
  },
  cardFooter: {
    color: "#c9b99c",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 4,
  },
});
