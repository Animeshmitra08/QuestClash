import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameButton } from "@/components/ui/GameButton";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { SceneryBackground } from "@/components/ui/SceneryBackground";
import { COLORS, GOLD_GRADIENT, RADIUS } from "@/components/ui/theme";
import { usePressScale } from "@/components/ui/usePressScale";
import { FIRST_LEVEL_ID, LEVEL_CATALOG } from "@/levels/catalog";
import type { LevelDefinition } from "@/types/game";

const HOW_TO_PLAY = [
  ["🕹️", "Joystick to walk"],
  ["✋", "USE near glowing objects"],
] as const;

const FLOAT = {
  from: { transform: [{ translateY: 0 }] },
  to: { transform: [{ translateY: -6 }] },
};

function play(levelId: string) {
  router.push({ pathname: "/game", params: { level: levelId } });
}

export default function StartScreen() {
  const insets = useSafeAreaInsets();
  const animate = !useReducedMotion();
  const [openingOnline, setOpeningOnline] = useState(false);

  // Back on this screen (e.g. after leaving online play): take the overlay down.
  useFocusEffect(useCallback(() => setOpeningOnline(false), []));

  const openOnline = () => {
    if (openingOnline) return;
    setOpeningOnline(true);
    // Wait two frames so the overlay is on screen before the online screen is built,
    // which keeps JavaScript busy for a moment.
    requestAnimationFrame(() => requestAnimationFrame(() => router.push("/online")));
  };

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <SceneryBackground variant="dusk" />

      <View
        style={[
          styles.content,
          { paddingLeft: insets.left + 36, paddingRight: insets.right + 28, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.hero}>
          <Animated.View entering={FadeInLeft.duration(600)}>
            <Eyebrow>A TEMPLE PUZZLE ADVENTURE</Eyebrow>
          </Animated.View>

          {/*
            Navigation uses router.push rather than <Link asChild>: Link's Slot merges the
            child's style as a plain object, which drops function styles on Pressables.
          */}
          <Animated.View entering={FadeInLeft.delay(120).duration(700)}>
            <Animated.View
              style={
                animate && {
                  animationName: FLOAT,
                  animationDuration: 2800,
                  animationIterationCount: "infinite",
                  animationDirection: "alternate",
                  animationTimingFunction: "ease-in-out",
                }
              }
            >
              <Text style={styles.title} accessibilityRole="header">
                Quest<Text style={styles.titleAccent}>Clash</Text>
              </Text>
            </Animated.View>
          </Animated.View>

          <Animated.Text entering={FadeInLeft.delay(220).duration(700)} style={styles.subtitle}>
            Find keys, solve puzzles, dodge the traps.
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(360).duration(600)} style={styles.actions}>
            <GameButton label="Start Adventure" icon="▶" size="lg" shimmer onPress={() => play(FIRST_LEVEL_ID)} />
            <GameButton
              label="Play Online"
              icon="⚔"
              size="lg"
              variant="secondary"
              onPress={openOnline}
              loading={openingOnline}
            />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600).duration(600)} style={styles.tips}>
            {HOW_TO_PLAY.map(([icon, text]) => (
              <View key={text} style={styles.tip}>
                <Text style={styles.tipIcon}>{icon}</Text>
                <Text style={styles.tipText}>{text}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <Panel style={styles.levels} delay={250}>
          <View style={styles.levelsHeader}>
            <Text style={styles.levelsTitle}>Choose your path</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{LEVEL_CATALOG.length} levels</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.levelList} showsVerticalScrollIndicator={false}>
            {LEVEL_CATALOG.map((level, index) => (
              <Animated.View key={level.id} entering={FadeInRight.delay(400 + index * 110).duration(500)}>
                <LevelCard level={level} index={index} />
              </Animated.View>
            ))}
          </ScrollView>
          <Text style={styles.levelsFooter}>★ Faster runs with fewer mistakes earn more stars.</Text>
        </Panel>
      </View>

      {openingOnline && <LoadingOverlay label="Opening online play…" />}
    </View>
  );
}

function LevelCard({ level, index }: { level: LevelDefinition; index: number }) {
  const press = usePressScale(0.97);
  return (
    <Animated.View style={press.style}>
      <Pressable
        style={({ pressed }) => [styles.levelCard, pressed && styles.levelCardPressed]}
        onPress={() => play(level.id)}
        {...press.handlers}
        accessibilityRole="button"
        accessibilityLabel={`Play level ${index + 1}, ${level.name}`}
      >
        <View style={styles.levelBadge}>
          <Text style={styles.levelNumber}>{index + 1}</Text>
        </View>
        <View style={styles.levelText}>
          <Text style={styles.levelName} numberOfLines={1}>
            {level.name}
          </Text>
          <Text style={styles.levelDescription} numberOfLines={2}>
            {level.description}
          </Text>
        </View>
        <View style={styles.playCircle}>
          <Text style={styles.playGlyph}>▶</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
  },
  hero: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 58,
    fontWeight: "900",
    letterSpacing: -1,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  titleAccent: {
    color: COLORS.gold,
    textShadowColor: "rgba(246, 170, 60, 0.75)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 17,
    marginBottom: 14,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  tipIcon: {
    fontSize: 14,
  },
  tipText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  levels: {
    flex: 1,
    maxWidth: 400,
    maxHeight: "92%",
  },
  levelsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  levelsTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  countBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(246, 196, 69, 0.16)",
  },
  countText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  levelList: {
    gap: 10,
  },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  levelCardPressed: {
    backgroundColor: "rgba(246, 196, 69, 0.14)",
    borderColor: "rgba(246, 196, 69, 0.5)",
  },
  levelBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gold,
    experimental_backgroundImage: GOLD_GRADIENT,
    boxShadow: "0 4px 12px rgba(246, 170, 60, 0.35)",
  },
  levelNumber: {
    color: COLORS.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  levelText: {
    flex: 1,
    gap: 2,
  },
  levelName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  levelDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(246, 196, 69, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(246, 196, 69, 0.5)",
  },
  playGlyph: {
    color: COLORS.gold,
    fontSize: 13,
    marginLeft: 2,
  },
  levelsFooter: {
    color: COLORS.textDim,
    fontSize: 12,
  },
});
