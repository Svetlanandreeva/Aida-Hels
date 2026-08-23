import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, PrimaryButton } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Checkin, Medication } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const METRICS = [
  { key: "mood", label: "mood", icon: "happy-outline" as const },
  { key: "energy", label: "energy", icon: "flash-outline" as const },
  { key: "stress", label: "stress", icon: "thunderstorm-outline" as const },
  { key: "anxiety", label: "anxiety", icon: "pulse-outline" as const },
  { key: "sleep", label: "sleep_q", icon: "moon-outline" as const },
];

const ICD_DISPLAY = /^([A-Z]\d{2}(?:\.\d+)?)\s*[—-]\s*(.+)$/i;

const MENTAL_GROUPS: Record<string, { ru: string; en: string }> = {
  F0: { ru: "Органические, включая симптоматические, психические расстройства.", en: "Organic, including symptomatic, mental disorders." },
  F1: { ru: "Психические и поведенческие расстройства, связанные с употреблением психоактивных веществ.", en: "Mental and behavioural disorders due to psychoactive substance use." },
  F2: { ru: "Шизофрения, шизотипические и бредовые расстройства.", en: "Schizophrenia, schizotypal and delusional disorders." },
  F3: { ru: "Расстройства настроения (аффективные расстройства).", en: "Mood (affective) disorders." },
  F4: { ru: "Невротические, связанные со стрессом и соматоформные расстройства.", en: "Neurotic, stress-related and somatoform disorders." },
  F5: { ru: "Поведенческие синдромы, связанные с физиологическими нарушениями и физическими факторами.", en: "Behavioural syndromes associated with physiological disturbances and physical factors." },
  F6: { ru: "Расстройства личности и поведения в зрелом возрасте.", en: "Disorders of adult personality and behaviour." },
  F7: { ru: "Расстройства интеллектуального развития в классификации МКБ-10.", en: "Disorders of intellectual development in ICD-10 classification." },
  F8: { ru: "Расстройства психологического развития.", en: "Disorders of psychological development." },
  F9: { ru: "Поведенческие и эмоциональные расстройства, обычно начинающиеся в детском и подростковом возрасте.", en: "Behavioural and emotional disorders with onset usually occurring in childhood and adolescence." },
};

const MENTAL_MEDICATION_MARKERS = [
  "hydroxyzine", "гидроксизин", "atarax", "атаракс",
  "escitalopram", "эсциталопрам", "cipralекс", "ципралекс",
  "sertraline", "сертралин", "zoloft", "золофт",
  "fluoxetine", "флуоксетин", "prozac", "прозак",
  "paroxetine", "пароксетин", "paxil", "паксил",
  "venlafaxine", "венлафаксин", "duloxetine", "дулоксетин",
  "mirtazapine", "миртазапин", "trazodone", "тразодон",
  "vortioxetine", "вортиоксетин", "agomelatine", "агомелатин",
  "amitriptyline", "амитриптилин", "clomipramine", "кломипрамин",
  "quetiapine", "кветиапин", "seroquel", "сероквель",
  "olanzapine", "оланзапин", "risperidone", "рисперидон",
  "aripiprazole", "арипипразол", "lamotrigine", "ламотриджин",
  "lithium", "литий", "valproate", "вальпроат",
  "pregabalin", "прегабалин", "buspirone", "буспирон",
  "alprazolam", "алпразолам", "clonazepam", "клоназепам",
  "diazepam", "диазепам", "lorazepam", "лоразепам", "феназепам",
  "atomoxetine", "атомоксетин", "methylphenidate", "метилфенидат",
];

type MindMedication = Medication & {
  active_ingredient?: string | null;
  verification_status?: string | null;
  normalization_status?: string | null;
};

const scaleColor = (v: number, invert = false) => {
  const good = invert ? v <= 2 : v >= 4;
  const bad = invert ? v >= 4 : v <= 2;
  if (good) return colors.success;
  if (bad) return colors.error;
  return colors.warning;
};

