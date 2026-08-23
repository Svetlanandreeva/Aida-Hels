import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import dayjs from "dayjs";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth } from "@/src/emergent/health-context";
import { useLog } from "@/src/components/LogProvider";
import { CONTENT_MAX, fontSize, radius, spacing } from "@/src/emergent/tokens";
import { Txt, PillButton, ThemeToggle } from "@/src/emergent/ui";
import { Card, EmptyState, FloatingAdd, IconTile } from "@/src/emergent/health";

export default function Labs() {
  const { colors, theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const { state } = useHealth();
  const { openLab } = useLog();
  const m = t.mod;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120, alignItems: "center" }}>
        <View style={styles.wrap}>
          <View style={styles.header}>
            <Txt variant="h1">{m.labsTitle}</Txt>
            <ThemeToggle />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <PillButton testID="labs-add" label={m.addLab} onPress={() => openLab()} icon="add" full />
          </View>

          {state.labs.length > 0 ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {state.labs.map((l) => (
                <View key={l.id} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <IconTile icon="flask-outline" />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Txt variant="h3" style={{ fontSize: fontSize.lg }}>{l.name}</Txt>
                    <Txt variant="label" color={colors.muted} weight="medium">{dayjs(l.ts).format("D MMM YYYY")}</Txt>
                  </View>
                  <Txt variant="h3" color={colors.brand}>{l.value} <Txt variant="label" color={colors.muted}>{l.unit}</Txt></Txt>
                </View>
              ))}
            </View>
          ) : (
            <Card style={{ marginTop: spacing.lg }}>
              <EmptyState icon="flask-outline" text={m.noLabs} actionLabel={m.addLab} onAction={() => openLab()} />
            </Card>
          )}
        </View>
      </ScrollView>
      <FloatingAdd onPress={() => openLab()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: CONTENT_MAX, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2 },
});
