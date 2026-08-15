import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme";

export function StartupPreview() {
  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    fadeIn.start();
    pulseLoop.start();
    orbitLoop.start();

    return () => {
      fadeIn.stop();
      pulseLoop.stop();
      orbitLoop.stop();
    };
  }, [fade, orbit, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.42],
  });
  const rotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} accessibilityLabel="Aida загружается">
      <View style={styles.visual}>
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale }],
            },
          ]}
        />

        <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
          <View style={styles.orbitDot} />
        </Animated.View>

        <Animated.View style={[styles.core, { transform: [{ scale }] }]}>
          <View style={styles.coreInner} />
        </Animated.View>
      </View>

      <Text style={styles.wordmark}>Aida</Text>
      <Text style={styles.caption}>Собираем картину вашего здоровья</Text>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressGlow,
            {
              opacity: glowOpacity,
              transform: [{ scaleX: scale }],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 32,
  },
  visual: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  glow: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.accent,
  },
  orbit: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: "rgba(27,27,29,0.10)",
    alignItems: "center",
  },
  orbitDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: -6,
    backgroundColor: colors.brand,
  },
  core: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  coreInner: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 6,
    borderColor: colors.accent,
  },
  wordmark: {
    color: colors.onSurface,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.2,
  },
  caption: {
    marginTop: 8,
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  progressTrack: {
    width: 96,
    height: 3,
    marginTop: 26,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
  },
  progressGlow: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
});
