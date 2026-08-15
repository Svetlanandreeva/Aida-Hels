import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { GradientCard } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, gradients } from "@/src/theme";

type Mod = {
  key: string;
  settingKey?: string;
  route: string;
  label: string;
  icon: any;
  grad: readonly string[];
  count?: number;
};

type AddAction = {
  key: string;
  settingKey?: string;
  labelRu: string;
  labelEn: string;
  hintRu: string;
  hintEn: string;
  icon: any;
  run: () => void;
};

export default function HealthHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, activeProfile, refreshTick } = useApp();
  const { t, lang } = useI18n();
  const { openSymptom, openMed, openLab } = useLog();
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);

  const enabled = (key?: string) => !key || activeProfile?.module_settings?.[key] !== false;

  const load = useCallback(async () => {
    if (!activeId) {
      setCounts({});
      return;
    }
    try {
      const [labs, vitals, checkins, meds, documents] = await Promise.all([
        api.listLabs(activeId),
        api.listVitals(activeId),
        api.listCheckins(activeId),
        api.listMeds(activeId),
        api.listDocuments(activeId),
      ]);
      setCounts({
        labs: labs.length,
        pressure: vitals.filter((v) => v.kind === "bp").length,
        measures: vitals.filter((v) => v.kind !== "bp").length,
        mind: checkins.length,
        meds: meds.length,
        documents: documents.length,
      });
    } catch (e) {
      setCounts({});
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { load(); }, [load, refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const go = (route: string) => {
    setAddOpen(false);
    setTimeout(() => router.push(route as any), 120);
  };

  const runSheetAction = (action: () => void) => {
    setAddOpen(false);
    setTimeout(action, 180);
  };

  const mods: Mod[] = [
    { key: "labs", settingKey: "labs", route: "/labs", label: t("m_labs"), icon: "water", grad: gradients.pink, count: counts.labs },
    { key: "pressure", settingKey: "pressure", route: "/pressure", label: t("m_pressure"), icon: "heart-circle", grad: gradients.warm, count: counts.pressure },
    { key: "mind", settingKey: "mind", route: "/mind", label: t("m_mind"), icon: "happy", grad: gradients.lime, count: counts.mind },
    { key: "meds", settingKey: "medications", route: "/medications", label: t("m_meds"), icon: "medkit", grad: gradients.cool, count: counts.meds },
    { key: "measures", route: "/measurements", label: t("m_measures"), icon: "fitness", grad: gradients.warmSoft, count: counts.measures },
    { key: "documents", route: "/documents", label: lang === "ru" ? "Документы" : "Documents", icon: "folder", grad: gradients.cool, count: counts.documents },
    { key: "history", route: "/history", label: t("m_history"), icon: "time", grad: gradients.pink, count: undefined },
  ].filter((m) => enabled(m.settingKey));

  const addActions: AddAction[] = [
    {
      key: "pressure",
      settingKey: "pressure",
      labelRu: "Давление",
      labelEn: "Blood pressure",
      hintRu: "Систолическое, диастолическое и пульс",
      hintEn: "Systolic, diastolic and pulse",
      icon: "heart-outline",
      run: () => go("/pressure"),
    },
    {
      key: "symptom",
      labelRu: "Симптом",
      labelEn: "Symptom",
      hintRu: "Что беспокоит и насколько сильно",
      hintEn: "What you feel and how severe it is",
      icon: "pulse-outline",
      run: () => runSheetAction(openSymptom),
    },
    {
      key: "mind",
      settingKey: "mind",
      labelRu: "Самочувствие и сон",
      labelEn: "Wellbeing & sleep",
      hintRu: "Настроение, энергия, стресс, тревога и сон",
      hintEn: "Mood, energy, stress, anxiety and sleep",
      icon: "moon-outline",
      run: () => go("/mind"),
    },
    {
      key: "medication",
      settingKey: "medications",
      labelRu: "Лекарство",
      labelEn: "Medication",
      hintRu: "Название, дозировка и расписание",
      hintEn: "Name, dose and schedule",
      icon: "medkit-outline",
      run: () => runSheetAction(openMed),
    },
    {
      key: "lab",
      settingKey: "labs",
      labelRu: "Анализ",
      labelEn: "Lab result",
      hintRu: "Распознать показатели из фото или PDF",
      hintEn: "Recognize biomarkers from a photo or PDF",
      icon: "document-text-outline",
      run: () => runSheetAction(() => openLab()),
    },
    {
      key: "document",
      labelRu: "Медицинский документ",
      labelEn: "Medical document",
      hintRu: "Выписка, заключение, назначение — сохранить оригинал",
      hintEn: "Discharge summary, doctor note or prescription — store original",
      icon: "document-attach-outline",
      run: () => go("/documents"),
    },
    {
      key: "measurement",
      labelRu: "Вес и измерения",
      labelEn: "Weight & measurements",
      hintRu: "Вес, температура, пульс, SpO₂, талия",
      hintEn: "Weight, temperature, pulse, SpO₂, waist",
      icon: "fitness-outline",
      run: () => go("/measurements"),
    },
  ].filter((a) => enabled(a.settingKey));

  const countLabel = (count?: number) => {
    if (typeof count !== "number" || count === 0) return lang === "ru" ? "Пока нет данных" : "No data yet";
    return String(count);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TopBar subtitle={t("health_modules")} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
      >
        <Pressable style={styles.logCard} onPress={() => setAddOpen(true)} testID="health-log-data-button">
          <View style={styles.logIcon}>
            <Ionicons name="add" size={24} color={colors.surfaceSecondary} />
          </View>
          <View style={styles.logCopy}>
            <Text style={styles.logTitle}>{lang === "ru" ? "Добавить данные" : "Add health data"}</Text>
            <Text style={styles.logSubtitle}>
              {lang === "ru" ? "Давление, симптомы, документы, сон и измерения" : "Vitals, symptoms, documents, sleep and measurements"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.surfaceSecondary} />
        </Pressable>

        <View style={styles.grid}>
          {mods.map((m) => (
            <Pressable
              key={m.key}
              testID={`module-${m.key}`}
              style={styles.cell}
              onPress={() => router.push(m.route as any)}
            >
              <GradientCard gradient={m.grad} style={styles.modCard}>
                <View style={styles.modIcon}>
                  <Ionicons name={m.icon} size={22} color={colors.onSurface} />
                </View>
                <Text style={styles.modLabel}>{m.label}</Text>
                {m.key !== "history" && (
                  <Text style={[styles.modCount, (!m.count || m.count === 0) && styles.modEmpty]}>{countLabel(m.count)}</Text>
                )}
              </GradientCard>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} testID="health-add-data-sheet" scroll>
        <Text style={styles.sheetTitle}>{lang === "ru" ? "Что добавить?" : "What would you like to add?"}</Text>
        <Text style={styles.sheetHint}>{lang === "ru" ? "Выберите тип данных. Всё сохранится в текущий профиль." : "Choose a data type. It will be saved to the current profile."}</Text>
        <View style={styles.actionList}>
          {addActions.map((a) => (
            <Pressable key={a.key} style={styles.actionRow} onPress={a.run} testID={`health-add-${a.key}`}>
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon} size={21} color={colors.onSurface} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{lang === "ru" ? a.labelRu : a.labelEn}</Text>
                <Text style={styles.actionHint}>{lang === "ru" ? a.hintRu : a.hintEn}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  logCard: {
    minHeight: 86,
    borderRadius: radius.xl,
    backgroundColor: colors.onSurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logCopy: { flex: 1 },
  logTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.surfaceSecondary,
    fontFamily: fonts.text,
  },
  logSubtitle: {
    marginTop: 3,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: "rgba(255,255,255,0.68)",
    fontFamily: fonts.text,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cell: { width: "47.8%" },
  modCard: { minHeight: 130, justifyContent: "space-between", padding: spacing.lg },
  modIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  modLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, letterSpacing: -0.2, fontFamily: fonts.text },
  modCount: { fontSize: fontSize.sm, color: "rgba(27,27,29,0.68)", marginTop: 2, fontWeight: "700", fontFamily: fonts.text },
  modEmpty: { fontWeight: "500", color: "rgba(27,27,29,0.48)" },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  sheetHint: { marginTop: spacing.sm, marginBottom: spacing.lg, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  actionList: { gap: spacing.sm },
  actionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  actionHint: { marginTop: 2, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
});