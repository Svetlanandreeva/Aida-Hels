import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type BiologicalAgePayload = {
  state?: "data" | "insufficient_data" | string;
  age?: number | null;
  chronological_age?: number | null;
  factors?: Array<{ metric?: string; value?: string | number; contribution?: string | number }>;
  reason?: string | null;
};

const REQUIRED_DATA = [
  ["Дата рождения", "Date of birth"],
  ["Рост и вес", "Height and weight"],
  ["Давление и пульс в динамике", "Blood pressure and pulse over time"],
  ["Сон и восстановление", "Sleep and recovery"],
  ["Подтверждённые анализы и биомаркеры", "Verified labs and biomarkers"],
] as const;

export default function BiologicalAgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [payload, setPayload] = useState<BiologicalAgePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setPayload(null);
      setLoading(false);
      return;
    }
    setError(false);
    setLoading(true);
    try {
      setPayload(await api.biologicalAge(activeId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasEstimate = payload?.state === "data" && typeof payload?.age === "number";
  const reason = payload?.reason === "validated_model_not_enabled"
    ? (ru ? "Расчётная модель пока не включена: Аида не будет показывать красивое число без валидированной методики." : "The calculation model is not enabled yet: Aida will not show a polished number without a validated method.")
    : (ru ? "Для устойчивой оценки пока недостаточно подтверждённых данных." : "There is not enough verified data for a stable estimate yet.");

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
      <Pressable style={s.back} onPress={() => router.back()} accessibilityRole="button" testID="biological-age-back">
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>

      <Text style={s.title}>{ru ? "Биологический возраст" : "Biological age"}</Text>
      <Text style={s.sub}>{ru ? "Объяснимая wellness-оценка, а не диагноз. Здесь всегда видно, на каких данных построен вывод и чего не хватает." : "An explainable wellness estimate, not a diagnosis. You can always see what evidence supports it and what is missing."}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.onSurface} />
      ) : !activeId ? (
        <State icon="person-circle-outline" title={ru ? "Выберите профиль" : "Choose a profile"} text={ru ? "Оценка рассчитывается отдельно для каждого профиля." : "The estimate is calculated separately for each profile."} />
      ) : error ? (
        <State icon="cloud-offline-outline" title={ru ? "Не удалось загрузить данные" : "Could not load data"} text={ru ? "Проверьте соединение и повторите." : "Check your connection and retry."} action={ru ? "Повторить" : "Retry"} onAction={load} />
      ) : (
        <>
          <View style={s.heroCard} testID="biological-age-summary">
            <Text style={s.eyebrow}>{ru ? "Текущий статус" : "Current status"}</Text>
            {hasEstimate ? (
              <>
                <Text style={s.age}>{payload?.age}</Text>
                <Text style={s.ageLabel}>{ru ? "расчётный возраст организма" : "estimated body age"}</Text>
              </>
            ) : (
              <>
                <Text style={s.insufficient}>{ru ? "Недостаточно данных" : "Insufficient data"}</Text>
                <Text style={s.reason}>{reason}</Text>
              </>
            )}
            {typeof payload?.chronological_age === "number" ? (
              <View style={s.chronologicalRow}>
                <Text style={s.chronologicalLabel}>{ru ? "Хронологический возраст" : "Chronological age"}</Text>
                <Text style={s.chronologicalValue}>{payload.chronological_age}</Text>
              </View>
            ) : null}
          </View>

          <View style={s.card}>
            <View style={s.sectionHead}><Ionicons name="analytics-outline" size={20} color={colors.onSurface} /><Text style={s.cardTitle}>{ru ? "Что повлияло на оценку" : "What influenced the estimate"}</Text></View>
            {(payload?.factors || []).length ? (
              (payload?.factors || []).map((factor, index) => (
                <View key={`${factor.metric || "factor"}-${index}`} style={s.factorRow}>
                  <View style={{ flex: 1 }}><Text style={s.factorName}>{factor.metric || (ru ? "Показатель" : "Metric")}</Text><Text style={s.factorMeta}>{String(factor.value ?? "—")}</Text></View>
                  {factor.contribution != null ? <Text style={s.factorContribution}>{String(factor.contribution)}</Text> : null}
                </View>
              ))
            ) : (
              <Text style={s.body}>{ru ? "Пока модель не сформировала оценку, факторов нет. Аида не подставляет фиктивные причины." : "Until an estimate is produced, there are no factors. Aida does not fabricate explanations."}</Text>
            )}
          </View>

          <View style={s.card}>
            <View style={s.sectionHead}><Ionicons name="add-circle-outline" size={20} color={colors.onSurface} /><Text style={s.cardTitle}>{ru ? "Что нужно добавить" : "What to add"}</Text></View>
            <Text style={s.body}>{ru ? "Для будущей валидированной модели нужны устойчивые данные из нескольких источников, а не один случайный показатель." : "A future validated model needs stable evidence from several sources, not one isolated metric."}</Text>
            <View style={s.list}>
              {REQUIRED_DATA.map(([ruLabel, enLabel]) => (
                <View key={ruLabel} style={s.listRow}><Ionicons name="ellipse-outline" size={15} color={colors.onSurfaceSecondary} /><Text style={s.listText}>{ru ? ruLabel : enLabel}</Text></View>
              ))}
            </View>
            <Pressable style={s.secondaryButton} onPress={() => router.push("/(tabs)/health" as any)} testID="biological-age-add-data">
              <Text style={s.secondaryButtonText}>{ru ? "Добавить данные" : "Add data"}</Text><Ionicons name="arrow-forward" size={17} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={s.noteCard}><Ionicons name="shield-checkmark-outline" size={20} color={colors.onSurfaceSecondary} /><Text style={s.note}>{ru ? "Биологический возраст в Аиде не должен использоваться для постановки диагноза, назначения лечения или оценки риска без отдельной клинической валидации." : "Aida biological age must not be used for diagnosis, treatment decisions, or clinical risk assessment without separate validation."}</Text></View>
        </>
      )}
    </ScrollView>
  );
}

