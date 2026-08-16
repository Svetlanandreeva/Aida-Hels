import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { api } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

 type PuzzleWidget = {
  id: string;
  enabled: boolean;
  show_on_home: boolean;
  order: number;
  allow_ai_analytics: boolean;
  notifications: boolean;
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
      show_on_home: w.show_on_home !== false,
      order: Number.isFinite(w.order) ? w.order : 0,
      allow_ai_analytics: w.allow_ai_analytics !== false,
      notifications: w.notifications === true,
    }))
    .sort((a, b) => a.order - b.order);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const responsive = useResponsiveLayout();
  const { activeId } = useApp();
  const { lang, setLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [widgets, setWidgets] = useState<PuzzleWidget[]>([]);

  const load = useCallback(async () => {
    if (!activeId) {
      setWidgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const puzzle = await api.getPuzzle(activeId);
      setWidgets(normalizeWidgets(puzzle.widgets || []));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { load().catch(() => setLoading(false)); }, [load]));

  const persist = async (next: PuzzleWidget[]) => {
    const normalized = [...next]
      .sort((a, b) => a.order - b.order)
      .map((w, index) => ({ ...w, order: index }));
    setWidgets(normalized);
    if (!activeId) return;
    setSaving(true);
    try {
      await api.savePuzzle(activeId, normalized);
    } finally {
      setSaving(false);
    }
  };

  const patchWidget = (id: string, patch: Partial<PuzzleWidget>) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const moveWidget = (id: string, direction: -1 | 1) => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((w) => w.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    persist(sorted.map((w, i) => ({ ...w, order: i })));
  };

  const text = (ru: string, en: string) => (lang === "ru" ? ru : en);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: responsive.contentPadding }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} testID="settings-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{text("Настройки", "Settings")}</Text>
          <Text style={styles.subtitle}>{text("Профиль, Главная и подключённые функции", "Profile, Home and connected features")}</Text>
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

        <Text style={styles.groupLabel}>{text("ПАЗЛ ГЛАВНОЙ", "HOME PUZZLE")}</Text>
        <Text style={styles.groupHint}>{text("Здесь настраивается состав Главной: какие модули включены, что видно на экране и какие данные может использовать Аида.", "Configure Home here: enabled modules, visible cards and what Aida may use for analytics.")}</Text>

        {loading ? (
          <View style={styles.loader}><ActivityIndicator color={colors.onSurface} /></View>
        ) : widgets.length === 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.emptyTitle}>{text("Пока нечего настраивать", "Nothing to configure yet")}</Text>
            <Text style={styles.emptyText}>{text("Модули появятся после создания профиля и загрузки конфигурации.", "Modules will appear after a profile and configuration are available.")}</Text>
          </View>
        ) : (
          widgets.map((w, index) => {
            const meta = WIDGET_LABELS[w.id];
            if (!meta) return null;
            return (
              <View key={w.id} style={styles.widgetCard} testID={`settings-widget-${w.id}`}>
                <View style={styles.widgetHeader}>
                  <View style={styles.widgetIcon}><Ionicons name={meta.icon} size={19} color={colors.onSurface} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.widgetTitle}>{lang === "ru" ? meta.ru : meta.en}</Text>
                    <Text style={styles.widgetOrder}>{text(`Позиция ${index + 1}`, `Position ${index + 1}`)}</Text>
                  </View>
                  <View style={styles.orderButtons}>
                    <Pressable disabled={index === 0} onPress={() => moveWidget(w.id, -1)} style={[styles.orderButton, index === 0 && styles.disabled]} testID={`settings-move-up-${w.id}`}>
                      <Ionicons name="chevron-up" size={18} color={colors.onSurface} />
                    </Pressable>
                    <Pressable disabled={index === widgets.length - 1} onPress={() => moveWidget(w.id, 1)} style={[styles.orderButton, index === widgets.length - 1 && styles.disabled]} testID={`settings-move-down-${w.id}`}>
                      <Ionicons name="chevron-down" size={18} color={colors.onSurface} />
                    </Pressable>
                  </View>
                </View>
                <SettingToggle label={text("Модуль включён", "Module enabled")} value={w.enabled} onChange={(value) => patchWidget(w.id, { enabled: value })} testID={`settings-enabled-${w.id}`} />
                <SettingToggle label={text("Показывать на Главной", "Show on Home")} value={w.show_on_home} disabled={!w.enabled} onChange={(value) => patchWidget(w.id, { show_on_home: value })} testID={`settings-home-${w.id}`} />
                <SettingToggle label={text("Разрешить AI-аналитику", "Allow AI analytics")} value={w.allow_ai_analytics} disabled={!w.enabled} onChange={(value) => patchWidget(w.id, { allow_ai_analytics: value })} testID={`settings-ai-${w.id}`} />
                <SettingToggle label={text("Уведомления", "Notifications")} value={w.notifications} disabled={!w.enabled} onChange={(value) => patchWidget(w.id, { notifications: value })} testID={`settings-notifications-${w.id}`} last />
              </View>
            );
          })
        )}

        <Text style={styles.groupLabel}>{text("СИСТЕМА", "SYSTEM")}</Text>
        <View style={styles.sectionCard}>
          <SettingsLink icon="watch-outline" title={text("Устройства", "Devices")} subtitle={text("Apple Health, Health Connect и другие источники", "Apple Health, Health Connect and other sources")} onPress={() => router.push("/devices" as any)} />
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
  widgetCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  widgetHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md },
  widgetIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  widgetTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  widgetOrder: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  orderButtons: { flexDirection: "row", gap: 6 },
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
