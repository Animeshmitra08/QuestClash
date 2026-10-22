import { memo, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

/**
 * Animated landscape behind the menu screens: a temple on the hills under a dusk
 * (home) or night (online) sky, with drifting clouds, parallax mountains, birds,
 * twinkling stars and rising embers / fireflies.
 *
 * Built from plain Views (gradients via React Native's CSS gradient support) and
 * Reanimated CSS animations, which run on the UI thread: no assets, no per-frame JS.
 * Only transform and opacity animate. With the system "reduce motion" setting on,
 * the scene is drawn still.
 */

export type SceneryVariant = "dusk" | "night";

interface Palette {
  sky: string;
  skyBase: string;
  orb: string;
  /** "r, g, b" of the light around the sun/moon. */
  orbLight: string;
  orbSize: number;
  far: string;
  mid: string;
  near: string;
  temple: string;
  /** "r, g, b" of the light glowing from inside the temple. */
  templeLight: string;
  cloud: string;
  particle: string;
  particleCount: number;
  starCount: number;
  birds: boolean;
  shootingStar: boolean;
}

const PALETTES: Record<SceneryVariant, Palette> = {
  dusk: {
    sky: "linear-gradient(180deg, #1b1240 0%, #4a2163 36%, #b8436a 68%, #f59a4c 100%)",
    skyBase: "#4a2163",
    orb: "#ffd98a",
    orbLight: "255, 190, 110",
    orbSize: 84,
    far: "#7a3566",
    mid: "#45204f",
    near: "#1d1030",
    temple: "#170c26",
    templeLight: "255, 178, 92",
    cloud: "rgba(255, 200, 200, 0.16)",
    particle: "#ffc46b",
    particleCount: 14,
    starCount: 16,
    birds: true,
    shootingStar: false,
  },
  night: {
    sky: "linear-gradient(180deg, #050818 0%, #0f1c4a 45%, #2b3a7e 78%, #5e4f9c 100%)",
    skyBase: "#0f1c4a",
    orb: "#f5eed8",
    orbLight: "200, 215, 255",
    orbSize: 60,
    far: "#2c3270",
    mid: "#1b1e4a",
    near: "#0b0b22",
    temple: "#07071a",
    templeLight: "110, 230, 255",
    cloud: "rgba(190, 205, 255, 0.09)",
    particle: "#b8ffd8",
    particleCount: 18,
    starCount: 40,
    birds: false,
    shootingStar: true,
  },
};

/** Small deterministic random generator, so the scene is the same on every render. */
function seeded(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const TWINKLE = { from: { opacity: 0.15 }, to: { opacity: 1 } };
const PULSE = { from: { transform: [{ scale: 0.92 }], opacity: 0.75 }, to: { transform: [{ scale: 1.1 }], opacity: 1 } };
const FLICKER = { "0%": { opacity: 0.7 }, "40%": { opacity: 1 }, "70%": { opacity: 0.8 }, "100%": { opacity: 0.95 } };
const FLAP_LEFT = { from: { transform: [{ rotate: "28deg" }] }, to: { transform: [{ rotate: "-12deg" }] } };
const FLAP_RIGHT = { from: { transform: [{ rotate: "-28deg" }] }, to: { transform: [{ rotate: "12deg" }] } };

export const SceneryBackground = memo(function SceneryBackground({ variant = "dusk" }: { variant?: SceneryVariant }) {
  const { width, height } = useWindowDimensions();
  const animate = !useReducedMotion();
  const palette = PALETTES[variant];
  const templeScale = Math.min(1, height / 420);

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.skyBase, experimental_backgroundImage: palette.sky }]} />
      <Stars count={palette.starCount} animate={animate} />
      {palette.shootingStar && animate && <ShootingStar width={width} height={height} />}
      <Orb palette={palette} width={width} height={height} animate={animate} />
      <Clouds color={palette.cloud} width={width} height={height} animate={animate} />

      <MountainBand
        width={width}
        peakHeight={height * 0.36}
        baseHeight={height * 0.14}
        color={palette.far}
        seed={7}
        duration={140}
        animate={animate}
      />
      <MountainBand
        width={width}
        peakHeight={height * 0.24}
        baseHeight={height * 0.08}
        color={palette.mid}
        seed={23}
        duration={80}
        animate={animate}
      />

      <View style={[styles.templeSpot, { bottom: height * 0.1, left: width / 2 - 120, transform: [{ scale: templeScale }] }]}>
        <Temple color={palette.temple} light={palette.templeLight} animate={animate} />
      </View>

      <Hills color={palette.near} width={width} height={height} />
      {palette.birds && <Birds width={width} height={height} animate={animate} />}
      <Particles color={palette.particle} count={palette.particleCount} width={width} height={height} animate={animate} />

      {/* Darken the edges so text and panels stay readable over the scene. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage:
              "linear-gradient(90deg, rgba(8, 5, 20, 0.6) 0%, rgba(8, 5, 20, 0.1) 50%, rgba(8, 5, 20, 0.5) 100%)",
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { experimental_backgroundImage: "linear-gradient(0deg, rgba(8, 5, 20, 0.55) 0%, rgba(8, 5, 20, 0) 35%)" },
        ]}
      />
    </View>
  );
});

// --- Sky ------------------------------------------------------------------------------

function Stars({ count, animate }: { count: number; animate: boolean }) {
  const stars = useMemo(() => {
    const rand = seeded(101);
    return Array.from({ length: count }, (_, index) => ({
      key: index,
      left: `${rand() * 100}%` as const,
      top: `${rand() * 55}%` as const,
      size: 1.5 + rand() * 2,
      duration: 1600 + rand() * 2600,
      delay: -rand() * 4000,
    }));
  }, [count]);

  return stars.map((star) => (
    <Animated.View
      key={star.key}
      style={[
        styles.star,
        { left: star.left, top: star.top, width: star.size, height: star.size, borderRadius: star.size },
        animate && {
          animationName: TWINKLE,
          animationDuration: star.duration,
          animationDelay: star.delay,
          animationIterationCount: "infinite",
          animationDirection: "alternate",
          animationTimingFunction: "ease-in-out",
        },
      ]}
    />
  ));
}

function ShootingStar({ width, height }: { width: number; height: number }) {
  const flight = useMemo(
    () => ({
      "0%": { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "-20deg" }] },
      "2%": { opacity: 1 },
      "7%": { opacity: 0, transform: [{ translateX: -width * 0.35 }, { translateY: height * 0.14 }, { rotate: "-20deg" }] },
      "100%": { opacity: 0, transform: [{ translateX: -width * 0.35 }, { translateY: height * 0.14 }, { rotate: "-20deg" }] },
    }),
    [width, height],
  );
  return (
    <Animated.View
      style={[
        styles.shootingStar,
        {
          left: width * 0.8,
          top: height * 0.08,
          animationName: flight,
          animationDuration: 9000,
          animationDelay: 2500,
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-out",
        },
      ]}
    />
  );
}

function Orb({ palette, width, height, animate }: { palette: Palette; width: number; height: number; animate: boolean }) {
  const halo = palette.orbSize * 4;
  const pulse = animate && {
    animationName: PULSE,
    animationDuration: 4200,
    animationIterationCount: "infinite" as const,
    animationDirection: "alternate" as const,
    animationTimingFunction: "ease-in-out" as const,
  };
  return (
    <View style={[styles.orbSpot, { left: width * 0.47 - halo / 2, top: height * 0.16 - halo / 2, width: halo, height: halo }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            borderRadius: halo,
            experimental_backgroundImage: `radial-gradient(circle, rgba(${palette.orbLight}, 0.55) 0%, rgba(${palette.orbLight}, 0.14) 40%, rgba(${palette.orbLight}, 0) 70%)`,
          },
          pulse,
        ]}
      />
      <View
        style={{
          width: palette.orbSize,
          height: palette.orbSize,
          borderRadius: palette.orbSize,
          backgroundColor: palette.orb,
          boxShadow: `0 0 40px 8px rgba(${palette.orbLight}, 0.55)`,
        }}
      />
    </View>
  );
}

function Clouds({ color, width, height, animate }: { color: string; width: number; height: number; animate: boolean }) {
  const clouds = useMemo(() => {
    const rand = seeded(57);
    return Array.from({ length: 4 }, (_, index) => {
      const size = 150 + rand() * 140;
      const duration = 90_000 + rand() * 70_000;
      return {
        key: index,
        size,
        top: height * (0.06 + rand() * 0.3),
        duration,
        delay: -rand() * duration,
        drift: {
          from: { transform: [{ translateX: -size }] },
          to: { transform: [{ translateX: width + size }] },
        },
      };
    });
  }, [width, height]);

  return clouds.map((cloud, index) => (
    <Animated.View
      key={cloud.key}
      style={[
        styles.cloud,
        // Still clouds (reduce motion) are spread across the sky instead of stacked off-screen.
        { top: cloud.top, width: cloud.size, height: cloud.size * 0.4, left: animate ? 0 : (width / 4) * index },
        animate && {
          animationName: cloud.drift,
          animationDuration: cloud.duration,
          animationDelay: cloud.delay,
          animationIterationCount: "infinite",
          animationTimingFunction: "linear",
        },
      ]}
    >
      <View style={[styles.cloudPuff, { backgroundColor: color, left: "8%", width: "50%", height: "70%", top: "30%" }]} />
      <View style={[styles.cloudPuff, { backgroundColor: color, left: "28%", width: "46%", height: "100%" }]} />
      <View style={[styles.cloudPuff, { backgroundColor: color, left: "52%", width: "42%", height: "62%", top: "38%" }]} />
    </Animated.View>
  ));
}

// --- Land -----------------------------------------------------------------------------

/**
 * A row of triangular peaks that scrolls left forever. The peaks are generated for one
 * screen width and drawn at four offsets, so the band looks the same after moving one
 * width, and the loop has no visible seam.
 */
function MountainBand({
  width,
  peakHeight,
  baseHeight,
  color,
  seed,
  duration,
  animate,
}: {
  width: number;
  peakHeight: number;
  baseHeight: number;
  color: string;
  seed: number;
  duration: number;
  animate: boolean;
}) {
  const { peaks, scroll } = useMemo(() => {
    const rand = seeded(seed);
    const list: { x: number; base: number; height: number }[] = [];
    for (let x = 0; x < width; ) {
      const base = 140 + rand() * 180;
      list.push({ x, base, height: peakHeight * (0.45 + rand() * 0.55) });
      x += base * (0.4 + rand() * 0.3);
    }
    return {
      peaks: list,
      scroll: { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: -width }] } },
    };
  }, [width, peakHeight, seed]);

  return (
    <Animated.View
      style={[
        styles.band,
        { width, height: peakHeight + baseHeight },
        animate && {
          animationName: scroll,
          animationDuration: duration * 1000,
          animationIterationCount: "infinite",
          animationTimingFunction: "linear",
        },
      ]}
    >
      <View style={{ position: "absolute", left: -width, width: width * 4, bottom: 0, height: baseHeight + 1, backgroundColor: color }} />
      {[-width, 0, width, 2 * width].map((offset) =>
        peaks.map((peak, index) => (
          <View
            key={`${offset}-${index}`}
            style={[
              styles.peak,
              {
                left: offset + peak.x,
                bottom: baseHeight,
                borderLeftWidth: peak.base / 2,
                borderRightWidth: peak.base / 2,
                borderBottomWidth: peak.height,
                borderBottomColor: color,
              },
            ]}
          />
        )),
      )}
    </Animated.View>
  );
}

