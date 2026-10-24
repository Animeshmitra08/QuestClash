import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { COLORS, RADIUS } from "./theme";

/**
 * Full-screen "please wait" layer for the menu screens: dims the screen and blocks taps.
 * The spinner is a native view, so it keeps turning even while JavaScript is busy (for
 * example while the next screen is being built). Render it last so it covers the screen.
 */
export function LoadingOverlay({ label }: { label: string }) {
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop} accessibilityViewIsModal>
      <View style={styles.card} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 4, 12, 0.6)",
  },
  card: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 22,
    paddingHorizontal: 32,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(26, 19, 44, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(246, 196, 69, 0.4)",
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.5)",
  },
  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
