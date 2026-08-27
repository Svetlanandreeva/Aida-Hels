import React from "react";
import { StyleSheet, View, Pressable, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useApp } from "@/src/emergent/AppContext";
import { StatusKind } from "@/src/emergent/health-context";
import { radius, spacing, fontSize } from "@/src/emergent/tokens";
import { Txt, shadow } from "@/src/emergent/ui";

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors } = useApp();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  actionLabel,
  onAction,
  icon,
  testID,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.sectionTitle}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        {icon ? <Ionicons name={icon} size={18} color={colors.onSurface} style={{ marginRight: 8 }} /> : null}
        <Txt variant="h3" style={{ fontSize: fontSize.xl }}>{title}</Txt>
      </View>
      {actionLabel && onAction ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={6}>
          <Txt variant="label" weight="bold" color={colors.brand}>{actionLabel}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatusBadge({ status, label }: { status: StatusKind; label: string }) {
  const { colors } = useApp();
  const map = {
    normal: { bg: "#E7F8EC", fg: colors.success, dark: "rgba(48,209,88,0.16)" },
    attention: { bg: colors.brandSecondary, fg: colors.brand, dark: colors.brandSecondary },
    noData: { bg: colors.surfaceTertiary, fg: colors.muted, dark: colors.surfaceTertiary },
  } as const;
  const c = map[status];
  return (
    <View style={[styles.badge, { backgroundColor: colors.glassTint === "dark" ? c.dark : c.bg }]}>
      <Txt variant="label" weight="bold" color={c.fg}>{label}</Txt>
    </View>
  );
}

export function IconTile({ icon, tint }: { icon: keyof typeof Ionicons.glyphMap; tint?: string }) {
  const { colors } = useApp();
  return (
    <View style={[styles.iconTile, { backgroundColor: colors.brandSecondary }]}>
      <Ionicons name={icon} size={20} color={tint ?? colors.brand} />
    </View>
  );
}

export function EmptyState({
  icon,
  text,
  actionLabel,
  onAction,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <Ionicons name={icon} size={22} color={colors.muted} />
      </View>
      <Txt variant="caption" color={colors.muted} center style={{ marginTop: spacing.sm, flex: 1 }}>{text}</Txt>
      {actionLabel && onAction ? (
        <Pressable testID={testID} onPress={onAction} style={[styles.emptyBtn, { backgroundColor: colors.brandSecondary }]}>
          <Txt variant="label" weight="bold" color={colors.brand}>{actionLabel}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ScaleRow({
  label,
  value,
  onChange,
  invert,
  testID,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  invert?: boolean;
  testID?: string;
}) {
  const { colors } = useApp();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Txt variant="label" weight="semibold" color={colors.muted} style={{ marginBottom: 8 }}>{label}</Txt>
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= value;
          const color = invert ? colors.warning : colors.brand;
          return (
            <Pressable
              key={n}
              testID={testID ? `${testID}-${n}` : undefined}
              onPress={() => onChange(n)}
              style={[
                styles.scaleDot,
                { backgroundColor: active ? color : colors.surfaceTertiary, borderColor: active ? color : colors.border },
              ]}
            >
              <Txt variant="label" weight="bold" color={active ? "#FFFFFF" : colors.muted}>{n}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MetricRow({
  icon,
  title,
  value,
  sub,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  sub?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useApp();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.metricRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <IconTile icon={icon} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Txt variant="label" weight="bold" style={{ fontSize: fontSize.lg }}>{title}</Txt>
        {sub ? <Txt variant="label" color={colors.muted} weight="medium" style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
      <Txt variant="h3" color={colors.brand} style={{ fontSize: fontSize.lg }}>{value}</Txt>
    </Pressable>
  );
}

export function FloatingAdd({ onPress }: { onPress: () => void }) {
  const { colors } = useApp();
  return (
    <Pressable testID="fab-add" onPress={onPress} style={[styles.fab, { backgroundColor: colors.brand }, shadow(colors.brand)]}>
      <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md, marginTop: spacing.xl },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, alignSelf: "flex-start" },
  iconTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  empty: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  emptyIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  emptyBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, marginLeft: spacing.sm },
  scaleRow: { flexDirection: "row", gap: spacing.sm },
  scaleDot: { flex: 1, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  metricRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  fab: { position: "absolute", right: spacing.xl, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
