import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Txt } from "@/src/emergent/ui";

export const figma = {
  bg: "#EAEAE8",
  card: "#FBFBFA",
  ink: "#1B1B1D",
  muted: "#8A8A8E",
  soft: "#626265",
  divider: "#DCDCD8",
  lime: "#CFF24A",
  green: "#4EBB8B",
  orange: "#F39A3A",
  rose: "#EE8BB3",
  pink: "#F6A8C9",
  blue: "#CFD7F5",
  red: "#FF315B",
};

export const gradients = {
  status: ["#F6D8B0", "#F79C7E", "#EE8BB3"] as const,
  ai: ["#E7F7A6", "#CFF24A", "#B9E22E"] as const,
  bio: ["#D9EBFA", "#CFD7F5", "#D5C6EB"] as const,
  women: ["#FBD6E4", "#F6A8C9", "#F1A1C7"] as const,
  pressure: ["#F9D7C4", "#F5B39F", "#EBA8C4"] as const,
  wellbeing: ["#EDE8FF", "#D7E8FF", "#F7DDEC"] as const,
  meds: ["#FFF1B7", "#F5D98D", "#F6B9C8"] as const,
};

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}>
    <Txt variant="h3" style={styles.sectionTitle}>{title}</Txt>
    {action ? <Pressable disabled={!onPress} onPress={onPress}><Txt variant="label" color={figma.muted} weight="semibold">{action}</Txt></Pressable> : null}
  </View>;
}

export function FCard({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GradientPanel({ colors, children, style }: { colors: readonly [string, string, ...string[]]; children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradient, style]}>{children}</LinearGradient>;
}

export function RoundIcon({ icon, size = 44, bg = "rgba(255,255,255,.72)", color = figma.ink }: { icon: keyof typeof Ionicons.glyphMap; size?: number; bg?: string; color?: string }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={Math.round(size * .48)} color={color} /></View>;
}

export function AddCard({ title, subtitle, icon = "add", onPress, dark = false, testID }: { title: string; subtitle: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; dark?: boolean; testID?: string }) {
  const ink = dark ? "#FFFFFF" : figma.ink;
  return <Pressable testID={testID} onPress={onPress} style={[styles.addCard, { backgroundColor: dark ? figma.ink : figma.card }]}>
    <RoundIcon icon={icon} bg={dark ? "rgba(255,255,255,.12)" : figma.bg} color={ink} />
    <View style={{ flex: 1 }}><Txt variant="caption" weight="bold" color={ink}>{title}</Txt><Txt variant="label" color={dark ? "#BDBDC1" : figma.muted} style={{ marginTop: 3 }}>{subtitle}</Txt></View>
    <Ionicons name="chevron-forward" size={20} color={dark ? "#FFFFFF" : figma.muted} />
  </Pressable>;
}

export function MetricMini({ label, value, dot = figma.green }: { label: string; value: string; dot?: string }) {
  return <View style={styles.metricMini}><View style={styles.metricTop}><Txt variant="label" color={figma.muted}>{label}</Txt><View style={[styles.dot, { backgroundColor: dot }]} /></View><Txt variant="h2" style={{ marginTop: 4 }}>{value}</Txt></View>;
}

export function EmptyCopy({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body?: string }) {
  return <View style={styles.empty}><RoundIcon icon={icon} bg={figma.bg} /><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{title}</Txt>{body ? <Txt variant="label" color={figma.muted} style={{ marginTop: 3 }}>{body}</Txt> : null}</View></View>;
}

export function Bars({ values, max = 100, height = 120, width = 22 }: { values: number[]; max?: number; height?: number; width?: number }) {
  return <View style={[styles.bars, { height }]}>{values.map((v, i) => <View key={i} style={[styles.bar, { width, height: Math.max(8, Math.round((Math.max(0, v) / Math.max(1, max)) * height)), opacity: i === values.length - 1 ? 1 : .48 }]} />)}</View>;
}

export const mobileStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: figma.bg },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  subtitle: { marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: figma.divider },
});

const styles = StyleSheet.create({
  sectionHeader: { marginTop: 24, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, lineHeight: 22 },
  card: { borderRadius: 26, backgroundColor: figma.card, padding: 16 },
  gradient: { borderRadius: 26, padding: 16, overflow: "hidden" },
  addCard: { minHeight: 78, borderRadius: 26, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  metricMini: { flex: 1, minHeight: 88, borderRadius: 20, backgroundColor: figma.card, padding: 14 },
  metricTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { flexDirection: "row", alignItems: "center", gap: 12 },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  bar: { borderRadius: 999, backgroundColor: figma.ink },
});
