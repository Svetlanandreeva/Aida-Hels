import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { api } from "@/src/api";
import { getModuleConfig, ModuleConfig, patchModuleConfig } from "@/src/moduleConfigApi";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

type PuzzleWidget = {
  id: string;
  enabled: boolean;
  show_on_home: boolean;
  order: number;
  allow_ai_analytics: boolean;
  notifications: boolean;
};

const MODULE_LABELS: Record<string, { ru: string; en: string; icon: any }> = {
  nutrition: { ru: "Питание", en: "Nutrition", icon: "restaurant-outline" },
  labs: { ru: "Анализы и биомаркеры", en: "Labs and biomarkers", icon: "flask-outline" },
  symptoms: { ru: "Симптомы и боль", en: "Symptoms and pain", icon: "pulse-outline" },
  pressure: { ru: "Давление и пульс", en: "Blood pressure and pulse", icon: "heart-outline" },
  sleep: { ru: "Сон и восстановление", en: "Sleep and recovery", icon: "moon-outline" },
  mental: { ru: "Психика", en: "Mind", icon: "happy-outline" },
  meds: { ru: "Лекарства", en: "Medications", icon: "medkit-outline" },
  body: { ru: "Организм", en: "Body", icon: "body-outline" },
  chronic: { ru: "Хронические состояния", en: "Chronic conditions", icon: "medical-outline" },
  women: { ru: "Женское здоровье", en: "Women's health", icon: "female-outline" },
  weight: { ru: "Вес и параметры тела", en: "Weight and body metrics", icon: "scale-outline" },
  documents: { ru: "Документы", en: "Documents", icon: "document-text-outline" },
  tasks: { ru: "Задачи и напоминания", en: "Tasks and reminders", icon: "checkbox-outline" },
};

const WIDGET_LABELS: Record<string, { ru: string; en: string; icon: any }> = {
  companion: { ru: "Спутник Аида", en: "Aida companion", icon: "heart-outline" },
  readiness: { ru: "Готовность аналитики", en: "Analytics readiness", icon: "analytics-outline" },
  next_medication: { ru: "Ближайшее лекарство", en: "Next medication", icon: "medkit-outline" },
  recent_symptom: { ru: "Последний симптом", en: "Recent symptom", icon: "pulse-outline" },
  latest_lab: { ru: "Последний анализ", en: "Latest lab result", icon: "water-outline" },
  quests: { ru: "Квесты", en: "Quests", icon: "trophy-outline" },
  quick_note: { ru: "Быстрая заметка", en: "Quick note", icon: "create-outline" },
};

