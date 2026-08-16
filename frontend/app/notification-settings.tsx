import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { api } from "@/src/api";
import {
  getNotificationPermissionState,
  NotificationPermissionState,
  requestNotificationPermission,
} from "@/src/notifications";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const CATEGORIES = [
  { key: "medications", icon: "medkit-outline", ru: "Лекарства", en: "Medications", ruSub: "Напоминания о приёме", enSub: "Dose reminders" },
  { key: "pressure", icon: "heart-outline", ru: "Давление", en: "Blood pressure", ruSub: "Запланированные измерения", enSub: "Scheduled measurements" },
  { key: "tasks", icon: "checkbox-outline", ru: "Задачи", en: "Tasks", ruSub: "Пользовательские и медицинские задачи", enSub: "Personal and health tasks" },
  { key: "labs", icon: "water-outline", ru: "Анализы", en: "Lab tests", ruSub: "Готовность результатов и повторные проверки", enSub: "Results and follow-ups" },
  { key: "diary", icon: "happy-outline", ru: "Дневник", en: "Diary", ruSub: "Check-in и дневник самочувствия", enSub: "Check-ins and wellbeing diary" },
  { key: "cycle", icon: "calendar-outline", ru: "Цикл", en: "Cycle", ruSub: "События женского здоровья", enSub: "Women's health events" },
  { key: "aida_signals", icon: "sparkles-outline", ru: "Сигналы Аиды", en: "Aida signals", ruSub: "Только важные персональные наблюдения", enSub: "Important personalized observations only" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];
type NotificationPrefs = Record<CategoryKey, boolean>;

const EMPTY_PREFS: NotificationPrefs = {
  medications: false,
  pressure: false,
  tasks: false,
  labs: false,
  diary: false,
  cycle: false,
  aida_signals: false,
};

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const responsive = useResponsiveLayout();
  const { activeId, activeProfile, bumpRefresh } = useApp();
  const { lang } = useI18n();

  const [permission, setPermission] = useState<NotificationPermissionState>("undetermined");
  const [prefs, setPrefs] = useState<NotificationPrefs>(EMPTY_PREFS);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);

  const text = (ru: string, en: string) => (lang === "ru" ? ru : en);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = await getNotificationPermissionState();
      setPermission(state);

      const privacy = activeProfile?.privacy || {};
      const stored = (privacy.notification_preferences || {}) as Partial<NotificationPrefs>;
      setPrefs({ ...EMPTY_PREFS, ...stored });
      setShowDetails(privacy.show_notification_details === true);
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const savePrivacy = async (patch: Record<string, any>, busyKey: string) => {
    if (!activeId || !activeProfile) return;
    setSavingKey(busyKey);
    try {
      await api.updateProfile(activeId, {
        privacy: {
          ...(activeProfile.privacy || {}),
          ...patch,
        },
      });
      bumpRefresh();
    } finally {
      setSavingKey(null);
    }
  };

  const toggleCategory = async (key: CategoryKey, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await savePrivacy({ notification_preferences: next }, key);
    } catch (_) {
      setPrefs(prefs);
    }
  };

  const toggleDetails = async (value: boolean) => {
    setShowDetails(value);
    try {
      await savePrivacy({ show_notification_details: value }, "details");
    } catch (_) {
      setShowDetails(!value);
    }
  };

  const requestPermission = async () => {
    setPermissionBusy(true);
    try {
      setPermission(await requestNotificationPermission());
    } finally {
      setPermissionBusy(false);
    }
  };

  const permissionCopy = useMemo(() => {
    if (permission === "granted") return { icon: "checkmark-circle", title: text("Системные уведомления разрешены", "System notifications are allowed"), tone: colors.success };
    if (permission === "denied") return { icon: "close-circle", title: text("Системные уведомления запрещены", "System notifications are blocked"), tone: colors.error };
    if (permission === "unavailable") return { icon: "information-circle", title: text("В web-версии системные напоминания недоступны", "System reminders are unavailable on web"), tone: colors.onSurfaceSecondary };
    return { icon: "notifications-outline", title: text("Нужно разрешение устройства", "Device permission is required"), tone: colors.warning };
  }, [permission, lang]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: responsive.contentPadding }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} testID="notifications-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{text("Уведомления", "Notifications")}</Text>
          <Text style={styles.subtitle}>{text("Что может напоминать Аида", "What Aida may remind you about")}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.onSurface} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: responsive.contentPadding, paddingTop: spacing.lg, paddingBottom: 48 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionCard}>
            <View style={styles.permissionRow}>
              <Ionicons name={permissionCopy.icon as any} size={22} color={permissionCopy.tone} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>{permissionCopy.title}</Text>
                <Text style={styles.permissionHint}>{text("Категории ниже не могут отправлять системные напоминания без разрешения устройства.", "Categories below cannot send system reminders without device permission.")}</Text>
              </View>
            </View>
            {permission !== "granted" && permission !== "unavailable" ? (
              <Pressable style={styles.permissionButton} onPress={requestPermission} disabled={permissionBusy} testID="request-notification-permission">
                {permissionBusy ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> : <Text style={styles.permissionButtonText}>{text("Разрешить уведомления", "Allow notifications")}</Text>}
              </Pressable>
            ) : null}
            {Platform.OS === "web" ? <Text style={styles.webHint}>{text("Настройки категорий всё равно сохраняются и будут применены в мобильном приложении.", "Category preferences are still saved and will apply in the mobile app.")}</Text> : null}
          </View>

          <Text style={styles.groupLabel}>{text("КАТЕГОРИИ", "CATEGORIES")}</Text>
          <View style={styles.sectionCard}>
            {CATEGORIES.map((item, index) => (
              <View key={item.key} style={[styles.settingRow, index === CATEGORIES.length - 1 && styles.settingRowLast]}>
                <View style={styles.settingIcon}><Ionicons name={item.icon as any} size={18} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>{lang === "ru" ? item.ru : item.en}</Text>
                  <Text style={styles.settingSubtitle}>{lang === "ru" ? item.ruSub : item.enSub}</Text>
                </View>
                {savingKey === item.key ? <ActivityIndicator size="small" color={colors.onSurfaceSecondary} /> : (
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={(value) => toggleCategory(item.key, value)}
                    trackColor={{ true: colors.accent, false: colors.surfaceTertiary }}
                    thumbColor={colors.surfaceSecondary}
                    testID={`notification-${item.key}`}
                  />
                )}
              </View>
            ))}
          </View>

          <Text style={styles.groupLabel}>{text("ПРИВАТНОСТЬ", "PRIVACY")}</Text>
          <View style={styles.sectionCard}>
            <View style={[styles.settingRow, styles.settingRowLast]}>
              <View style={styles.settingIcon}><Ionicons name="eye-outline" size={18} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{text("Показывать детали на экране блокировки", "Show details on lock screen")}</Text>
                <Text style={styles.settingSubtitle}>{text("Если выключено, уведомление не показывает медицинский текст до открытия Аиды.", "When off, notifications hide medical text until Aida is opened.")}</Text>
              </View>
              {savingKey === "details" ? <ActivityIndicator size="small" color={colors.onSurfaceSecondary} /> : (
                <Switch
                  value={showDetails}
                  onValueChange={toggleDetails}
                  trackColor={{ true: colors.accent, false: colors.surfaceTertiary }}
                  thumbColor={colors.surfaceSecondary}
                  testID="notification-show-details"
                />
              )}
            </View>
          </View>

          {!activeId ? <Text style={styles.noProfile}>{text("Выберите профиль, чтобы сохранить настройки уведомлений.", "Choose a profile to save notification preferences.")}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  subtitle: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  groupLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurfaceSecondary, fontFamily: fonts.text, letterSpacing: 0.6 },
  sectionCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  permissionRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  permissionTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  permissionHint: { marginTop: 3, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  permissionButton: { marginTop: spacing.md, alignSelf: "flex-start", minHeight: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  permissionButtonText: { color: colors.onSurfaceInverse, fontSize: fontSize.sm, fontWeight: "700", fontFamily: fonts.text },
  webHint: { marginTop: spacing.sm, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  settingRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  settingRowLast: { borderBottomWidth: 0 },
  settingIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  settingTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  settingSubtitle: { marginTop: 2, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  noProfile: { marginTop: spacing.lg, textAlign: "center", color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontFamily: fonts.text },
});