import { memo, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

const COLORS = ["#f6c445", "#4fe3a8", "#ff7d6e", "#9fc4ff", "#e08a1e", "#d59bff"];
const PIECES = 28;

/** Falling confetti over the whole screen, for a win. Draws nothing with "reduce motion" on. */
export const Confetti = memo(function Confetti() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const pieces = useMemo(() => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return Array.from({ length: PIECES }, (_, index) => {
      const sway = (rand() - 0.5) * 120;
      const spin = 360 + rand() * 540;
      return {
        key: index,
        left: rand() * width,
        width: 6 + rand() * 5,
        height: 10 + rand() * 8,
        color: COLORS[index % COLORS.length],
        duration: 2800 + rand() * 2400,
        delay: rand() * 1800,
        fall: {
          "0%": { transform: [{ translateY: 0 }, { translateX: 0 }, { rotate: "0deg" }] },
          "50%": { transform: [{ translateY: (height + 60) / 2 }, { translateX: sway }, { rotate: `${spin / 2}deg` }] },
          "100%": { transform: [{ translateY: height + 60 }, { translateX: -sway / 2 }, { rotate: `${spin}deg` }] },
        },
      };
    });
  }, [width, height]);

  if (reduceMotion) return null;
  return (
    <View style={styles.root}>
      {pieces.map((piece) => (
        <Animated.View
          key={piece.key}
          style={[
            styles.piece,
            {
              left: piece.left,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              animationName: piece.fall,
              animationDuration: piece.duration,
              animationDelay: piece.delay,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    pointerEvents: "none",
  },
  piece: {
    position: "absolute",
    top: -30,
    borderRadius: 2,
  },
});
