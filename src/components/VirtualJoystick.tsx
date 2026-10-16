import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const BASE_RADIUS = 64;
const KNOB_RADIUS = 28;
/** Extra touchable margin around the base, so a slightly-off thumb still grabs the stick. */
const TOUCH_PADDING = 32;
const AREA_SIZE = (BASE_RADIUS + TOUCH_PADDING) * 2;
const CENTER = AREA_SIZE / 2;
const RETURN_DURATION_MS = 90;

interface VirtualJoystickProps {
  /** Stick deflection, each axis in [-1, 1]; y is positive when pushed up. */
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fixed on-screen analog stick.
 *
 * Uses react-native-gesture-handler rather than React Native's built-in touch
 * system because the built-in one handles only one touch at a time: the player
 * couldn't hold the stick and press the action button together.
 */
export function VirtualJoystick({ onMove, onRelease, style }: VirtualJoystickProps) {
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);
  const active = useSharedValue(0);

  const handleTouch = (touchX: number, touchY: number) => {
    let dx = touchX - CENTER;
    let dy = touchY - CENTER;
    const distance = Math.hypot(dx, dy);
    if (distance > BASE_RADIUS) {
      dx = (dx / distance) * BASE_RADIUS;
      dy = (dy / distance) * BASE_RADIUS;
    }
    knobX.set(dx);
    knobY.set(dy);
    // Screen y grows downward; the stick reports "up" as positive.
    onMove(dx / BASE_RADIUS, -dy / BASE_RADIUS);
  };

  const pan = Gesture.Pan()
    // Run on the JS thread: the game loop that reads this input lives there too.
    .runOnJS(true)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin((event) => {
      active.set(1);
      handleTouch(event.x, event.y);
    })
    .onUpdate((event) => handleTouch(event.x, event.y))
    .onFinalize(() => {
      knobX.set(withTiming(0, { duration: RETURN_DURATION_MS }));
      knobY.set(withTiming(0, { duration: RETURN_DURATION_MS }));
      active.set(0);
      onRelease();
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.get() }, { translateY: knobY.get() }],
  }));

  const baseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + active.get() * 0.3,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.area, style]}
        accessibilityRole="adjustable"
        accessibilityLabel="Movement joystick"
      >
        <Animated.View style={[styles.base, baseStyle]} />
        <Animated.View style={[styles.knob, knobStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  area: {
    width: AREA_SIZE,
    height: AREA_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  base: {
    position: "absolute",
    width: BASE_RADIUS * 2,
    height: BASE_RADIUS * 2,
    borderRadius: BASE_RADIUS,
    backgroundColor: "rgba(27, 23, 18, 0.6)",
    borderWidth: 2,
    borderColor: "rgba(242, 230, 208, 0.5)",
  },
  knob: {
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: KNOB_RADIUS,
    backgroundColor: "rgba(242, 230, 208, 0.9)",
  },
});
