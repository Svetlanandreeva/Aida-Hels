import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientCard, Muted } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { api, LabTest, Profile, Symptom, Vital } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, gradients, radius, spacing } from "@/src/theme";

type Readiness = { overall: number; scores: Record<string, number> } | null;
type Checkin = { sleep?: number | null; [key: string]: any };
type BiologicalAgeResult = {
  state?: string;
  age?: number | null;
  chronological_age?: number | null;
  reason?: string | null;
};

type Props = {
  activeId?: string | null;
  profile?: Profile | null;
  readiness: Readiness;
  hasReadinessData: boolean;
  labs: LabTest[];
  symptoms: Symptom[];
  onOpenLab: () => void;
  onOpenCheckin: () => void;
  onNavigate: (route: string) => void;
};

const pressureEvidence = (vitals: Vital[]) => vitals.some((v) => {
  const key = `${v.kind || ""} ${v.metric || ""} ${v.type || ""}`.toLowerCase();
  return v.systolic != null || v.diastolic != null || v.pulse != null || key.includes("pressure") || key.includes("blood_pressure") || key.includes("давлен") || key.includes("pulse") || key.includes("пульс");
});

const sleepEvidence = (vitals: Vital[], checkins: Checkin[]) =>
  checkins.some((c) => c.sleep != null) || vitals.some((v) => `${v.kind || ""} ${v.metric || ""} ${v.type || ""}`.toLowerCase().includes("sleep"));

