import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
  Platform,
  StyleProp,
  TextStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  withSequence,
  useAnimatedRef,
  measure,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";

import { useApp } from "@/src/emergent/AppContext";
import { font, fontSize, radius, spacing } from "@/src/emergent/tokens";

/* ---------------- Typography ---------------- */

type TxtProps = TextProps & {
  variant?: "display" | "h1" | "h2" | "h3" | "body" | "caption" | "label";
  color?: string;
  weight?: keyof typeof font;
  center?: boolean;
};

export function Txt({ variant = "body", color, weight, center, style, ...rest }: TxtProps) {
  const { colors } = useApp();
  const map: Record<string, TextStyle> = {
    display: { fontSize: fontSize["4xl"], fontFamily: font.extrabold, lineHeight: 46 },
    h1: { fontSize: fontSize["3xl"], fontFamily: font.extrabold, lineHeight: 40 },
    h2: { fontSize: fontSize["2xl"], fontFamily: font.bold, lineHeight: 30 },
    h3: { fontSize: fontSize.xl, fontFamily: font.bold, lineHeight: 26 },
    body: { fontSize: fontSize.lg, fontFamily: font.regular, lineHeight: 24 },
    caption: { fontSize: fontSize.base, fontFamily: font.regular, lineHeight: 20 },
    label: { fontSize: fontSize.sm, fontFamily: font.semibold, lineHeight: 16 },
  };
  return (
    <Text
      {...rest}
      style={[
        map[variant],
        { color: color ?? colors.onSurface },
        weight ? { fontFamily: font[weight] } : null,
        center ? { textAlign: "center" } : null,
        style,
      ]}
    />
  );
}

/* ---------------- Glass surface ---------------- */

