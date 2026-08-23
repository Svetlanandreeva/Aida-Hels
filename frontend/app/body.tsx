import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

const positiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const calculateBmi = (heightCm: number | null, weightKg: number | null) => {
  if (!heightCm || !weightKg) return null;
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
};

const ageYears = (dob?: string | null) => {
  const match = String(dob || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const born = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < born.getUTCMonth()
    || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

const bmiExplanation = (bmi: number, ru: boolean, specialContext: boolean) => {
  if (specialContext) {
    return ru
      ? "ИМТ рассчитан из роста и веса. Для детей, подростков и беременности взрослые диапазоны не применяются автоматически."
      : "BMI is calculated from height and weight. Adult ranges are not applied automatically for children, adolescents, or pregnancy.";
  }
  if (bmi < 18.5) return ru ? "Ниже стандартного взрослого диапазона. Это ориентир, а не диагноз." : "Below the standard adult range. This is a reference, not a diagnosis.";
  if (bmi < 25) return ru ? "В стандартном взрослом диапазоне. Это ориентир, а не диагноз." : "Within the standard adult range. This is a reference, not a diagnosis.";
  if (bmi < 30) return ru ? "Выше стандартного взрослого диапазона. Это ориентир, а не диагноз." : "Above the standard adult range. This is a reference, not a diagnosis.";
  return ru ? "Значительно выше стандартного взрослого диапазона. Это ориентир, а не диагноз." : "Well above the standard adult range. This is a reference, not a diagnosis.";
};

export default function BodyScreen() {
  const { activeId, activeProfile, reload, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [age, setAge] = useState<any>(null);
  const [systems, setSystems] = useState<BodySystemInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemsError, setSystemsError] = useState(false);
  const [ageError, setAgeError] = useState(false);
  const [savedHeight, setSavedHeight] = useState<number | null>(null);
  const [savedWeight, setSavedWeight] = useState<number | null>(null);
  const [heightInput, setHeightInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [editingBody, setEditingBody] = useState(false);
  const [bodySaving, setBodySaving] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);

  useEffect(() => {
    setSavedHeight(null);
    setSavedWeight(null);
    setHeightInput("");
    setWeightInput("");
    setEditingBody(false);
    setBodyError(null);
  }, [activeId]);

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

  const profileHeight = positiveNumber(activeProfile?.height_cm);
  const profileWeight = positiveNumber(activeProfile?.weight_kg);
  const heightCm = savedHeight ?? profileHeight;
  const weightKg = savedWeight ?? profileWeight;
  const missingHeight = !heightCm;
  const missingWeight = !weightKg;
  const showBodyForm = editingBody || missingHeight || missingWeight;
  const bmiValue = calculateBmi(heightCm, weightKg);
  const ageValue = ageYears(activeProfile?.dob);
  const specialBmiContext = (ageValue !== null && ageValue < 18) || activeProfile?.women_health?.pregnant === true;

  const openBodyEditor = () => {
    setHeightInput(heightCm ? String(heightCm) : "");
    setWeightInput(weightKg ? String(weightKg) : "");
    setBodyError(null);
    setEditingBody(true);
  };

  const saveBodyMetrics = async () => {
    if (!activeId) return;
    const enteredHeight = heightInput.trim() ? Number(heightInput.replace(",", ".")) : heightCm;
    const enteredWeight = weightInput.trim() ? Number(weightInput.replace(",", ".")) : weightKg;
    if (!enteredHeight || !Number.isFinite(enteredHeight) || enteredHeight < 40 || enteredHeight > 250) {
      setBodyError(ru ? "Укажите рост от 40 до 250 см." : "Enter a height between 40 and 250 cm.");
      return;
    }
    if (!enteredWeight || !Number.isFinite(enteredWeight) || enteredWeight < 2 || enteredWeight > 400) {
      setBodyError(ru ? "Укажите вес от 2 до 400 кг." : "Enter a weight between 2 and 400 kg.");
      return;
    }

    setBodySaving(true);
    setBodyError(null);
    try {
      const updated = await api.updateProfile(activeId, { height_cm: enteredHeight, weight_kg: enteredWeight });
      setSavedHeight(positiveNumber(updated.height_cm) ?? enteredHeight);
      setSavedWeight(positiveNumber(updated.weight_kg) ?? enteredWeight);
      setHeightInput("");
      setWeightInput("");
      setEditingBody(false);
      bumpRefresh();
      void reload();
      void load();
    } catch {
      setBodyError(ru ? "Не удалось сохранить рост и вес. Попробуйте ещё раз." : "Could not save height and weight. Try again.");
    } finally {
      setBodySaving(false);
    }
  };

  const openSystem = (id: string) => router.push({ pathname: "/body-system" as any, params: { systemId: id } });

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={ru ? "Назад" : "Back"}>
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>{ru ? "Организм" : "Body"}</Text>
      <Text style={styles.sub}>{ru ? "Только данные с источником. Если информации мало, Аида показывает недостаток данных вместо красивой выдуманной цифры." : "Only sourced data. When evidence is insufficient, Aida shows that instead of inventing a score."}</Text>

      <View style={styles.metricsCard} testID="body-anthropometrics-card">
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleCopy}>
            <Text style={styles.label}>{ru ? "Рост, вес и ИМТ" : "Height, weight and BMI"}</Text>
            <Text style={styles.systemsHint}>{ru ? "Берём данные из вашего профиля и онбординга, а не просим вводить их повторно." : "Uses your profile and onboarding data instead of asking for them again."}</Text>
          </View>
          {!showBodyForm ? (
            <Pressable onPress={openBodyEditor} style={styles.editButton} accessibilityRole="button">
              <Ionicons name="pencil-outline" size={16} color={colors.onSurface} />
              <Text style={styles.editButtonText}>{ru ? "Изменить" : "Edit"}</Text>
            </Pressable>
          ) : null}
        </View>

        {showBodyForm ? (
          <View style={styles.bodyForm}>
            <Text style={styles.promptText}>
              {missingHeight && missingWeight
                ? (ru ? "Чтобы рассчитать ИМТ, добавьте рост и вес." : "Add height and weight to calculate BMI.")
                : missingHeight
                  ? (ru ? `Вес ${weightKg} кг уже сохранён. Добавьте только рост.` : `Weight ${weightKg} kg is already saved. Add height only.`)
                  : missingWeight
                    ? (ru ? `Рост ${heightCm} см уже сохранён. Добавьте только вес.` : `Height ${heightCm} cm is already saved. Add weight only.`)
                    : (ru ? "Обновите рост или вес. ИМТ пересчитается автоматически." : "Update height or weight. BMI will recalculate automatically.")}
            </Text>

            <View style={styles.fieldRow}>
              {(editingBody || missingHeight) ? (
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{ru ? "Рост, см" : "Height, cm"}</Text>
                  <TextInput
                    testID="body-height-input"
                    value={heightInput}
                    onChangeText={setHeightInput}
                    keyboardType="decimal-pad"
                    placeholder={heightCm ? String(heightCm) : (ru ? "Напр. 168" : "e.g. 168")}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                    accessibilityLabel={ru ? "Рост в сантиметрах" : "Height in centimeters"}
                  />
                </View>
              ) : null}
              {(editingBody || missingWeight) ? (
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{ru ? "Вес, кг" : "Weight, kg"}</Text>
                  <TextInput
                    testID="body-weight-input"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder={weightKg ? String(weightKg) : (ru ? "Напр. 64" : "e.g. 64")}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                    accessibilityLabel={ru ? "Вес в килограммах" : "Weight in kilograms"}
                  />
                </View>
              ) : null}
            </View>

            {bodyError ? <Text style={styles.errorText}>{bodyError}</Text> : null}
            <View style={styles.formActions}>
              {editingBody && heightCm && weightKg ? (
                <Pressable onPress={() => { setEditingBody(false); setBodyError(null); setHeightInput(""); setWeightInput(""); }} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{ru ? "Отмена" : "Cancel"}</Text>
                </Pressable>
              ) : null}
              <Pressable testID="body-metrics-save" onPress={saveBodyMetrics} disabled={bodySaving} style={[styles.saveButton, bodySaving && styles.disabled]}>
                {bodySaving ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> : <Text style={styles.saveButtonText}>{ru ? "Сохранить и рассчитать" : "Save and calculate"}</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <Metric label={ru ? "Рост" : "Height"} value={`${heightCm} см`} />
              <Metric label={ru ? "Вес" : "Weight"} value={`${weightKg} кг`} />
              <Metric label={ru ? "ИМТ" : "BMI"} value={bmiValue !== null ? String(bmiValue) : "—"} emphasize />
            </View>
            {bmiValue !== null ? <Text style={styles.bmiNote}>{bmiExplanation(bmiValue, ru, specialBmiContext)}</Text> : null}
          </>
        )}
      </View>

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

function Metric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return <View style={[styles.metricBox, emphasize && styles.metricBoxEmphasis]}><Text style={styles.metricBoxLabel}>{label}</Text><Text style={styles.metricBoxValue}>{value}</Text></View>;
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
  metricsCard: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  cardTitleCopy: { flex: 1 },
  editButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 6 },
  editButtonText: { color: colors.onSurface, fontSize: 12, fontWeight: "800", fontFamily: fonts.text },
  bodyForm: { marginTop: spacing.lg },
  promptText: { color: colors.onSurface, fontSize: fontSize.base, lineHeight: 21, fontFamily: fonts.text, fontWeight: "600" },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  fieldWrap: { flex: 1, minWidth: 210 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface, marginBottom: 7, fontFamily: fonts.text },
  input: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, paddingHorizontal: spacing.md, fontSize: fontSize.base, fontFamily: fonts.text },
  errorText: { marginTop: spacing.sm, color: colors.error, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.text },
  formActions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  saveButton: { minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.onSurface, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: fontSize.sm, fontFamily: fonts.text },
  secondaryButton: { minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.onSurface, fontWeight: "800", fontSize: fontSize.sm, fontFamily: fonts.text },
  disabled: { opacity: 0.55 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  metricBox: { flex: 1, minWidth: 150, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  metricBoxEmphasis: { borderWidth: 1, borderColor: colors.border },
  metricBoxLabel: { fontSize: 11, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontWeight: "700" },
  metricBoxValue: { marginTop: 4, fontSize: 26, lineHeight: 30, color: colors.onSurface, fontFamily: fonts.display, fontWeight: "800" },
  bmiNote: { marginTop: spacing.md, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.text },
  systemsCard: { marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  systemsHint: { fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, marginTop: 4, fontFamily: fonts.text },
  tileGrid: { marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { flexBasis: "48%", flexGrow: 1, minWidth: 220, minHeight: 112, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md },
  tileIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tileIconData: { backgroundColor: "#E8F5EC" },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface },
  tileMeta: { fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, marginTop: 4 },
  ageCard: { marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
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