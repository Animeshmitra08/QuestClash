import { StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import type { Notice } from "@/systems/StageManager";

const TONE_COLORS: Record<Notice["tone"], string> = {
  info: "#8a7654",
  success: "#f2c230",
  danger: "#d9534f",
};

/**
 * Short pop-up message at the top of the screen. The StageManager decides when
 * it disappears (in game time), so this component has no timers of its own.
 */
export function NoticeToast({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  return (
    <Animated.View
      // A new key per notice replays the entrance animation even for identical text.
      key={notice.id}
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(300)}
      style={[styles.toast, { borderColor: TONE_COLORS[notice.tone] }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{notice.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    // Below the HUD's objective panel.
    top: 84,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: "rgba(27, 23, 18, 0.9)",
  },
  text: {
    color: "#f2e6d0",
    fontSize: 16,
    fontWeight: "700",
  },
});