export function Glass({
  children,
  style,
  intensity = 40,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  testID?: string;
}) {
  const { theme, colors } = useApp();
  if (Platform.OS === "web") {
    return (
      <View
        testID={testID}
        style={[
          { backgroundColor: theme === "dark" ? "rgba(20,20,22,0.72)" : "rgba(255,255,255,0.72)" },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView testID={testID} intensity={intensity} tint={colors.glassTint} style={style}>
      {children}
    </BlurView>
  );
}

/* ---------------- Pill button ---------------- */

type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  full?: boolean;
  size?: "md" | "lg";
};

export function PillButton({ label, onPress, variant = "primary", icon, testID, full, size = "md" }: BtnProps) {
  const { colors } = useApp();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === "primary" ? colors.brandPrimary : variant === "secondary" ? colors.surfaceSecondary : "transparent";
  const fg =
    variant === "primary" ? colors.onBrandPrimary : variant === "ghost" ? colors.brand : colors.onSurfaceSecondary;
  const borderColor = variant === "secondary" ? colors.border : "transparent";

  const vPad = size === "lg" ? 16 : 13;

  return (
    <Animated.View style={[aStyle, full ? { alignSelf: "stretch" } : undefined]}>
      <Pressable
        testID={testID}
        onPress={() => {
          Haptics.impactAsync(
            variant === "primary" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
          );
          onPress();
        }}
        onPressIn={() => (scale.value = withTiming(0.96, { duration: 100 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
        style={[
          styles.btn,
          {
            backgroundColor: bg,
            borderColor,
            borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth * 2 : 0,
            paddingVertical: vPad,
          },
          variant === "primary" ? shadow(colors.brandPrimary) : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
        <Text style={{ color: fg, fontFamily: font.bold, fontSize: fontSize.lg }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({ label, icon }: { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useApp();
  return (
    <View style={[styles.badge, { backgroundColor: colors.brandSecondary }]}>
      {icon ? <Ionicons name={icon} size={14} color={colors.onBrandSecondary} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: colors.onBrandSecondary, fontFamily: font.semibold, fontSize: fontSize.sm, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

/* ---------------- Section header ---------------- */

export function SectionHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { colors } = useApp();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      {eyebrow ? (
        <Text style={{ color: colors.brand, fontFamily: font.bold, fontSize: fontSize.sm, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
          {eyebrow}
        </Text>
      ) : null}
      <Txt variant="h1">{title}</Txt>
      {subtitle ? (
        <Txt variant="body" color={colors.muted} style={{ marginTop: 10 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------------- Toggles ---------------- */

export function ThemeToggle() {
  const { theme, toggleTheme, colors } = useApp();
  return (
    <Pressable
      testID="theme-toggle"
      onPress={toggleTheme}
      hitSlop={8}
      style={[styles.iconChip, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}
    >
      <Ionicons name={theme === "dark" ? "sunny-outline" : "moon-outline"} size={18} color={colors.onSurface} />
    </Pressable>
  );
}

export function LangToggle() {
  const { lang, toggleLang, colors } = useApp();
  return (
    <Pressable
      testID="lang-toggle"
      onPress={toggleLang}
      hitSlop={8}
      style={[styles.iconChip, { paddingHorizontal: 12, width: undefined, backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}
    >
      <Text style={{ color: colors.onSurface, fontFamily: font.bold, fontSize: fontSize.sm }}>
        {lang === "ru" ? "RU" : "EN"}
      </Text>
    </Pressable>
  );
}

/* ---------------- Animated DNA helix ---------------- */

export function DNAHelix({ size = 220 }: { size?: number }) {
  const { colors } = useApp();
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
  }, [phase]);

  const rungs = 16;
  const dots = Array.from({ length: rungs });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={[styles.glowRing, { width: size * 0.9, height: size * 0.9, backgroundColor: colors.heroGlow }]} />
      {dots.map((_, i) => (
        <HelixPair key={i} index={i} total={rungs} size={size} phase={phase} colorA={colors.brand} colorB={colors.info} />
      ))}
    </View>
  );
}

function HelixPair({
  index,
  total,
  size,
  phase,
  colorA,
  colorB,
}: {
  index: number;
  total: number;
  size: number;
  phase: SharedValue<number>;
  colorA: string;
  colorB: string;
}) {
  const amp = size * 0.32;
  const y = (index / (total - 1)) * size - size / 2;

  const styleA = useAnimatedStyle(() => {
    const angle = (index / total) * Math.PI * 2 + phase.value * Math.PI * 2;
    const x = Math.sin(angle) * amp;
    const depth = (Math.cos(angle) + 1) / 2; // 0..1
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale: 0.5 + depth * 0.7 }],
      opacity: 0.35 + depth * 0.65,
    };
  });
  const styleB = useAnimatedStyle(() => {
    const angle = (index / total) * Math.PI * 2 + phase.value * Math.PI * 2 + Math.PI;
    const x = Math.sin(angle) * amp;
    const depth = (Math.cos(angle) + 1) / 2;
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale: 0.5 + depth * 0.7 }],
      opacity: 0.35 + depth * 0.65,
    };
  });

  const dot = { position: "absolute" as const, width: 12, height: 12, borderRadius: 6 };

  return (
    <>
      <Animated.View style={[dot, { backgroundColor: colorA }, styleA]} />
      <Animated.View style={[dot, { backgroundColor: colorB }, styleB]} />
    </>
  );
}

/* ---------------- Pulsing dot (for tags) ---------------- */

export function PulseDot({ color }: { color: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withSequence(withTiming(1.6, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
  }, [s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: interpolate(s.value, [1, 1.6], [1, 0.3]) }));
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: color }, a]} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

/* ---------------- Animated count-up ---------------- */

export function AnimatedCounter({
  value,
  play,
  color,
  size = 40,
}: {
  value: string;
  play: boolean;
  color: string;
  size?: number;
}) {
  const match = /^(\d+)(.*)$/.exec(value);
  const isNumeric = !!match;
  const target = match ? parseInt(match[1], 10) : 0;
  const suffix = match ? match[2] : "";
  const [display, setDisplay] = useState(isNumeric ? `0${suffix}` : value);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return;
    }
    if (!play) {
      setDisplay(`0${suffix}`);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const dur = 1400;
    const tick = () => {
      const t = Math.min((Date.now() - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(`${Math.round(eased * target)}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, value]);

  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{ color, fontFamily: font.extrabold, fontSize: size, lineHeight: size + 4 }}
    >
      {display}
    </Text>
  );
}

/* ---------------- Scroll reveal ---------------- */

type RevealCtxValue = { scrollY: SharedValue<number>; winH: number } | null;
const RevealContext = createContext<RevealCtxValue>(null);

export function RevealProvider({
  scrollY,
  winH,
  children,
}: {
  scrollY: SharedValue<number>;
  winH: number;
  children: React.ReactNode;
}) {
  return <RevealContext.Provider value={{ scrollY, winH }}>{children}</RevealContext.Provider>;
}

export function Reveal({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ctx = useContext(RevealContext);
  const aref = useAnimatedRef<Animated.View>();
  const isWeb = Platform.OS === "web";
  const aStyle = useAnimatedStyle(() => {
    if (isWeb || !ctx) return { opacity: 1 };
    // read scroll so the worklet recomputes on every scroll frame
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tick = ctx.scrollY.value;
    const m = measure(aref);
    if (m === null) return { opacity: 1, transform: [{ translateY: 0 }] };
    const trigger = ctx.winH * 0.92;
    const p = interpolate(m.pageY, [trigger, trigger - 110], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 30 }] };
  });
  return (
    <Animated.View ref={aref} style={[style, aStyle]}>
      {children}
    </Animated.View>
  );
}

/* ---------------- helpers ---------------- */

export function shadow(color = "#000"): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }) as ViewStyle;
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: radius.pill,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  iconChip: {
    height: 40,
    minWidth: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  glowRing: {
    position: "absolute",
    borderRadius: 999,
  },
});

