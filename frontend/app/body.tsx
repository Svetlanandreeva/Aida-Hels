import React, { useCallback, useMemo, useState } from "react";
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

const MAP_POINTS: Record<string, { top: number; left: number }> = {
  mental: { top: 13, left: 48 },
  respiratory: { top: 31, left: 39 },
  cardiovascular: { top: 34, left: 56 },
  digestive: { top: 51, left: 48 },
  metabolic: { top: 61, left: 55 },
  reproductive: { top: 73, left: 48 },
  musculoskeletal: { top: 48, left: 22 },
  sleep_recovery: { top: 18, left: 75 },
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
  const systemById = useMemo(() => Object.fromEntries(systems.map((system) => [system.id, system])), [systems]);
  void systemById;

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={ru ? "Назад" : "Back"}>
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>{ru ? "Организм" : "Body"}</Text>
      <Text style={styles.sub}>{ru ? "Только данные с источником. Если информации мало, Аида показывает недостаток данных вместо красивой выдуманной цифры." : "Only sourced data. When evidence is insufficient, Aida shows that instead of inventing a score."}</Text>

      {loading ? <InlineState text={ru ? "Обновляем данные организма…" : "Refreshing body data…"} loading /> : null}

      <View style={styles.mapCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{ru ? "Интерактивная карта" : "Interactive map"}</Text>
          <Text style={styles.mapHint}>{ru ? "Нажмите на точку системы, чтобы открыть реальные данные и их источники." : "Tap a system marker to open the real records and their sources."}</Text>
        </View>
        <View style={styles.silhouette}>
          <View style={styles.head} /><View style={styles.neck} /><View style={styles.torso} /><View style={styles.armL} /><View style={styles.armR} /><View style={styles.legL} /><View style={styles.legR} />
          {systems.map((system) => {
            const point = MAP_POINTS[system.id];
            if (!point) return null;
            const hasData = system.state === "data";
            return <Pressable key={system.id} onPress={() => openSystem(system.id)} testID={`body-map-${system.id}`} style={[styles.marker, { top: `${point.top}%`, left: `${point.left}%` }, hasData && styles.markerData]}><View style={[styles.markerCore, hasData && styles.markerCoreData]} /></Pressable>;
          })}
        </View>
        <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, styles.markerCoreData]} /><Text style={styles.legendText}>{ru ? "есть подтверждённые записи" : "records available"}</Text></View><View style={styles.legendItem}><View style={styles.legendDot} /><Text style={styles.legendText}>{ru ? "недостаточно данных" : "insufficient data"}</Text></View></View>
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

      <Text style={styles.sectionTitle}>{ru ? "Системы организма" : "Body systems"}</Text>
      {systems.length > 0 ? (
        <View style={styles.grid}>{systems.map((system) => <Pressable key={system.id} style={styles.system} onPress={() => openSystem(system.id)}><View style={[styles.dot, system.state === "data" && styles.dotData]} /><View style={{ flex: 1 }}><Text style={styles.systemName}>{ru ? system.label_ru : system.label_en}</Text><Text style={styles.systemMeta}>{system.state === "data" ? (ru ? `Есть данные · ${system.evidence_count}` : `Data available · ${system.evidence_count}`) : (ru ? "Недостаточно данных" : "Insufficient data")}</Text></View><Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /></Pressable>)}</View>
      ) : !loading && !systemsError ? (
        <InlineState text={ru ? "Для систем организма пока недостаточно данных." : "There is not enough body-system data yet."} />
      ) : null}
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
  mapCard: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  mapHint: { fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, marginTop: 4 },
  silhouette: { height: 330, width: 210, alignSelf: "center", marginTop: spacing.lg, position: "relative" },
  head: { position: "absolute", top: 8, left: 79, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceTertiary },
  neck: { position: "absolute", top: 55, left: 96, width: 18, height: 22, borderRadius: 9, backgroundColor: colors.surfaceTertiary },
  torso: { position: "absolute", top: 72, left: 58, width: 94, height: 145, borderRadius: 44, backgroundColor: colors.surfaceTertiary },
  armL: { position: "absolute", top: 86, left: 30, width: 28, height: 148, borderRadius: 14, backgroundColor: colors.surfaceTertiary, transform: [{ rotate: "7deg" }] },
  armR: { position: "absolute", top: 86, right: 30, width: 28, height: 148, borderRadius: 14, backgroundColor: colors.surfaceTertiary, transform: [{ rotate: "-7deg" }] },
  legL: { position: "absolute", top: 200, left: 70, width: 31, height: 125, borderRadius: 16, backgroundColor: colors.surfaceTertiary },
  legR: { position: "absolute", top: 200, right: 70, width: 31, height: 125, borderRadius: 16, backgroundColor: colors.surfaceTertiary },
  marker: { position: "absolute", width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", zIndex: 10 },
  markerData: { borderColor: colors.success },
  markerCore: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.onSurfaceSecondary },
  markerCoreData: { backgroundColor: colors.success },
  legend: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onSurfaceSecondary },
  legendText: { fontSize: 11, color: colors.onSurfaceSecondary },
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
  sectionTitle: { fontSize: fontSize.xl, fontWeight: "800", fontFamily: fonts.display, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  grid: { gap: spacing.md },
  system: { minHeight: 68, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary },
  dotData: { backgroundColor: colors.success },
  systemName: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface },
  systemMeta: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 3 },
  state: { minHeight: 56, flexDirection: "row", gap: 8, alignItems: "center", marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  stateText: { flex: 1, color: colors.onSurfaceSecondary, lineHeight: 20 },
  retry: { minHeight: 38, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.onSurface, justifyContent: "center" },
  retryText: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: 12 },
});
