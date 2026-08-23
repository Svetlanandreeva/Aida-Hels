import React, { useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import dayjs from "dayjs";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth } from "@/src/emergent/health-context";
import { CONTENT_MAX, fontSize, radius, spacing } from "@/src/emergent/tokens";
import { Txt, PillButton, ThemeToggle } from "@/src/emergent/ui";
import { Card, SectionTitle, ScaleRow, EmptyState, IconTile } from "@/src/emergent/health";

export default function Mind() {
  const { colors, theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const { state, addCheckin } = useHealth();
  const m = t.mod;

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [wellbeing, setWellbeing] = useState(3);
  const [saved, setSaved] = useState(false);

  const save = () => {
    addCheckin({ mood, energy, stress, wellbeing });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120, alignItems: "center" }}>
        <View style={styles.wrap}>
          <View style={styles.header}>
            <Txt variant="h1">{m.mindTitle}</Txt>
            <ThemeToggle />
          </View>

          <SectionTitle title={m.quickCheckin} icon="happy-outline" />
          <Card>
            <ScaleRow testID="mind-mood" label={m.mood} value={mood} onChange={setMood} />
            <ScaleRow testID="mind-energy" label={m.energy} value={energy} onChange={setEnergy} />
            <ScaleRow testID="mind-stress" label={m.stress} value={stress} onChange={setStress} invert />
            <ScaleRow testID="mind-wellbeing" label={m.wellbeing} value={wellbeing} onChange={setWellbeing} />
            <PillButton testID="mind-save" label={saved ? "✓" : m.save} onPress={save} full icon={saved ? "checkmark" : "save-outline"} />
          </Card>

          <SectionTitle title={m.history} icon="time-outline" />
          {state.checkins.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {state.checkins.map((c) => (
                <View key={c.id} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <IconTile icon="happy-outline" />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Txt variant="label" weight="bold" style={{ fontSize: fontSize.lg }}>
                      {m.mood} {c.mood} · {m.energy} {c.energy} · {m.stress} {c.stress}
                    </Txt>
                    <Txt variant="label" color={colors.muted} weight="medium">{dayjs(c.ts).format("D MMM, HH:mm")}</Txt>
                  </View>
                  <Txt variant="h3" color={colors.brand}>{c.wellbeing}/5</Txt>
                </View>
              ))}
            </View>
          ) : (
            <Card><EmptyState icon="happy-outline" text={m.notEnough} /></Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: CONTENT_MAX, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2 },
});