export function ReadinessProgressCard({
  activeId,
  profile,
  readiness,
  hasReadinessData,
  labs,
  symptoms,
  onOpenLab,
  onOpenCheckin,
  onNavigate,
}: Props) {
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [open, setOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [biologicalAge, setBiologicalAge] = useState<BiologicalAgeResult | null>(null);

  const overall = readiness?.overall ?? 0;
  const ageAvailable = overall >= 100 && biologicalAge?.state === "data" && Number.isFinite(Number(biologicalAge?.age));

  const items = useMemo(() => {
    const profileComplete = !!profile?.dob && !!profile?.sex && profile?.height_cm != null && profile?.weight_kg != null;
    const pressureComplete = pressureEvidence(vitals);
    const sleepComplete = sleepEvidence(vitals, checkins);
    const labsComplete = labs.length > 0;
    const wellbeingComplete = checkins.length > 0 || symptoms.length > 0;

    return [
      {
        id: "profile",
        complete: profileComplete,
        title: ru ? "Основные данные профиля" : "Profile basics",
        why: ru ? "Дата рождения, пол, рост и вес нужны для возрастных норм и корректной интерпретации показателей." : "Date of birth, sex, height and weight are needed for age-aware reference ranges and interpretation.",
        action: ru ? "Заполнить профиль" : "Complete profile",
        run: () => onNavigate("/(tabs)/profile"),
      },
      {
        id: "pressure",
        complete: pressureComplete,
        title: ru ? "Давление и пульс" : "Blood pressure and pulse",
        why: ru ? "Помогают оценивать сердечно-сосудистую динамику и не путать разовый показатель с устойчивым трендом." : "They help track cardiovascular trends instead of treating one measurement as a pattern.",
        action: ru ? "Добавить измерение" : "Add measurement",
        run: () => onNavigate("/pressure"),
      },
      {
        id: "sleep",
        complete: sleepComplete,
        title: ru ? "Сон и восстановление" : "Sleep and recovery",
        why: ru ? "Сон влияет на пульс, давление, самочувствие и восстановление — без него часть выводов остаётся неполной." : "Sleep affects pulse, blood pressure, wellbeing and recovery, so missing sleep data leaves gaps.",
        action: ru ? "Добавить данные сна" : "Add sleep data",
        run: () => onOpenCheckin(),
      },
      {
        id: "labs",
        complete: labsComplete,
        title: ru ? "Анализы и биомаркеры" : "Labs and biomarkers",
        why: ru ? "Это объективная основа для оценки обмена веществ, крови и других систем организма." : "They provide objective evidence for metabolic, blood and other body-system observations.",
        action: ru ? "Загрузить анализ" : "Upload lab",
        run: () => onOpenLab(),
      },
      {
        id: "wellbeing",
        complete: wellbeingComplete,
        title: ru ? "Самочувствие и симптомы" : "Wellbeing and symptoms",
        why: ru ? "Помогают связать цифры с тем, как вы реально себя чувствуете, и замечать изменения во времени." : "They connect measurements to how you actually feel and help detect changes over time.",
        action: ru ? "Пройти быстрый опрос" : "Quick check-in",
        run: () => onOpenCheckin(),
      },
    ];
  }, [checkins, labs.length, onNavigate, onOpenCheckin, onOpenLab, profile, ru, symptoms.length, vitals]);

  const openDetails = async () => {
    setOpen(true);
    if (!activeId || detailsLoading) return;
    setDetailsLoading(true);
    try {
      const [vitalsResult, checkinsResult, ageResult] = await Promise.allSettled([
        api.listVitals(activeId),
        api.listCheckins(activeId),
        overall >= 100 ? api.biologicalAge(activeId) : Promise.resolve(null),
      ]);
      setVitals(vitalsResult.status === "fulfilled" ? vitalsResult.value : []);
      setCheckins(checkinsResult.status === "fulfilled" ? checkinsResult.value : []);
      setBiologicalAge(ageResult.status === "fulfilled" ? ageResult.value : null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const runAction = (run: () => void) => {
    setOpen(false);
    setTimeout(run, 0);
  };

  return (
    <>
      <GradientCard gradient={gradients.warm} style={styles.hero} testID="hero-readiness" onPress={openDetails}>
        <View style={styles.heroHead}>
          <Text style={styles.heroLabel}>{ageAvailable ? (ru ? "Возраст организма" : "Body age") : (ru ? "Готовность аналитики" : "Analytics readiness")}</Text>
          <View style={styles.tapHint}><Text style={styles.tapHintText}>{ru ? "Подробнее" : "Details"}</Text><Ionicons name="chevron-forward" size={15} color="rgba(27,27,29,0.55)" /></View>
        </View>
        {ageAvailable ? (
          <>
            <Text style={styles.heroNum}>{Math.round(Number(biologicalAge!.age))}</Text>
            <Text style={styles.heroSub}>{ru ? "лет · рассчитано только по подтверждённым данным" : "years · calculated only from supported data"}</Text>
          </>
        ) : hasReadinessData ? (
          <>
            <Text style={styles.heroNum}>{overall}%</Text>
            <Text style={styles.heroSub}>{overall >= 100
              ? (ru ? "Данных достаточно для аналитики. Возраст организма появится только при доступном валидированном расчёте." : "There is enough data for analytics. Body age appears only when a validated calculation is available.")
              : (ru ? "Чем больше данных, тем точнее наблюдения Аиды" : "More data makes Aida's observations more precise")}
            </Text>
            <View style={styles.heroBar}><View style={{ width: `${Math.max(0, Math.min(100, overall))}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 3 }} /></View>
          </>
        ) : (
          <>
            <Text style={styles.heroNum}>—</Text>
            <Text style={styles.heroSub}>{ru ? "Пока недостаточно данных" : "Not enough data yet"}</Text>
          </>
        )}
      </GradientCard>

      <Sheet visible={open} onClose={() => setOpen(false)} testID="readiness-details-sheet" scroll>
        <Text style={styles.sheetTitle}>{ru ? "Что нужно для полной картины" : "What completes the picture"}</Text>
        <Muted style={styles.sheetLead}>{ru
          ? "Процент растёт только от реально сохранённых данных. Ни один пункт не считается заполненным просто потому, что вы открыли экран."
          : "The percentage grows only from data that is actually saved. Opening a screen never counts as completion."}
        </Muted>

        {overall >= 100 ? (
          <View style={styles.ageState}>
            <Ionicons name={ageAvailable ? "checkmark-circle" : "information-circle-outline"} size={22} color={ageAvailable ? colors.success : colors.onSurfaceSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{ageAvailable
                ? (ru ? `Возраст организма: ${Math.round(Number(biologicalAge!.age))} лет` : `Body age: ${Math.round(Number(biologicalAge!.age))} years`)
                : (ru ? "Данных для аналитики достаточно" : "Enough data for analytics")}
              </Text>
              <Muted>{ageAvailable
                ? (biologicalAge?.chronological_age != null ? (ru ? `Хронологический возраст: ${biologicalAge.chronological_age}` : `Chronological age: ${biologicalAge.chronological_age}`) : "")
                : (ru ? "Возраст организма не подставляется приблизительно. Он появится только после валидированного расчёта на достаточном наборе данных." : "Body age is never guessed. It appears only after a validated calculation has enough evidence.")}
              </Muted>
            </View>
          </View>
        ) : null}

        {detailsLoading ? <View style={styles.loadingRow}><ActivityIndicator color={colors.onSurface} /><Muted>{ru ? "Проверяем сохранённые данные…" : "Checking saved data…"}</Muted></View> : null}

        <View style={styles.itemList}>
          {items.map((item) => (
            <View key={item.id} style={styles.item} testID={`readiness-item-${item.id}`}>
              <View style={styles.itemTop}>
                <Ionicons name={item.complete ? "checkmark-circle" : "ellipse-outline"} size={21} color={item.complete ? colors.success : colors.onSurfaceSecondary} />
                <Text style={styles.itemTitle}>{item.title}</Text>
              </View>
              <Muted style={styles.itemWhy}>{item.why}</Muted>
              {!item.complete ? (
                <Pressable style={styles.itemAction} onPress={() => runAction(item.run)} testID={`readiness-action-${item.id}`}>
                  <Text style={styles.itemActionText}>{item.action}</Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.onSurfaceInverse} />
                </Pressable>
              ) : <Text style={styles.doneText}>{ru ? "Есть данные" : "Data available"}</Text>}
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: spacing.md, paddingVertical: spacing.xl },
  heroHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  heroLabel: { fontSize: fontSize.base, fontWeight: "600", color: "rgba(27,27,29,0.6)", fontFamily: fonts.text },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 2 },
  tapHintText: { fontSize: fontSize.sm, fontWeight: "600", color: "rgba(27,27,29,0.55)", fontFamily: fonts.text },
  heroNum: { fontSize: 64, fontWeight: "800", color: colors.onSurface, letterSpacing: -2, marginTop: 4, fontFamily: fonts.display },
  heroSub: { fontSize: fontSize.base, color: "rgba(27,27,29,0.6)", marginTop: 2, fontFamily: fonts.text },
  heroBar: { height: 6, backgroundColor: "rgba(27,27,29,0.15)", borderRadius: 3, marginTop: spacing.lg, overflow: "hidden" },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.display },
  sheetLead: { marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 20 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  ageState: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.md },
  itemList: { gap: spacing.md },
  item: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  itemTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemTitle: { flex: 1, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  itemWhy: { marginTop: spacing.sm, lineHeight: 20 },
  itemAction: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginTop: spacing.md, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.onSurface },
  itemActionText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  doneText: { marginTop: spacing.md, fontSize: fontSize.sm, fontWeight: "700", color: colors.success, fontFamily: fonts.text },
});
