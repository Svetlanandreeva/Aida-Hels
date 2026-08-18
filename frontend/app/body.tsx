import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { withTimeout } from "@/src/async";
import { BodySystemInsight, getBodySystems } from "@/src/bodyApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const SYSTEM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  mental: "happy-outline",
  respiratory: "fitness-outline",
  cardiovascular: "heart-outline",
  digestive: "nutrition-outline",
  metabolic: "flash-outline",
  reproductive: "female-outline",
  musculoskeletal: "body-outline",
  sleep_recovery: "moon-outline",
};

export default function BodyScreen() {
  const { activeId } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [age, setAge] = useState<any>(null);
  const [systems, setSystems] = useState<BodySystemInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemsError, setSystemsError] = useState(false);
  const [ageError, setAgeError] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSystemsError(false);
    setAgeError(false);
    const [ageResult, systemsResult] = await Promise.allSettled([
      withTimeout(api.biologicalAge(activeId), 6500, "biological_age"),
      withTimeout(getBodySystems(activeId), 6500, "body_systems"),
    ]);

    if (ageResult.status === "fulfilled") setAge(ageResult.value);
    else setAgeError(true);

    if (systemsResult.status === "fulfilled") setSystems(systemsResult.value.systems || []);
    else setSystemsError(true);

    setLoading(false);
  }, [activeId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openSystem = (id: string) => router.push({ pathname: "/body-system" as any, params: { systemId: id } });

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={ru ? "Назад" : "Back"}>
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>{ru ? "Организм" : "Body"}</Text>
      <Text style={styles.sub}>{ru ? "Только данные с источником. Если информации мало, Аида показывает недостаток данных вместо красивой выдуманной цифры." : "Only sourced data. When evidence is insufficient, Aida shows that instead of inventing a score."}</Text>

      {loading ? <InlineState text={ru ? "Обновляем данные организма…" : "Refreshing body data…"} loading /> : null}

      <View style={styles.systemsCard}>
        <Text style={styles.label}>{ru ? "Системы организма" : "Body systems"}</Text>
        <Text style={styles.systemsHint}>{ru ? "Откройте нужный раздел, чтобы увидеть подтверждённые данные и их источники." : "Open a section to see confirmed records and their sources."}</Text>

        {systems.length > 0 ? (
          <View style={styles.tileGrid}>
            {systems.map((system) => {
              const hasData = system.state === "data";
              return (
                <Pressable
                  key={system.id}
                  style={styles.tile}
                  onPress={() => openSystem(system.id)}
                  testID={`body-system-tile-${system.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={ru ? system.label_ru : system.label_en}
                >
                  <View style={[styles.tileIcon, hasData && styles.tileIconData]}>
                    <Ionicons name={SYSTEM_ICONS[system.id] || "medical-outline"} size={24} color={hasData ? colors.success : colors.onSurface} />
                  </View>
                  <View style={styles.tileCopy}>
                    <Text style={styles.tileTitle}>{ru ? system.label_ru : system.label_en}</Text>
                    <Text style={styles.tileMeta}>{hasData ? (ru ? `Есть данные · ${system.evidence_count}` : `Data available · ${system.evidence_count}`) : (ru ? "Недостаточно данных" : "Insufficient data")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceSecondary} />
                </Pressable>
              );
            })}
          </View>
        ) : !loading && !systemsError ? (
          <InlineState text={ru ? "Для систем организма пока недостаточно данных." : "There is not enough body-system data yet."} />
        ) : null}

        {systemsError ? <InlineState text={ru ? "Не удалось обновить системы. Можно повторить без перезагрузки экрана." : "Could not refresh systems. Retry without leaving the screen."} action={ru ? "Повторить" : "Retry"} onAction={() => void load()} /> : null}
      </View>

      <View style={styles.ageCard}>
        <Text style={styles.label}>{ru ? "Оценка биологического возраста" : "Biological age estimate"}</Text>
        {age?.state === "data" ? (
          <>
            <Text style={styles.age}>{age.age}</Text>
            <Text style={styles.ageMeta}>{ru ? `Хронологический: ${age.chronological_age}` : `Chronological: ${age.chronological_age}`}</Text>
            <Text style={styles.note}>{ru ? "Это wellness-оценка по доступным измерениям, не медицинский диагноз." : "This is a wellness estimate from available measurements, not a medical diagnosis."}</Text>
            <View style={styles.factors}>{(age.factors || []).map((factor: any) => <View key={factor.metric} style={styles.factor}><Text style={styles.factorName}>{factor.metric}</Text><Text style={styles.factorValue}>{String(factor.value)}</Text></View>)}</View>
          </>
        ) : ageError ? (
          <InlineState text={ru ? "Оценка возраста сейчас недоступна. Остальной раздел продолжает работать." : "The age estimate is unavailable right now. The rest of the section remains usable."} />
        ) : (
          <InlineState text={ru ? "Расчёт биологического возраста пока не выполняется: валидированная версия модели не включена. Аида не будет придумывать wellness-возраст." : "Biological age is not calculated yet because a validated model is not enabled. Aida will not invent a wellness age."} />
        )}
        <Pressable style={styles.ageAction} onPress={() => router.push("/biological-age" as any)} testID="open-biological-age">
          <Text style={styles.ageActionText}>{age?.state === "data" ? (ru ? "Почему так?" : "Why this result?") : (ru ? "Что нужно добавить?" : "What should I add?")}</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.onSurface} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InlineState({ text, loading = false, action, onAction }: { text: string; loading?: boolean; action?: string; onAction?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="small" color={colors.onSurface} /> : <Ionicons name="information-circle-outline" size={20} color={colors.onSurfaceSecondary} />}<Text style={styles.stateText}>{text}</Text>{action && onAction ? <Pressable onPress={onAction} style={styles.retry}><Text style={styles.retryText}>{action}</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: spacing.xl },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "800", fontFamily: fonts.display, color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  systemsCard: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  systemsHint: { fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, marginTop: 4 },
  tileGrid: { marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { flexBasis: "48%", flexGrow: 1, minWidth: 220, minHeight: 112, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md },
  tileIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tileIconData: { backgroundColor: "#E8F5EC" },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface },
  tileMeta: { fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, marginTop: 4 },
  ageCard: { marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary },
  age: { fontSize: 62, lineHeight: 68, fontWeight: "800", fontFamily: fonts.display, color: colors.onSurface, marginTop: 4 },
  ageMeta: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface },
  note: { fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  factors: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.lg },
  factor: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  factorName: { fontSize: 11, color: colors.onSurfaceSecondary },
  factorValue: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface },
  ageAction: { minHeight: 48, marginTop: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  ageActionText: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface },
  state: { minHeight: 56, flexDirection: "row", gap: 8, alignItems: "center", marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  stateText: { flex: 1, color: colors.onSurfaceSecondary, lineHeight: 20 },
  retry: { minHeight: 38, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.onSurface, justifyContent: "center" },
  retryText: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: 12 },
});