const normalizeWidgets = (items: any[]): PuzzleWidget[] =>
  (items || [])
    .map((w: any) => ({
      id: w.id,
      enabled: w.enabled !== false,
      show_on_home: w.configured_show_on_home !== undefined
        ? w.configured_show_on_home !== false
        : w.show_on_home !== false,
      order: Number.isFinite(w.order) ? w.order : 0,
      allow_ai_analytics: w.allow_ai_analytics !== false,
      notifications: w.notifications === true,
    }))
    .sort((a, b) => a.order - b.order);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const responsive = useResponsiveLayout();
  const { activeId, reload, bumpRefresh } = useApp();
  const { lang, setLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [widgets, setWidgets] = useState<PuzzleWidget[]>([]);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!activeId) {
      setModules([]);
      setWidgets([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [moduleResponse, puzzle] = await Promise.all([
        getModuleConfig(activeId),
        api.getPuzzle(activeId),
      ]);
      setModules([...(moduleResponse.modules || [])].sort((a, b) => a.order - b.order));
      setWidgets(normalizeWidgets(puzzle.widgets || []));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const persistModule = async (code: string, patch: Partial<ModuleConfig>) => {
    if (!activeId) return;
    const previous = modules;
    setModules((items) => items.map((item) => item.module_code === code ? { ...item, ...patch, source: "user" } : item));
    setSaving(true);
    try {
      const response = await patchModuleConfig(activeId, [{ module_code: code, ...patch }]);
      setModules([...(response.modules || [])].sort((a, b) => a.order - b.order));
      await reload();
      bumpRefresh();
    } catch {
      setModules(previous);
      setLoadError(true);
    } finally {
      setSaving(false);
    }
  };

  const enableAllModules = async () => {
    if (!activeId || modules.length === 0 || saving) return;
    const previous = modules;
    setModules((items) => items.map((item) => ({ ...item, enabled: true, source: "user" })));
    setSaving(true);
    try {
      const response = await patchModuleConfig(
        activeId,
        modules.map((module) => ({ module_code: module.module_code, enabled: true })),
      );
      setModules([...(response.modules || [])].sort((a, b) => a.order - b.order));
      await reload();
      bumpRefresh();
    } catch {
      setModules(previous);
      setLoadError(true);
    } finally {
      setSaving(false);
    }
  };

  const persistWidgets = async (next: PuzzleWidget[]) => {
    const normalized = [...next]
      .sort((a, b) => a.order - b.order)
      .map((w, index) => ({ ...w, order: index }));
    setWidgets(normalized);
    if (!activeId) return;
    setSaving(true);
    try {
      await api.savePuzzle(activeId, normalized);
      bumpRefresh();
    } catch {
      setLoadError(true);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const patchWidget = (id: string, patch: Partial<PuzzleWidget>) =>
    persistWidgets(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const moveWidget = (id: string, direction: -1 | 1) => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((w) => w.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    persistWidgets(sorted.map((w, i) => ({ ...w, order: i })));
  };

  const toggleModuleExpanded = (code: string) => {
    setExpandedModules((current) => ({
      ...current,
      [code]: current[code] === false,
    }));
  };

  const text = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const allModulesEnabled = modules.length > 0 && modules.every((module) => module.enabled);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: responsive.contentPadding }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} testID="settings-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{text("Настройки", "Settings")}</Text>
          <Text style={styles.subtitle}>{text("Профиль, модули и Главная", "Profile, modules and Home")}</Text>
        </View>
        {saving ? <ActivityIndicator color={colors.onSurface} /> : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: responsive.contentPadding, paddingTop: spacing.lg, paddingBottom: 48 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{text("Язык", "Language")}</Text>
          <View style={styles.segmented}>
            <Pressable onPress={() => setLang("ru")} style={[styles.segment, lang === "ru" && styles.segmentActive]} testID="settings-lang-ru">
              <Text style={[styles.segmentText, lang === "ru" && styles.segmentTextActive]}>RU</Text>
            </Pressable>
            <Pressable onPress={() => setLang("en")} style={[styles.segment, lang === "en" && styles.segmentActive]} testID="settings-lang-en">
              <Text style={[styles.segmentText, lang === "en" && styles.segmentTextActive]}>EN</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.groupLabel}>{text("МОЯ АИДА — МОДУЛИ", "MY AIDA — MODULES")}</Text>
        <Text style={styles.groupHint}>{text(
          "Включение модуля, показ на Главной, AI-аналитика и уведомления настраиваются независимо. Отключение модуля не удаляет историю.",
          "Module access, Home visibility, AI analytics and notifications are independent. Disabling a module does not delete its history.",
        )}</Text>

        {!loading && modules.length > 0 ? (
          <View style={[styles.sectionCard, { marginBottom: spacing.md }]} testID="settings-track-all">
            <Text style={styles.sectionTitle}>{text("Быстрая сборка", "Quick setup")}</Text>
            <Text style={styles.emptyText}>{text(
              "Можно включить все готовые модули одним выбором. Разрешения для Главной, аналитики Аиды и уведомлений останутся такими, как вы настроили.",
              "Enable every ready module at once. Home, Aida analytics and notification permissions keep their current values.",
            )}</Text>
            <Pressable
              onPress={() => void enableAllModules()}
              disabled={saving || allModulesEnabled}
              style={[styles.retryButton, (saving || allModulesEnabled) && styles.disabled]}
              testID="settings-enable-all-modules"
            >
              <Text style={styles.retryText}>{allModulesEnabled ? text("Все готовые модули включены", "All ready modules are enabled") : text("Хочу отслеживать всё", "I want to track everything")}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loader}><ActivityIndicator color={colors.onSurface} /></View>
        ) : loadError && modules.length === 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.emptyTitle}>{text("Не удалось загрузить настройки", "Could not load settings")}</Text>
            <Text style={styles.emptyText}>{text("Каталог модулей не заменяется ложным пустым состоянием. Попробуйте ещё раз.", "The module registry is not replaced by a false empty state. Please retry.")}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>{text("Повторить", "Retry")}</Text></Pressable>
          </View>
        ) : (
          modules.map((module) => {
            const meta = MODULE_LABELS[module.module_code];
            if (!meta) return null;
            const expanded = expandedModules[module.module_code] !== false;
            return (
              <View key={module.module_code} style={styles.widgetCard} testID={`settings-module-${module.module_code}`}>
                <View style={[styles.widgetHeader, !expanded && styles.widgetHeaderCollapsed]}>
                  <View style={styles.widgetIcon}><Ionicons name={meta.icon} size={19} color={colors.onSurface} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.widgetTitle}>{lang === "ru" ? meta.ru : meta.en}</Text>
                    <Text style={styles.widgetOrder}>{text(`Источник: ${module.source}`, `Source: ${module.source}`)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={expanded ? text("Свернуть модуль", "Collapse module") : text("Развернуть модуль", "Expand module")}
                    onPress={() => toggleModuleExpanded(module.module_code)}
                    style={styles.collapseButton}
                    testID={`settings-module-collapse-${module.module_code}`}
                  >
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.onSurface} />
                  </Pressable>
                </View>
                {expanded ? (
                  <>
                    <SettingToggle label={text("Включить в приложение", "Enable in app")} value={module.enabled} onChange={(value) => persistModule(module.module_code, { enabled: value })} testID={`settings-module-enabled-${module.module_code}`} />
                    <SettingToggle label={text("Показывать на Главной", "Show on Home")} value={module.show_on_home} disabled={!module.enabled} onChange={(value) => persistModule(module.module_code, { show_on_home: value })} testID={`settings-module-home-${module.module_code}`} />
                    <SettingToggle label={text("Использовать данные в аналитике Аиды", "Use data in Aida analytics")} value={module.allow_ai_analytics} disabled={!module.enabled} onChange={(value) => persistModule(module.module_code, { allow_ai_analytics: value })} testID={`settings-module-ai-${module.module_code}`} />
                    <SettingToggle label={text("Уведомления", "Notifications")} value={module.notifications_enabled} disabled={!module.enabled} onChange={(value) => persistModule(module.module_code, { notifications_enabled: value })} testID={`settings-module-notifications-${module.module_code}`} last />
                  </>
                ) : null}
              </View>
            );
          })
        )}

        <Text style={styles.groupLabel}>{text("ГЛАВНАЯ — КАРТОЧКИ", "HOME — CARDS")}</Text>
        <Text style={styles.groupHint}>{text(
          "Здесь меняются только порядок и видимость карточек Главной. Это не включает медицинский модуль и не даёт Аиде доступ к его данным.",
          "Only Home-card order and visibility are configured here. This does not enable a medical module or grant Aida access to its data.",
        )}</Text>

        {!loading && widgets.map((w, index) => {
          const meta = WIDGET_LABELS[w.id];
          if (!meta) return null;
          const visible = w.enabled && w.show_on_home;
          return (
            <View key={w.id} style={styles.widgetCard} testID={`settings-widget-${w.id}`}>
              <View style={styles.widgetHeader}>
                <View style={styles.widgetIcon}><Ionicons name={meta.icon} size={19} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.widgetTitle}>{lang === "ru" ? meta.ru : meta.en}</Text>
                  <Text style={styles.widgetOrder}>{text(`Позиция ${index + 1}`, `Position ${index + 1}`)}</Text>
                </View>
                <View style={styles.orderButtons}>
                  <Text style={styles.orderLabel}>{text("Порядок", "Order")}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text("Поднять карточку выше", "Move card up")}
                    disabled={index === 0}
                    onPress={() => moveWidget(w.id, -1)}
                    style={[styles.orderButton, index === 0 && styles.disabled]}
                    testID={`settings-move-up-${w.id}`}
                  >
                    <Ionicons name="arrow-up-outline" size={18} color={colors.onSurface} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text("Опустить карточку ниже", "Move card down")}
                    disabled={index === widgets.length - 1}
                    onPress={() => moveWidget(w.id, 1)}
                    style={[styles.orderButton, index === widgets.length - 1 && styles.disabled]}
                    testID={`settings-move-down-${w.id}`}
                  >
                    <Ionicons name="arrow-down-outline" size={18} color={colors.onSurface} />
                  </Pressable>
                </View>
              </View>
              <SettingToggle
                label={text("Показывать карточку", "Show card")}
                value={visible}
                onChange={(value) => patchWidget(w.id, { enabled: value ? true : w.enabled, show_on_home: value })}
                testID={`settings-widget-visible-${w.id}`}
                last
              />
            </View>
          );
        })}

        <Text style={styles.groupLabel}>{text("СИСТЕМА", "SYSTEM")}</Text>
        <View style={styles.sectionCard}>
          <SettingsLink icon="watch-outline" title={text("Устройства", "Devices")} subtitle={text("Apple Health, Health Connect и другие источники", "Apple Health, Health Connect and other sources")} onPress={() => router.push("/devices" as any)} />
          <SettingsLink icon="notifications-outline" title={text("Уведомления", "Notifications")} subtitle={text("Лекарства, давление, задачи, анализы, дневник, цикл и сигналы Аиды", "Medications, pressure, tasks, labs, diary, cycle and Aida signals")} onPress={() => router.push("/notification-settings" as any)} />
          <SettingsLink icon="shield-checkmark-outline" title={text("Приватность", "Privacy")} subtitle={text("AI, уведомления, сессии и доступ", "AI, notifications, sessions and access")} onPress={() => router.push("/privacy" as any)} />
          <SettingsLink icon="download-outline" title={text("Экспорт данных", "Data export")} subtitle={text("Скачать данные текущего профиля", "Download the current profile data")} onPress={() => router.push("/export-data" as any)} last />
        </View>
      </ScrollView>
    </View>
  );
}