function Hills({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <>
      <View style={[styles.hill, { backgroundColor: color, width: width * 0.8, height: height * 0.5, left: -width * 0.15, bottom: -height * 0.36 }]} />
      <View style={[styles.hill, { backgroundColor: color, width: width * 0.9, height: height * 0.5, left: width * 0.3, bottom: -height * 0.38 }]} />
      <View style={[styles.hill, { backgroundColor: color, width: width * 0.6, height: height * 0.4, left: width * 0.7, bottom: -height * 0.3 }]} />
    </>
  );
}

const COLUMN_COUNT = 6;

function Temple({ color, light, animate }: { color: string; light: string; animate: boolean }) {
  return (
    <View style={styles.temple}>
      <Animated.View
        style={[
          styles.templeHalo,
          { experimental_backgroundImage: `radial-gradient(circle, rgba(${light}, 0.35) 0%, rgba(${light}, 0) 65%)` },
          animate && {
            animationName: PULSE,
            animationDuration: 3600,
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationTimingFunction: "ease-in-out",
          },
        ]}
      />
      <View style={[styles.pediment, { borderBottomColor: color }]} />
      <View style={[styles.entablature, { backgroundColor: color }]} />
      <View style={styles.colonnade}>
        <Animated.View
          style={[
            styles.innerLight,
            { experimental_backgroundImage: `linear-gradient(0deg, rgba(${light}, 0.85) 0%, rgba(${light}, 0.05) 100%)` },
            animate && {
              animationName: FLICKER,
              animationDuration: 2400,
              animationIterationCount: "infinite",
              animationDirection: "alternate",
            },
          ]}
        />
        {Array.from({ length: COLUMN_COUNT }, (_, index) => (
          <View key={index} style={[styles.column, { backgroundColor: color }]} />
        ))}
      </View>
      {[210, 226, 242].map((stepWidth) => (
        <View key={stepWidth} style={[styles.step, { width: stepWidth, backgroundColor: color }]} />
      ))}
    </View>
  );
}

