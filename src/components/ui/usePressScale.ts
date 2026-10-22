import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

const SPRING = { damping: 14, stiffness: 320, mass: 0.6 };

/** A springy "pressed in" scale for Pressables: spread the handlers on the Pressable, the style on an Animated.View. */
export function usePressScale(pressedScale = 0.95) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return {
    style,
    handlers: {
      onPressIn: () => {
        if (!reduceMotion) scale.set(withSpring(pressedScale, SPRING));
      },
      onPressOut: () => {
        scale.set(withSpring(1, SPRING));
      },
    },
  };
}
