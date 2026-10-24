import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { COLORS } from "@/components/ui/theme";

/**
 * Same size and colour as the native splash in app.json (expo-splash-screen: imageWidth 140,
 * backgroundColor #120d1f), so the hand-over from the native splash to this one is invisible.
 */
const LOGO_SIZE = 140;
const BACKGROUND = "#120d1f";

/** How long the splash stays before fading out, and how long the fade takes. */
const HOLD_MS = 1700;
const REDUCED_HOLD_MS = 500;
const FADE_OUT_MS = 450;
/** Hide the native splash anyway if the logo hasn't reported loading by then. */
const NATIVE_HIDE_FALLBACK_MS = 1000;

/** Starts dark (matching the native splash, which has no glow), swells, settles. */
const GLOW = { "0%": { opacity: 0 }, "35%": { opacity: 0.75 }, "65%": { opacity: 0.5 }, "100%": { opacity: 0.7 } };

/**
 * The branded intro shown over the app at launch. It takes over from the native splash
 * (identical logo and background), adds the title and a loading bar, then fades away to
 * the screen underneath. Fades only, nothing bounces. With reduced motion it's shorter
 * and still.
 */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const nativeHidden = useRef(false);

  // The native splash stays up (preventAutoHideAsync in _layout) until this one is drawn.
  const hideNative = () => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hide();
  };

  useEffect(() => {
    const fallback = setTimeout(hideNative, NATIVE_HIDE_FALLBACK_MS);
    const leave = setTimeout(() => setLeaving(true), reduceMotion ? REDUCED_HOLD_MS : HOLD_MS);
    return () => {
      clearTimeout(fallback);
      clearTimeout(leave);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (!leaving) return;
    const done = setTimeout(onDone, reduceMotion ? 0 : FADE_OUT_MS);
    return () => clearTimeout(done);
  }, [leaving, reduceMotion, onDone]);

  const fadeIn = (delay: number) =>
    reduceMotion
      ? null
      : { animationName: { from: { opacity: 0 }, to: { opacity: 1 } }, animationDuration: 500, animationDelay: delay, animationFillMode: "both" as const };

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity: leaving ? 0 : 1, transitionProperty: "opacity", transitionDuration: FADE_OUT_MS, transitionTimingFunction: "ease-in" },
      ]}
      pointerEvents={leaving ? "none" : "auto"}
      accessible
      accessibilityLabel="QuestClash is loading"
    >
      <StatusBar hidden />

      {/* A warm glow swelling up behind the key. */}
      <Animated.View
        style={[
          styles.glow,
          reduceMotion ? styles.glowStill : { animationName: GLOW, animationDuration: HOLD_MS, animationFillMode: "both" },
        ]}
      />

      <Image source={require("@/assets/images/QuestClash.png")} style={styles.logo} onLoadEnd={hideNative} />

      <View style={styles.below}>
        <Animated.Text style={[styles.title, fadeIn(250)]}>QUESTCLASH</Animated.Text>
        <Animated.Text style={[styles.tagline, fadeIn(450)]}>Find the key · Solve the puzzle · Escape</Animated.Text>
        <Animated.View style={[styles.track, fadeIn(600)]}>
          <Animated.View
            style={[
              styles.fill,
              reduceMotion
                ? styles.fillFull
                : {
                    animationName: { from: { width: "0%" }, to: { width: "100%" } },
                    animationDuration: HOLD_MS - 650,
                    animationDelay: 600,
                    animationTimingFunction: "ease-out",
                    animationFillMode: "both",
                  },
            ]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND,
  },
  glow: {
    position: "absolute",
    width: LOGO_SIZE * 2.2,
    height: LOGO_SIZE * 2.2,
    borderRadius: LOGO_SIZE * 1.1,
    experimental_backgroundImage: "radial-gradient(circle, rgba(246, 196, 69, 0.45) 0%, rgba(80, 140, 255, 0.18) 45%, rgba(18, 13, 31, 0) 70%)",
  },
  glowStill: {
    opacity: 0.6,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  // Below the logo without moving it: the logo stays exactly where the native splash had it.
  below: {
    position: "absolute",
    top: "50%",
    marginTop: LOGO_SIZE / 2 + 18,
    alignItems: "center",
    gap: 6,
  },
  title: {
    color: COLORS.gold,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 8,
    textShadowColor: "rgba(246, 170, 60, 0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  tagline: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  track: {
    width: 160,
    height: 3,
    marginTop: 8,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.gold,
  },
  fillFull: {
    width: "100%",
  },
});
