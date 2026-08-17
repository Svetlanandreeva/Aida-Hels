import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { accountSessionsApi, AccountSession } from "@/src/accountSessionsApi";
import { useAuth } from "@/src/auth";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

export default function PrivacyScreen() {
  const { account } = useAuth();
  if (!account) return <PublicPrivacyPolicy />;
  return <AccountPrivacySettings />;
}

function PublicPrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
      <Pressable style={s.back} onPress={() => router.back()} accessibilityRole="button">
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>
      <Text style={s.title}>Политика конфиденциальности Аиды</Text>
      <Text style={s.sub}>Редакция от 17 августа 2026 года</Text>
      <PolicySection title="Какие данные обрабатываются">Аида может обрабатывать данные аккаунта, сведения профиля здоровья, загруженные документы, дневники, показатели устройств и техническую информацию, необходимую для безопасности и работы сервиса.</PolicySection>
      <PolicySection title="Зачем нужны данные">Данные используются для работы выбранных пользователем функций: хранения медицинской истории, отображения динамики, напоминаний, персонализации интерфейса и формирования информационных подсказок.</PolicySection>
      <PolicySection title="Вход через Яндекс ID и VK ID">При социальной авторизации Аида получает только данные, необходимые для создания или поиска аккаунта в пределах разрешений, подтверждённых пользователем у соответствующего провайдера. Медицинская информация Аиды не передаётся провайдеру только из-за факта такого входа.</PolicySection>
      <PolicySection title="Безопасность">Пароли не должны храниться в открытом виде. Сессии и операции восстановления доступа ограничиваются по сроку действия, а чувствительные операции должны проходить через защищённое соединение.</PolicySection>
      <PolicySection title="Передача и удаление">Данные могут передаваться техническим подрядчикам только в объёме, необходимом для работы инфраструктуры и выбранных функций, либо когда это требуется законом. Пользователь должен иметь возможность исправить данные и запросить удаление аккаунта с учётом обязательных сроков хранения, если они применимы.</PolicySection>
      <View style={s.legalNote}><Text style={s.legalNoteText}>До публичного коммерческого запуска в документ необходимо добавить юридические реквизиты оператора персональных данных, контакт для обращений, фактические сроки хранения и перечень используемых обработчиков данных.</Text></View>
    </ScrollView>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.policySection}><Text style={s.policyHeading}>{title}</Text><Text style={s.policyBody}>{children}</Text></View>;
}

function AccountPrivacySettings() {
  const { activeId, activeProfile, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setSessions(await accountSessionsApi.list()); } catch { setSessions([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const privacy = activeProfile?.privacy || {};
  const patch = async (key: string, value: boolean) => {
    if (!activeId) return;
    await api.updateProfile(activeId, { privacy: { ...privacy, [key]: value } });
    await reload();
  };
  const revokeOthers = async () => {
    setBusy(true);
    try { await accountSessionsApi.revokeOthers(); await load(); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }]}>
      <Pressable style={s.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.onSurface} /></Pressable>
      <Text style={s.title}>{ru ? "Приватность" : "Privacy"}</Text>
      <Text style={s.sub}>{ru ? "Управление тем, что Аида может использовать, и активными сессиями аккаунта." : "Control what Aida may use and your active account sessions."}</Text>
      <View style={s.card}>
        <Toggle label={ru ? "Использовать мои данные в контексте Аиды" : "Use my data in Aida context"} value={privacy.include_in_ai_context !== false} onChange={(v) => patch("include_in_ai_context", v)} />
        <Toggle label={ru ? "Разрешить AI-анализ данных устройств" : "Allow AI analysis of device data"} value={privacy.allow_wearable_ai !== false} onChange={(v) => patch("allow_wearable_ai", v)} />
        <Toggle label={ru ? "Показывать медицинские детали в уведомлениях" : "Show health details in notifications"} value={privacy.show_notification_details === true} onChange={(v) => patch("show_notification_details", v)} />
      </View>
      <Text style={s.section}>{ru ? "Сессии" : "Sessions"}</Text>
      {sessions.map((x) => (
        <View key={x.id} style={s.session}>
          <Ionicons name={x.active ? "phone-portrait-outline" : "close-circle-outline"} size={20} color={x.active ? colors.onSurface : colors.onSurfaceSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={s.sessionTitle}>{x.is_current ? (ru ? "Это устройство" : "This device") : x.active ? (ru ? "Активная сессия" : "Active session") : (ru ? "Завершена" : "Revoked")}</Text>
            <Text style={s.meta}>{String(x.created_at || "").replace("T", " ").slice(0, 16)}</Text>
          </View>
          {x.active && !x.is_current ? <Pressable onPress={async () => { await accountSessionsApi.revoke(x.id); await load(); }}><Text style={s.danger}>{ru ? "Завершить" : "Revoke"}</Text></Pressable> : null}
        </View>
      ))}
      <Pressable disabled={busy} style={s.dangerButton} onPress={revokeOthers}>{busy ? <ActivityIndicator color={colors.error} /> : <Text style={s.dangerButtonText}>{ru ? "Завершить сессии на других устройствах" : "Sign out on other devices"}</Text>}</Pressable>
    </ScrollView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <View style={s.toggle}><Text style={s.toggleText}>{label}</Text><Switch value={value} onValueChange={onChange} /></View>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: spacing.xl },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "800", fontFamily: fonts.display, color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  card: { marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  toggle: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  toggleText: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "700" },
  section: { fontSize: fontSize.xl, fontWeight: "800", fontFamily: fonts.display, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  session: { minHeight: 64, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  sessionTitle: { fontWeight: "800", color: colors.onSurface },
  meta: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  danger: { color: colors.error, fontWeight: "800" },
  dangerButton: { minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.error, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  dangerButtonText: { color: colors.error, fontWeight: "800" },
  policySection: { marginTop: spacing.xl },
  policyHeading: { fontSize: 18, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  policyBody: { marginTop: spacing.sm, fontSize: 15, lineHeight: 23, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  legalNote: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  legalNoteText: { fontSize: 13, lineHeight: 20, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
});
