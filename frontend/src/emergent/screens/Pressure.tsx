import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth, useDerived, bpStatus } from "@/src/emergent/health-context";
import { useAddSheet } from "@/src/emergent/AddSheet";
import { CONTENT_MAX, fontSize, radius, spacing } from "@/src/emergent/tokens";
import { Txt, PillButton, ThemeToggle } from "@/src/emergent/ui";
import { Card, StatusBadge, EmptyState, FloatingAdd, IconTile } from "@/src/emergent/health";

export default function Pressure() {
  const { colors, theme, t, lang } = useApp();
  const insets = useSafeAreaInsets();
  const { state } = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const m = t.mod;
  const statusLabel = (k: "normal" | "attention" | "noData") => m.statuses[k];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120, alignItems: "center" }}>
        <View style={styles.wrap}>
          <View style={styles.header}>
            <Txt variant="h1">{m.pressureTitle}</Txt>
            <ThemeToggle />
          </View>

          {/* Latest */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="label" weight="bold" color={colors.muted}>{m.latestReading}</Txt>
              {d.latestBp ? <StatusBadge status={bpStatus(d.latestBp)} label={statusLabel(bpStatus(d.latestBp))} /> : null}
            </View>
            {d.latestBp ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: spacing.sm, gap: spacing.xl }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <Txt variant="display" color={colors.brand} style={{ fontSize: 52, lineHeight: 54 }}>{d.latestBp.sys}</Txt>
                  <Txt variant="h1" color={colors.muted}>/{d.latestBp.dia}</Txt>
                </View>
                {d.latestBp.pulse ? (
                  <View style={{ marginBottom: 6 }}>
                    <Txt variant="label" color={colors.muted} weight="semibold">{m.pulse}</Txt>
                    <Txt variant="h2">{d.latestBp.pulse}</Txt>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <EmptyState icon="pulse-outline" text={m.noReadings} />
              </View>
            )}
            <View style={{ marginTop: spacing.md }}>
              <PillButton testID="pressure-add" label={m.addReading} onPress={() => open("bp")} icon="add" full />
            </View>
          </Card>

          {/* List */}
          {state.bp.length > 0 ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {state.bp.map((r) => (
                <View key={r.id} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <IconTile icon="pulse-outline" />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Txt variant="h3" style={{ fontSize: fontSize.lg }}>{r.sys}/{r.dia} <Txt variant="label" color={colors.muted}>{r.pulse ? `· ${r.pulse} ${lang === "ru" ? "пульс" : "bpm"}` : ""}</Txt></Txt>
                    <Txt variant="label" color={colors.muted} weight="medium">{dayjs(r.ts).format("D MMM, HH:mm")}</Txt>
                  </View>
                  <View style={[styles.dot, { backgroundColor: bpStatus(r) === "attention" ? colors.brand : colors.success }]} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <FloatingAdd onPress={() => open("bp")} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: CONTENT_MAX, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
