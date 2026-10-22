import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { COLORS, RADIUS } from "./theme";

/** A frosted card floating over the scenery. Fades and rises in when it mounts. */
export function Panel({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500).springify().damping(18)} style={[styles.panel, style]}>
      {children}
    </Animated.View>
  );
}

/** Small uppercase label with a glowing accent bar, used above titles. */
export function Eyebrow({ children, color = COLORS.gold }: { children: string; color?: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <View style={[styles.eyebrowBar, { backgroundColor: color, boxShadow: `0 0 8px ${color}` }]} />
      <Text style={[styles.eyebrow, { color }]}>{children}</Text>
    </View>
  );
}

/** A red notice that slides in; for connection and request errors. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <Animated.View
      key={message}
      entering={FadeInDown.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.errorBanner}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.errorIcon}>!</Text>
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
}

/** A soft informational line (e.g. "waking the server up"). */
export function InfoNote({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.infoNote} accessibilityLiveRegion="polite">
      <Text style={styles.infoText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    gap: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45)",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrowBar: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(255, 90, 80, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 125, 110, 0.5)",
  },
  errorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 20,
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.ink,
    backgroundColor: COLORS.danger,
  },
  errorText: {
    flex: 1,
    color: "#ffd9d3",
    fontSize: 13,
    fontWeight: "600",
  },
  infoNote: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(140, 170, 255, 0.12)",
  },
  infoText: {
    color: "#cdd8ff",
    fontSize: 12,
  },
});