function diagnosisParts(value: string) {
  const match = value.match(ICD_DISPLAY);
  return match ? { code: match[1].toUpperCase(), name: match[2].trim() } : { code: "", name: value };
}

function diagnosisDescription(value: string, lang: string) {
  const { code } = diagnosisParts(value);
  const group = code.slice(0, 2);
  const description = MENTAL_GROUPS[group];
  if (description) return lang === "ru" ? description.ru : description.en;
  return lang === "ru"
    ? "Диагноз указан в медицинской анкете и используется Аидой как контекст для дневника самочувствия."
    : "This diagnosis was provided in the medical onboarding and is used by Aida as context for wellbeing tracking.";
}

function isMentalMedication(medication: MindMedication) {
  const haystack = `${medication.name || ""} ${medication.active_ingredient || ""}`.toLocaleLowerCase();
  return MENTAL_MEDICATION_MARKERS.some((marker) => haystack.includes(marker));
}

export default function MindScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, activeProfile, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();
  const { toast } = useLog();

  const [items, setItems] = useState<Checkin[]>([]);
  const [medications, setMedications] = useState<MindMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinsError, setCheckinsError] = useState(false);
  const [medicationsError, setMedicationsError] = useState(false);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, number>>({ mood: 3, energy: 3, stress: 3, anxiety: 3, sleep: 3 });
  const [triggers, setTriggers] = useState("");
  const [saving, setSaving] = useState(false);

  const mentalConditions = activeProfile?.mental_conditions || [];
  const relatedMedications = useMemo(
    () => medications.filter((medication) => medication.active !== false && isMentalMedication(medication)),
    [medications],
  );

  const load = useCallback(async () => {
    if (!activeId) {
      setItems([]);
      setMedications([]);
      setCheckinsError(false);
      setMedicationsError(false);
      setLoading(false);
      return;
    }

    const [checkinsResult, medicationsResult] = await Promise.allSettled([
      api.listCheckins(activeId),
      api.listMeds(activeId),
    ]);

    if (checkinsResult.status === "fulfilled") setItems(checkinsResult.value);
    setCheckinsError(checkinsResult.status === "rejected");

    if (medicationsResult.status === "fulfilled") setMedications(medicationsResult.value as MindMedication[]);
    setMedicationsError(medicationsResult.status === "rejected");
    setLoading(false);
  }, [activeId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load, refreshTick]));

  const save = async () => {
    if (!activeId) return;
    setSaving(true);
    try {
      await api.createCheckin({ profile_id: activeId, ...vals, triggers: triggers.trim() || null });
      setVals({ mood: 3, energy: 3, stress: 3, anxiety: 3, sleep: 3 });
      setTriggers("");
      setOpen(false);
      await load();
      bumpRefresh();
      toast(t("checkin_saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_mind")} />

      {!activeId ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom }}>
          <View style={styles.empty}>
            <Ionicons name="person-circle-outline" size={56} color={colors.onSurfaceSecondary} />
            <Text style={styles.emptyTitle}>{lang === "ru" ? "Сначала выберите профиль" : "Choose a profile first"}</Text>
            <Muted style={styles.emptyText}>{lang === "ru" ? "Записи самочувствия сохраняются отдельно для каждого профиля." : "Wellbeing check-ins are stored separately for each profile."}</Muted>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {mentalConditions.length > 0 ? (
            <Card testID="mind-diagnosis-card">
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}><Ionicons name="medical-outline" size={18} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{lang === "ru" ? "Диагнозы из анкеты" : "Diagnoses from onboarding"}</Text>
                  <Muted>{lang === "ru" ? "Данные медицинской анкеты" : "Medical onboarding data"}</Muted>
                </View>
              </View>

              <View style={styles.diagnosisList}>
                {mentalConditions.map((condition) => {
                  const { code, name } = diagnosisParts(condition);
                  return (
                    <View key={condition} style={styles.diagnosisRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.diagnosisTitleRow}>
                          {code ? <Text style={styles.codeBadge}>{code}</Text> : null}
                          <Text style={styles.diagnosisName}>{name}</Text>
                        </View>
                        <Text style={styles.diagnosisDescription}>{diagnosisDescription(condition, lang)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Muted style={{ marginTop: spacing.sm }}>
                {lang === "ru"
                  ? "Справочное описание относится к группе МКБ-10 и не заменяет заключение врача."
                  : "The reference description reflects the ICD-10 group and does not replace a clinician's assessment."}
              </Muted>
            </Card>
          ) : null}

          {relatedMedications.length > 0 ? (
            <Card testID="mind-related-medications-card">
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}><Ionicons name="medkit-outline" size={18} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{lang === "ru" ? "Связанные лекарства" : "Related medications"}</Text>
                  <Muted>{lang === "ru" ? "Из текущего списка препаратов" : "From the current medication list"}</Muted>
                </View>
              </View>

              <View style={styles.medicationList}>
                {relatedMedications.map((medication) => (
                  <View key={medication.id} style={styles.medicationRow}>
                    <Ionicons name="medical" size={17} color={colors.onSurfaceSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medicationName}>{medication.name}</Text>
                      <Text style={styles.medicationMeta}>
                        {[medication.active_ingredient, medication.dose].filter(Boolean).join(" · ") || (lang === "ru" ? "Без дополнительной информации" : "No additional details")}
                      </Text>
                    </View>
                    <View style={styles.contextBadge}>
                      <Text style={styles.contextBadgeText}>{lang === "ru" ? "Психика" : "Mind"}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Muted style={{ marginTop: spacing.sm }}>
                {lang === "ru"
                  ? "Аида показывает связь с разделом по МНН или известному торговому названию. Это не означает, что препарат назначен именно для указанного диагноза."
                  : "Aida links these medicines to the Mind section by active ingredient or known brand name. This does not mean the medicine was prescribed specifically for the listed diagnosis."}
              </Muted>
            </Card>
          ) : null}

          {medicationsError ? (
            <View style={styles.inlineNotice}>
              <Ionicons name="cloud-offline-outline" size={17} color={colors.onSurfaceSecondary} />
              <Muted style={{ flex: 1 }}>{lang === "ru" ? "Не удалось обновить список лекарств." : "Could not refresh the medication list."}</Muted>
            </View>
          ) : null}

          <View style={styles.diaryHeader}>
            <Text style={styles.sectionTitle}>{lang === "ru" ? "Дневник самочувствия" : "Wellbeing diary"}</Text>
            {loading ? <ActivityIndicator size="small" color={colors.onSurface} /> : null}
          </View>

          {checkinsError ? (
            <View style={styles.compactEmpty}>
              <Ionicons name="cloud-offline-outline" size={34} color={colors.onSurfaceSecondary} />
              <Text style={styles.compactEmptyTitle}>{lang === "ru" ? "Не удалось обновить дневник" : "Could not refresh the diary"}</Text>
              <Muted style={styles.compactEmptyText}>{lang === "ru" ? "Диагнозы и лекарства выше остаются доступны." : "Diagnoses and medications above remain available."}</Muted>
              <PrimaryButton label={lang === "ru" ? "Повторить" : "Retry"} onPress={() => { setLoading(true); void load(); }} style={{ marginTop: spacing.md }} />
            </View>
          ) : items.length === 0 && !loading ? (
            <View style={styles.compactEmpty}>
              <Ionicons name="happy-outline" size={42} color={colors.onSurfaceSecondary} />
              <Text style={styles.compactEmptyTitle}>{lang === "ru" ? "Пока нет записей" : "No check-ins yet"}</Text>
              <Muted style={styles.compactEmptyText}>{t("mind_empty")}</Muted>
            </View>
          ) : (
            items.map((c) => (
              <Card key={c.id} testID={`checkin-${c.id}`}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemDate}>{(c.date || "").slice(0, 10)}</Text>
                </View>
                <View style={styles.metricsRow}>
                  {METRICS.map((m) => {
                    const v = (c as any)[m.key] as number;
                    const invert = m.key === "stress" || m.key === "anxiety";
                    return (
                      <View key={m.key} style={styles.metricCol}>
                        <Ionicons name={m.icon} size={16} color={colors.onSurfaceSecondary} />
                        <View style={[styles.metricDot, { backgroundColor: scaleColor(v, invert) }]}>
                          <Text style={styles.metricDotText}>{v}</Text>
                        </View>
                        <Text style={styles.metricLabel} numberOfLines={1}>{t(m.label)}</Text>
                      </View>
                    );
                  })}
                </View>
                {c.triggers ? <Muted style={{ marginTop: spacing.sm }}>{t("triggers")}: {c.triggers}</Muted> : null}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {activeId && !checkinsError && (
        <View style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}>
          <PrimaryButton label={t("quick_checkin")} icon="add" onPress={() => setOpen(true)} testID="add-checkin-button" />
        </View>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="checkin-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("quick_checkin")}</Text>
        {METRICS.map((m) => {
          const invert = m.key === "stress" || m.key === "anxiety";
          return (
            <View key={m.key} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.fieldLabel}>{t(m.label)}</Text>
              <View style={styles.scaleRow}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = vals[m.key] === n;
                  return (
                    <Pressable
                      key={n}
                      testID={`${m.key}-${n}`}
                      onPress={() => setVals((p) => ({ ...p, [m.key]: n }))}
                      style={[styles.scaleDot, active && { backgroundColor: scaleColor(n, invert), borderColor: scaleColor(n, invert) }]}
                    >
                      <Text style={[styles.scaleText, active && { color: colors.onSurfaceInverse }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={styles.fieldLabel}>{`${t("triggers")} (${t("optional")})`}</Text>
        <TextInput
          testID="checkin-triggers"
          value={triggers}
          onChangeText={setTriggers}
          multiline
          style={[styles.input, { height: 80, paddingTop: spacing.md, textAlignVertical: "top" }]}
          placeholderTextColor={colors.onSurfaceSecondary}
        />
        <PrimaryButton label={t("save_checkin")} onPress={save} loading={saving} testID="save-checkin" style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], paddingHorizontal: spacing.lg },
  emptyTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  emptyText: { marginTop: spacing.sm, textAlign: "center", maxWidth: 320 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  sectionTitle: { fontSize: fontSize.lg, lineHeight: 23, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  diagnosisList: { gap: spacing.sm },
  diagnosisRow: { paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  diagnosisTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  codeBadge: { fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontFamily: fonts.text },
  diagnosisName: { flexShrink: 1, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  diagnosisDescription: { marginTop: 6, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  medicationList: { gap: 8 },
  medicationRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  medicationName: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  medicationMeta: { marginTop: 3, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  contextBadge: { borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 8, paddingVertical: 4 },
  contextBadgeText: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  inlineNotice: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  diaryHeader: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  compactEmpty: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  compactEmptyTitle: { marginTop: spacing.sm, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  compactEmptyText: { marginTop: spacing.xs, textAlign: "center", maxWidth: 360 },
  itemHead: { marginBottom: spacing.md },
  itemDate: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  metricsRow: { flexDirection: "row", justifyContent: "space-between" },
  metricCol: { alignItems: "center", gap: 4, flex: 1 },
  metricDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  metricDotText: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: fontSize.base, fontFamily: fonts.text },
  metricLabel: { fontSize: 10, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurface, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  scaleRow: { flexDirection: "row", gap: spacing.sm },
  scaleDot: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scaleText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  input: { minHeight: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.text },
});