// --- Life -----------------------------------------------------------------------------

function Birds({ width, height, animate }: { width: number; height: number; animate: boolean }) {
  const birds = useMemo(() => {
    const rand = seeded(311);
    return Array.from({ length: 3 }, (_, index) => {
      const duration = 26_000 + rand() * 12_000;
      const bob = 8 + rand() * 10;
      return {
        key: index,
        top: height * (0.18 + rand() * 0.2),
        scale: 0.7 + rand() * 0.5,
        duration,
        delay: -rand() * duration,
        flight: {
          "0%": { transform: [{ translateX: -40 }, { translateY: 0 }] },
          "50%": { transform: [{ translateX: width / 2 }, { translateY: -bob }] },
          "100%": { transform: [{ translateX: width + 40 }, { translateY: 0 }] },
        },
      };
    });
  }, [width, height]);

  if (!animate) return null;
  return birds.map((bird) => (
    <Animated.View
      key={bird.key}
      style={[
        styles.bird,
        {
          top: bird.top,
          animationName: bird.flight,
          animationDuration: bird.duration,
          animationDelay: bird.delay,
          animationIterationCount: "infinite",
          animationTimingFunction: "linear",
        },
      ]}
    >
      <View style={[styles.birdBody, { transform: [{ scale: bird.scale }] }]}>
        <Animated.View
          style={[styles.wing, styles.wingLeft, { animationName: FLAP_LEFT, animationDuration: 380, animationIterationCount: "infinite", animationDirection: "alternate" }]}
        />
        <Animated.View
          style={[styles.wing, styles.wingRight, { animationName: FLAP_RIGHT, animationDuration: 380, animationIterationCount: "infinite", animationDirection: "alternate" }]}
        />
      </View>
    </Animated.View>
  ));
}