const SettingToggle: React.FC<{ label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; testID: string; last?: boolean }> = ({ label, value, onChange, disabled, testID, last }) => (
  <View style={[styles.toggleRow, last && styles.toggleRowLast, disabled && styles.disabled]}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch testID={testID} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.surfaceTertiary }} thumbColor={colors.surfaceSecondary} />
  </View>
);

const SettingsLink: React.FC<{ icon: any; title: string; subtitle: string; onPress: () => void; last?: boolean }> = ({ icon, title, subtitle, onPress, last }) => (
  <Pressable style={[styles.linkRow, last && styles.linkRowLast]} onPress={onPress}>
    <View style={styles.linkIcon}><Ionicons name={icon} size={19} color={colors.onSurface} /></View>
    <View style={{ flex: 1 }}><Text style={styles.linkTitle}>{title}</Text><Text style={styles.linkSubtitle}>{subtitle}</Text></View>
    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  subtitle: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  groupLabel: { marginTop: spacing.xl, fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurfaceSecondary, fontFamily: fonts.text, letterSpacing: 0.6 },
  groupHint: { marginTop: spacing.xs, marginBottom: spacing.md, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  sectionCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text, marginBottom: spacing.sm },
  segmented: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: colors.border },
  segment: { paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  segmentTextActive: { color: colors.onBrandPrimary },
  loader: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  emptyText: { marginTop: spacing.xs, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  retryButton: { alignSelf: "flex-start", marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface },
  retryText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  widgetCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  widgetHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md },
  widgetHeaderCollapsed: { paddingBottom: 0 },
  widgetIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  widgetTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  widgetOrder: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  collapseButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  orderButtons: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderLabel: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  orderButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
  toggleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.divider },
  toggleRowLast: { paddingBottom: 0 },
  toggleLabel: { flex: 1, paddingRight: spacing.md, fontSize: fontSize.sm, color: colors.onSurface, fontFamily: fonts.text },
  linkRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  linkRowLast: { borderBottomWidth: 0 },
  linkIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  linkTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  linkSubtitle: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
});