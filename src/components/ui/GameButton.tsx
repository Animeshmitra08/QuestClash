import { useState } from "react";
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { COLORS, GOLD_GRADIENT, RADIUS } from "./theme";
import { usePressScale } from "./usePressScale";

type Variant = "primary" | "secondary" | "success" | "ghost";

interface GameButtonProps {
  label: string;
  onPress: () => void;
  /** A glyph or emoji shown before the label. */
  icon?: string;
  variant?: Variant;
  size?: "md" | "lg";
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  /** A light sweep across the button, to draw the eye to the main action. */
  shimmer?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const FILLS: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: COLORS.gold,
    experimental_backgroundImage: GOLD_GRADIENT,
    boxShadow: "0 6px 18px rgba(246, 170, 60, 0.45)",
  },
  success: {
    backgroundColor: COLORS.success,
    experimental_backgroundImage: "linear-gradient(135deg, #6ff0bd 0%, #24b886 100%)",
    boxShadow: "0 6px 18px rgba(79, 227, 168, 0.4)",
  },
  secondary: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(246, 196, 69, 0.75)",
  },
  ghost: {
    backgroundColor: "transparent",
  },
};

/** The menu screens' button: springs down when pressed. */
export function GameButton({
  label,
  onPress,
  icon,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  shimmer = false,
  accessibilityLabel,
  style,
}: GameButtonProps) {
  const reduceMotion = useReducedMotion();
  const press = usePressScale();
  const [width, setWidth] = useState(0);
  const inactive = disabled || loading;
  const darkText = variant === "primary" || variant === "success";

  return (
    <Animated.View style={[press.style, inactive && styles.inactive, style]}>
      <Pressable
        onPress={onPress}
        {...press.handlers}
        disabled={inactive}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.base, size === "lg" ? styles.large : styles.medium, FILLS[variant]]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inactive, busy: loading }}
      >
        {shimmer && !inactive && !reduceMotion && width > 0 && (
          <View style={styles.shimmerClip}>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  animationName: {
                    "0%": { transform: [{ translateX: -80 }, { skewX: "-20deg" }] },
                    "60%": { transform: [{ translateX: width + 20 }, { skewX: "-20deg" }] },
                    "100%": { transform: [{ translateX: width + 20 }, { skewX: "-20deg" }] },
                  },
                  animationDuration: 3200,
                  animationIterationCount: "infinite",
                  animationTimingFunction: "ease-in-out",
                },
              ]}
            />
          </View>
        )}
        {loading ? (
          <ActivityIndicator color={darkText ? COLORS.ink : COLORS.gold} />
        ) : (
          icon && <Text style={[styles.icon, size === "lg" && styles.iconLarge, { color: darkText ? COLORS.ink : COLORS.gold }]}>{icon}</Text>
        )}
        <Text
          style={[
            styles.label,
            size === "lg" && styles.labelLarge,
            { color: darkText ? COLORS.ink : variant === "ghost" ? COLORS.textMuted : COLORS.gold },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  medium: {
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  inactive: {
    opacity: 0.45,
  },
  icon: {
    fontSize: 16,
    fontWeight: "900",
  },
  iconLarge: {
    fontSize: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  labelLarge: {
    fontSize: 19,
  },
  shimmerClip: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderRadius: RADIUS.md,
    pointerEvents: "none",
  },
  shimmer: {
    position: "absolute",
    top: -10,
    bottom: -10,
    width: 50,
    experimental_backgroundImage:
      "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%)",
  },
});