/** Embers (dusk) or fireflies (night) drifting up from the ground. */
function Particles({
  color,
  count,
  width,
  height,
  animate,
}: {
  color: string;
  count: number;
  width: number;
  height: number;
  animate: boolean;
}) {
  const particles = useMemo(() => {
    const rand = seeded(977);
    return Array.from({ length: count }, (_, index) => {
      const duration = 7000 + rand() * 8000;
      const sway = (rand() - 0.5) * 70;
      const rise = height * (0.5 + rand() * 0.45);
      return {
        key: index,
        left: rand() * width,
        size: 2.5 + rand() * 3.5,
        duration,
        delay: -rand() * duration,
        drift: {
          "0%": { opacity: 0, transform: [{ translateY: 0 }, { translateX: 0 }] },
          "15%": { opacity: 1 },
          "50%": { transform: [{ translateY: -rise / 2 }, { translateX: sway }] },
          "80%": { opacity: 0.8 },
          "100%": { opacity: 0, transform: [{ translateY: -rise }, { translateX: -sway / 2 }] },
        },
      };
    });
  }, [count, width, height]);

  if (!animate) return null;
  return particles.map((particle) => (
    <Animated.View
      key={particle.key}
      style={[
        styles.particle,
        {
          left: particle.left,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size,
          backgroundColor: color,
          boxShadow: `0 0 ${particle.size * 2}px ${particle.size / 2}px ${color}`,
          animationName: particle.drift,
          animationDuration: particle.duration,
          animationDelay: particle.delay,
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        },
      ]}
    />
  ));
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    pointerEvents: "none",
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  star: {
    position: "absolute",
    backgroundColor: "#fffbe8",
  },
  shootingStar: {
    position: "absolute",
    width: 90,
    height: 2,
    borderRadius: 2,
    opacity: 0,
    experimental_backgroundImage: "linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)",
  },
  orbSpot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  cloud: {
    position: "absolute",
  },
  cloudPuff: {
    position: "absolute",
    borderRadius: 999,
  },
  band: {
    position: "absolute",
    left: 0,
    bottom: 0,
  },
  peak: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  hill: {
    position: "absolute",
    borderRadius: 9999,
  },
  templeSpot: {
    position: "absolute",
    width: 240,
    alignItems: "center",
    transformOrigin: "bottom",
  },
  temple: {
    width: 240,
    alignItems: "center",
  },
  templeHalo: {
    position: "absolute",
    width: 380,
    height: 380,
    top: -130,
    left: -70,
    borderRadius: 380,
  },
  pediment: {
    width: 0,
    height: 0,
    borderLeftWidth: 106,
    borderRightWidth: 106,
    borderBottomWidth: 34,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  entablature: {
    width: 200,
    height: 10,
  },
  colonnade: {
    width: 184,
    height: 66,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  innerLight: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 0,
    bottom: 0,
  },
  column: {
    width: 12,
    height: "100%",
  },
  step: {
    height: 7,
  },
  bird: {
    position: "absolute",
    left: 0,
  },
  birdBody: {
    width: 22,
    height: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  wing: {
    width: 11,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#1a0f24",
  },
  wingLeft: {
    transformOrigin: "right",
  },
  wingRight: {
    transformOrigin: "left",
  },
  particle: {
    position: "absolute",
    bottom: -8,
    opacity: 0,
  },
});
