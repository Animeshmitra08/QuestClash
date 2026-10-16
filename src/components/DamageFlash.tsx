import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/** Full-screen red flash each time `hitCount` goes up. */
export function DamageFlash({ hitCount }: { hitCount: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (hitCount === 0) return;
    opacity.set(withSequence(withTiming(0.55, { duration: 60 }), withTiming(0, { duration: 600 })));
  }, [hitCount, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return <Animated.View style={[styles.flash, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#b3261e",
  },
});
