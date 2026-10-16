import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const SIZE = 84;
/** Effectively "no limit": a long press still counts as one press. */
const MAX_HOLD_MS = 60_000;

interface ActionButtonProps {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Round game button that fires the moment a finger touches it (not on release),
 * which feels more responsive in games. Works while the joystick is held.
 */
export function ActionButton({ label, accessibilityLabel, onPress, style }: ActionButtonProps) {
  const pressed = useSharedValue(0);

  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(MAX_HOLD_MS)
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: 60 }));
      onPress();
    })
    .onFinalize(() => {
      pressed.set(withTiming(0, { duration: 120 }));
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * 0.1 }],
    opacity: 0.8 + pressed.get() * 0.2,
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[styles.button, animatedStyle, style]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2c230",
    borderWidth: 3,
    borderColor: "rgba(27, 23, 18, 0.4)",
  },
  label: {
    color: "#1b1712",
    fontSize: 18,
    fontWeight: "800",
  },
});
