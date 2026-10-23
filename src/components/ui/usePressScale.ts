import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

const SPRING = { damping: 14, stiffness: 320, mass: 0.6 };
const TIMING = { duration: 90 };

/**
 * A "pressed in" scale for Pressables: spread the handlers on the Pressable, the style on an Animated.View.
 * Springy by default; pass `bouncy = false` for a plain ease with no overshoot.
 */
export function usePressScale(pressedScale = 0.95, bouncy = true) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const animate = (to: number) => (bouncy ? withSpring(to, SPRING) : withTiming(to, TIMING));
  return {
    style,
    handlers: {
      onPressIn: () => {
        if (!reduceMotion) scale.set(animate(pressedScale));
      },
      onPressOut: () => {
        scale.set(animate(1));
      },
    },
  };
}