function State({ icon, title, text, action, onAction }: { icon: any; title: string; text: string; action?: string; onAction?: () => void }) {
  return <View style={s.state}><Ionicons name={icon} size={48} color={colors.onSurfaceSecondary} /><Text style={s.stateTitle}>{title}</Text><Text style={s.stateText}>{text}</Text>{action && onAction ? <Pressable style={s.secondaryButton} onPress={onAction}><Text style={s.secondaryButtonText}>{action}</Text></Pressable> : null}</View>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: spacing.xl },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "800", fontFamily: fonts.display, color: colors.onSurface, marginTop: spacing.lg },
  sub: { marginTop: spacing.sm, fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  heroCard: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  eyebrow: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  age: { marginTop: 4, fontSize: 64, lineHeight: 70, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  ageLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  insufficient: { marginTop: spacing.sm, fontSize: fontSize["2xl"], lineHeight: 30, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  reason: { marginTop: spacing.sm, fontSize: fontSize.sm, lineHeight: 20, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  chronologicalRow: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  chronologicalLabel: { flex: 1, fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  chronologicalValue: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  card: { marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  body: { fontSize: fontSize.sm, lineHeight: 20, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  factorRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  factorName: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  factorMeta: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  factorContribution: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  list: { marginTop: spacing.md, gap: spacing.sm },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  listText: { flex: 1, fontSize: fontSize.sm, color: colors.onSurface, fontFamily: fonts.text },
  secondaryButton: { marginTop: spacing.lg, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  secondaryButtonText: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  noteCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  note: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  state: { alignItems: "center", paddingTop: spacing["3xl"], paddingHorizontal: spacing.lg },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, textAlign: "center" },
  stateText: { marginTop: spacing.sm, fontSize: fontSize.sm, lineHeight: 20, color: colors.onSurfaceSecondary, textAlign: "center", fontFamily: fonts.text },
});