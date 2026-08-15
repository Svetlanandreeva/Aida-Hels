import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fonts, radius, spacing } from "@/src/theme";
import {
  getWearableStatus,
  providerAvailability,
  syncAppleHealth,
  WearableProvider,
  WearableStatusMap,
} from "@/src/wearables";

const PROVIDERS: Array<{ key: WearableProvider; icon: keyof typeof Ionicons.glyphMap; ru: string; en: string; hint: string }> = [
  { key: "apple_health", icon: "watch-outline", ru: "Apple Health / Apple Watch", en: "Apple Health / Apple Watch", hint: "Пульс · HRV · сон · шаги · SpO₂ · дыхание · температура" },
  { key: "health_connect", icon: "fitness-outline", ru: "Health Connect", en: "Health Connect", hint: "Android-часы и приложения, которые синхронизируются с Health Connect" },
  { key: "google_health", icon: "heart-circle-outline", ru: "Google Health / Fitbit", en: "Google Health / Fitbit", hint: "Облачное подключение Fitbit и Google Health" },
  { key: "samsung_health", icon: "pulse-outline", ru: "Samsung Health", en: "Samsung Health", hint: "Galaxy Watch · Galaxy Ring · Samsung Health" },
  { key: "garmin", icon: "navigate-circle-outline", ru: "Garmin Connect", en: "Garmin Connect", hint: "Пульс · сон · stress · Pulse Ox · Body Battery" },
  { key: "oura", icon: "ellipse-outline", ru: "Oura Ring", en: "Oura Ring", hint: "Сон · readiness · пульс · HRV · температура" },
];

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const [status, setStatus] = useState<WearableStatusMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<WearableProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeId) {
      setLoading(false);
      return;
    }
    try {
      setStatus(await getWearableStatus(activeId));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  const connectApple = async () => {
    if (!activeId) return;
    setSyncing("apple_health");
    setMessage(null);
    try {
      const result = await syncAppleHealth(activeId, 30);
      setMessage(lang === "ru" ? `Синхронизировано: ${result.inserted}, уже было: ${result.skipped}` : `Synced: ${result.inserted}, already present: ${result.skipped}`);
      await load();
    } catch (error: any) {
      setMessage(error?.message || (lang === "ru" ? "Не удалось подключить Apple Health" : "Could not connect Apple Health"));
    } finally {
      setSyncing(null);
    }
  };

  const pageTitle = lang === "ru" ? "Устройства и часы" : "Devices & wearables";
  const subtitle = useMemo(
    () => lang === "ru" ? "Подключайте источники здоровья. Аида сохраняет только те типы данных, доступ к которым вы разрешили." : "Connect health sources. Aida stores only the data types you authorize.",
    [lang]
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <Ionicons name="chevron-back" size={21} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{pageTitle}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
        {loading ? <ActivityIndicator color={colors.onSurface} style={{ marginTop: 40 }} /> : PROVIDERS.map((provider) => {
          const providerStatus = status?.[provider.key];
          const availability = providerAvailability(provider.key);
          const connected = providerStatus?.connected === true;
          const isAppleAction = provider.key === "apple_health" && availability.actionable;
          return (
            <View key={provider.key} style={styles.card}>
              <View style={styles.iconWrap}><Ionicons name={provider.icon} size={23} color={colors.onSurface} /></View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{lang === "ru" ? provider.ru : provider.en}</Text>
                  <View style={[styles.badge, connected && styles.badgeConnected]}>
                    <Text style={[styles.badgeText, connected && styles.badgeTextConnected]}>{connected ? (lang === "ru" ? "Подключено" : "Connected") : (lang === "ru" ? "Не подключено" : "Not connected")}</Text>
                  </View>
                </View>
                <Text style={styles.hint}>{provider.hint}</Text>
                {connected && providerStatus?.last_sync_at ? <Text style={styles.meta}>{lang === "ru" ? "Последняя синхронизация" : "Last sync"}: {new Date(providerStatus.last_sync_at).toLocaleString()}</Text> : null}
                {!connected && availability.reason ? <Text style={styles.meta}>{availability.reason}</Text> : null}
              </View>
              {isAppleAction ? (
                <Pressable onPress={connectApple} disabled={syncing !== null} style={styles.action} accessibilityRole="button">
                  {syncing === "apple_health" ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> : <Text style={styles.actionText}>{connected ? (lang === "ru" ? "Синхронизировать" : "Sync") : (lang === "ru" ? "Подключить" : "Connect")}</Text>}
                </Pressable>
              ) : (
                <View style={styles.platformTag}><Text style={styles.platformText}>{provider.key === "health_connect" ? "Android" : provider.key === "apple_health" ? "iOS" : "Cloud"}</Text></View>
              )}
            </View>
          );
        })}
        {Platform.OS === "web" ? <Text style={styles.webNote}>{lang === "ru" ? "Разрешение HealthKit/Health Connect выдаётся только внутри нативного приложения на телефоне, не в браузере." : "HealthKit/Health Connect authorization is available only in the native phone app, not in the browser."}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, lineHeight: 29, fontFamily: fonts.display, fontWeight: "800", color: colors.onSurface },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text, maxWidth: 720 },
  content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: 18, gap: 12 },
  message: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  messageText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  cardTitle: { fontSize: 16, lineHeight: 20, fontFamily: fonts.text, fontWeight: "800", color: colors.onSurface },
  hint: { marginTop: 5, fontSize: 12, lineHeight: 17, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  meta: { marginTop: 5, fontSize: 11, lineHeight: 15, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceTertiary },
  badgeConnected: { backgroundColor: "rgba(44,176,112,0.14)" },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  badgeTextConnected: { color: colors.success },
  action: { minWidth: 104, height: 38, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.onSurfaceInverse, fontSize: 12, fontWeight: "800", fontFamily: fonts.text },
  platformTag: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface },
  platformText: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  webNote: { marginTop: 8, fontSize: 11, lineHeight: 16, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
});
