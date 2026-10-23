import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { GameButton } from "./GameButton";
import { COLORS, RADIUS } from "./theme";

interface NoticeDialogProps {
  title: string;
  message: string;
  /** A smaller line under the message, e.g. what to do next. */
  hint?: string;
  closeLabel?: string;
  onClose: () => void;
}

/**
 * A card over the dimmed screen with one button to dismiss it. Tapping outside the
 * card or pressing Android's back button closes it too. Render it last so it covers
 * the whole screen.
 */
export function NoticeDialog({ title, message, hint, closeLabel = "Close", onClose }: NoticeDialogProps) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true; // handled: don't also leave the screen
    });
    return () => subscription.remove();
  }, [onClose]);

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
        <View style={styles.icon}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        <GameButton label={closeLabel} bouncy={false} onPress={onClose} style={styles.button} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(6, 4, 12, 0.7)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(26, 19, 44, 0.97)",
    borderWidth: 1,
    borderColor: "rgba(246, 196, 69, 0.45)",
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(246, 196, 69, 0.16)",
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  iconText: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: "900",
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  hint: {
    color: COLORS.textDim,
    fontSize: 13,
    textAlign: "center",
  },
  button: {
    alignSelf: "stretch",
    marginTop: 8,
  },
});
