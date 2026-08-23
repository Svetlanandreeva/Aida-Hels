import React from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth, useDerived } from "@/src/emergent/health-context";
import { useAddSheet } from "@/src/emergent/AddSheet";
import { CONTENT_MAX, fontSize, radius, spacing } from "@/src/emergent/tokens";
import { Txt, PillButton, ThemeToggle } from "@/src/emergent/ui";
import { Card, SectionTitle, StatusBadge, EmptyState, IconTile } from "@/src/emergent/health";

const BODY_IMG = "https://images.unsplash.com/photo-1738300332814-225c81707b1b?crop=entropy&cs=srgb&fm=jpg&q=85&w=940";

const SYS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cardio: "heart-outline",
  nervous: "flash-outline",
  respiratory: "cloud-outline",
  digestive: "nutrition-outline",
  endocrine: "flask-outline",
  urinary: "water-outline",
  reproductive: "female-outline",
  musculoskeletal: "body-outline",
  immune: "shield-outline",
};

export default function Body() {
  const { colors, theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const { state } = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const m = t.mod;
  const statusLabel = (k: "normal" | "attention" | "noData") => m.statuses[k];

  const sources = [
    state.bp.length > 0 ? m.typeBp : null,
    state.labs.length > 0 ? m.typeLab : null,
    state.checkins.length > 0 ? m.typeWellbeing : null,
    state.weight.length > 0 ? m.typeWeight : null,
    state.meds.length > 0 ? m.typeMed : null,
  ].filter(Boolean) as string[];

  const observations = d.signals.length > 0
    ? d.signals
    : d.overall.enough
      ? [{ icon: "checkmark-circle-outline", title: m.statuses.normal, desc: m.dynamicsFlat }]
      : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120, alignItems: "center" }}>
        <View style={styles.wrap}>
          <View style={styles.header}>
            <Txt variant="h1">{m.bodyTitle}</Txt>
            <ThemeToggle />
          </View>

          {/* Overall body state */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Txt variant="h3">{m.overallBody}</Txt>
              {d.overall.enough ? <StatusBadge status={d.overall.status} label={statusLabel(d.overall.status)} /> : null}
            </View>
            {d.overall.enough ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: spacing.md }}>
                <Txt variant="display" color={colors.brand} style={{ fontSize: 48, lineHeight: 50 }}>{d.overall.score}</Txt>
                <Txt variant="caption" color={colors.muted} style={{ marginBottom: 8, marginLeft: 6 }}>/ 100</Txt>
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <EmptyState icon="body-outline" text={m.notEnough} actionLabel={m.addData} onAction={() => open()} />
              </View>
            )}
          </Card>

          {/* Biological age */}
          <Card style={{ marginTop: spacing.md }}>
            <Txt variant="h3">{m.bioAge}</Txt>
            {d.bioAge != null ? (
              <View style={{ flexDirection: "row", gap: spacing.xl, marginTop: spacing.md }}>
                <View>
                  <Txt variant="label" color={colors.muted} weight="semibold">{m.actualAge}</Txt>
                  <Txt variant="h1">{d.actualAge}</Txt>
                </View>
                <View>
                  <Txt variant="label" color={colors.muted} weight="semibold">{m.estimatedAge}</Txt>
                  <Txt variant="h1" color={colors.brand}>{d.bioAge}</Txt>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}><EmptyState icon="hourglass-outline" text={m.notEnough} /></View>
            )}
          </Card>

          {/* Body map */}
          <SectionTitle title={m.bodyMap} icon="scan-outline" />
          <View style={styles.map}>
            <Image source={{ uri: BODY_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            <LinearGradient colors={["transparent", theme === "dark" ? "rgba(5,5,5,0.85)" : "rgba(245,245,247,0.9)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.mapCaption}>
              <Txt variant="caption" color={colors.muted}>{m.tapOrgan}</Txt>
            </View>
          </View>

          {/* Systems */}
          <SectionTitle title={m.bodySystems} icon="body-outline" />
          <View style={{ gap: spacing.sm }}>
            {m.systems.map((sys) => {
              const st = d.systemStatus[sys.key] ?? "noData";
              return (
                <Pressable key={sys.key} testID={`body-system-${sys.key}`} style={[styles.sysRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <IconTile icon={SYS_ICON[sys.key]} />
                  <Txt variant="h3" style={{ flex: 1, marginLeft: spacing.md, fontSize: fontSize.lg }}>{sys.name}</Txt>
                  <StatusBadge status={st} label={statusLabel(st)} />
                </Pressable>
              );
            })}
          </View>

          {/* Dynamics */}
          <SectionTitle title={m.dynamics} icon="trending-up-outline" />
          <Card>
            <Txt variant="caption" color={colors.muted}>
              {d.overall.enough ? m.dynamicsFlat : m.notEnough}
            </Txt>
          </Card>

          {/* Aida observations */}
          <SectionTitle title={m.aidaObservations} icon="sparkles-outline" />
          <Card>
            {observations.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {observations.map((o, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                    <IconTile icon={o.icon as any} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Txt variant="label" weight="bold" style={{ fontSize: fontSize.lg }}>{o.title}</Txt>
                      <Txt variant="label" color={colors.muted} weight="medium" style={{ marginTop: 2 }}>{o.desc}</Txt>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="sparkles-outline" text={m.notEnough} actionLabel={m.addData} onAction={() => open()} />
            )}
          </Card>

          {/* Data sources */}
          <SectionTitle title={m.dataSources} icon="server-outline" />
          <Card>
            {sources.length > 0 ? (
              <View style={styles.chipsRow}>
                {sources.map((s) => (
                  <View key={s} style={[styles.srcChip, { backgroundColor: colors.brandSecondary }]}>
                    <Txt variant="label" weight="bold" color={colors.brand}>{s}</Txt>
                  </View>
                ))}
              </View>
            ) : (
              <Txt variant="caption" color={colors.muted}>{m.notEnough}</Txt>
            )}
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <PillButton testID="body-add" label={m.addData} onPress={() => open()} size="lg" icon="add" full />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: CONTENT_MAX, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  map: { height: 260, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  mapCaption: { padding: spacing.lg },
  sysRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  srcChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
});
