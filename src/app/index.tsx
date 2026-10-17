import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FIRST_LEVEL_ID, LEVEL_CATALOG } from "@/levels/catalog";

const HOW_TO_PLAY = [
  ["🕹️", "Drag the joystick (bottom-left) to walk."],
  ["✋", "Tap USE (bottom-right) next to glowing objects."],
] as const;

function play(levelId: string) {
  router.push({ pathname: "/game", params: { level: levelId } });
}

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
        <Text style={styles.subtitle}>Find keys, solve puzzles, dodge the traps.</Text>

        {/*
          Navigate with router.push rather than <Link asChild>: Link's Slot merges the
          child's style as a plain object, which drops a function style like this one
          (the button lost its background and became invisible).
        */}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => play(FIRST_LEVEL_ID)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Start Game</Text>
        </Pressable>

        <View style={styles.tips}>
          {HOW_TO_PLAY.map(([icon, text]) => (
            <View key={text} style={styles.tip}>
              <Text style={styles.tipIcon}>{icon}</Text>
              <Text style={styles.tipText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Levels</Text>
        <ScrollView contentContainerStyle={styles.levelList}>
          {LEVEL_CATALOG.map((level, index) => (
            <Pressable
              key={level.id}
              style={({ pressed }) => [styles.level, pressed && styles.buttonPressed]}
              onPress={() => play(level.id)}
              accessibilityRole="button"
              accessibilityLabel={`Play level ${index + 1}, ${level.name}`}
            >
              <Text style={styles.levelNumber}>{index + 1}</Text>
              <View style={styles.levelText}>
                <Text style={styles.levelName}>{level.name}</Text>
                <Text style={styles.levelDescription}>{level.description}</Text>
              </View>
              <Text style={styles.levelPlay}>▶</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.cardFooter}>Faster runs with fewer mistakes earn more stars.</Text>
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
    marginBottom: 24,
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
  tips: {
    marginTop: 20,
    gap: 6,
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tipIcon: {
    fontSize: 18,
    width: 26,
    textAlign: "center",
  },
  tipText: {
    flex: 1,
    color: "#c9b99c",
    fontSize: 14,
  },
  card: {
    flex: 1,
    maxWidth: 420,
    maxHeight: "90%",
    padding: 16,
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
  levelList: {
    gap: 8,
  },
  level: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(242, 230, 208, 0.06)",
  },
  levelNumber: {
    color: "#f2c230",
    fontSize: 22,
    fontWeight: "900",
    width: 24,
    textAlign: "center",
  },
  levelText: {
    flex: 1,
  },
  levelName: {
    color: "#f2e6d0",
    fontSize: 16,
    fontWeight: "700",
  },
  levelDescription: {
    color: "#c9b99c",
    fontSize: 12,
  },
  levelPlay: {
    color: "#f2c230",
    fontSize: 18,
  },
  cardFooter: {
    color: "#c9b99c",
    fontSize: 13,
    fontStyle: "italic",
  },
});
