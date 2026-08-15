import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AidaHealthModule } from "@/modules/aida-health";
import {
  deviceApi,
  AppleHealthStatus,
  WearableStatusResponse,
} from "@/src/device-api";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { useApp } from "@/src/store";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Provider = {
  id: string;
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  metrics: string[];
  status: "ready" | "partner";
};

const PROVIDERS: Provider[] = [
  {
    id: "apple",
    name: "Apple Health / Apple Watch",
    subtitle: "iPhone · Apple Watch",
    icon: "logo-apple",
    metrics: ["Пульс", "HRV", "Сон", "SpO₂", "Шаги", "VO₂ max"],
    status: "ready",
  },
  {
    id: "health-connect",
    name: "Health Connect",
    subtitle: "Android · Wear OS · совместимые приложения",
    icon: "fitness-outline",
    metrics: ["Пульс", "HRV", "Сон", "Шаги", "SpO₂", "VO₂ max"],
    status: "ready",
  },
  {
    id: "samsung",
    name: "Samsung Health",
    subtitle: "Galaxy Watch · Galaxy Ring",
    icon: "watch-outline",
    metrics: ["Пульс", "Сон", "SpO₂", "Температура", "Шаги"],
    status: "partner",
  },
  {
    id: "garmin",
    name: "Garmin",
    subtitle: "Garmin Connect",
    icon: "navigate-circle-outline",
    metrics: ["Пульс", "HRV", "Сон", "Stress", "Pulse Ox"],
    status: "partner",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    subtitle: "Fitbit Web API",
    icon: "pulse-outline",
    metrics: ["Пульс", "HRV", "Сон", "SpO₂", "Температура"],
    status: "partner",
  },
  {
    id: "oura",
    name: "Oura",
    subtitle: "Oura Ring",
    icon: "ellipse-outline",
    metrics: ["Пульс", "HRV", "Сон", "SpO₂", "Температура"],
    status: "partner",
  },
];

function formatSyncDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const { activeId } = useApp();
  const [appleStatus, setAppleStatus] = useState<AppleHealthStatus | null>(null);
  const [wearableStatus, setWearableStatus] = useState<WearableStatusResponse["providers"]>({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const appleNativeAvailable = useMemo(
    () => Platform.OS === "ios" && AidaHealthModule.isAvailable(),
    []
  );
  const healthConnectNativeAvailable = useMemo(
    () => Platform.OS === "android" && AidaHealthModule.isAvailable(),
    []
  );

  const refreshStatuses = useCallback(async () => {
    if (!activeId) return;
    setLoadingStatus(true);
    const [apple, wearables] = await Promise.allSettled([
      deviceApi.appleHealthStatus(activeId),
      deviceApi.wearableStatus(activeId),
    ]);
    setAppleStatus(apple.status === "fulfilled" ? apple.value : null);
    setWearableStatus(wearables.status === "fulfilled" ? wearables.value.providers : {});
    setLoadingStatus(false);
  }, [activeId]);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  const requireProfile = () => {
    if (activeId) return true;
    setMessage("Сначала выберите профиль здоровья.");
    return false;
  };

  const connectAppleHealth = async () => {
    if (!requireProfile() || !activeId) return;
    if (!appleNativeAvailable) {
      setMessage(
        Platform.OS === "web"
          ? "Apple Health подключается из установленного приложения Aida на iPhone. В браузере HealthKit недоступен."
          : "Apple Health доступен только в приложении Aida на iPhone."
      );
      return;
    }

    setBusyProvider("apple");
    setMessage(null);
    try {
      const authorized = await AidaHealthModule.requestAuthorization();
      if (!authorized) {
        setMessage("Доступ к Apple Health не был предоставлен.");
        return;
      }
      const samples = await AidaHealthModule.readRecentSamples(7);
      const result = await deviceApi.syncAppleHealth(activeId, samples);
      setMessage(
        samples.length
          ? `Apple Health: добавлено ${result.inserted}, уже было ${result.skipped}.`
          : "Разрешение Apple Health получено. Новых данных за 7 дней пока нет."
      );
      await refreshStatuses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось синхронизировать Apple Health.");
    } finally {
      setBusyProvider(null);
    }
  };

  const syncAppleHealth = async () => {
    if (!requireProfile() || !activeId || !appleNativeAvailable) return connectAppleHealth();
    setBusyProvider("apple");
    setMessage(null);
    try {
      const samples = await AidaHealthModule.readRecentSamples(7);
      const result = await deviceApi.syncAppleHealth(activeId, samples);
      setMessage(`Apple Health: +${result.inserted}, без дублей: ${result.skipped}.`);
      await refreshStatuses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить Apple Health.");
    } finally {
      setBusyProvider(null);
    }
  };

  const connectHealthConnect = async () => {
    if (!requireProfile() || !activeId) return;
    if (!healthConnectNativeAvailable) {
      setMessage(
        Platform.OS === "web"
          ? "Health Connect подключается из установленного приложения Aida на Android."
          : "Health Connect недоступен на этом устройстве или требует установки/обновления."
      );
      return;
    }

    setBusyProvider("health-connect");
    setMessage(null);
    try {
      const authorized = await AidaHealthModule.requestAuthorization();
      if (!authorized) {
        setMessage("Доступ к Health Connect не был предоставлен полностью.");
        return;
      }
      const samples = await AidaHealthModule.readRecentSamples(7);
      const result = await deviceApi.syncWearable(activeId, "health_connect", samples);
      setMessage(
        samples.length
          ? `Health Connect: добавлено ${result.inserted}, уже было ${result.skipped}.`
          : "Разрешение Health Connect получено. Новых данных за 7 дней пока нет."
      );
      await refreshStatuses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось синхронизировать Health Connect.");
    } finally {
      setBusyProvider(null);
    }
  };

  const syncHealthConnect = async () => {
    if (!requireProfile() || !activeId || !healthConnectNativeAvailable) return connectHealthConnect();
    setBusyProvider("health-connect");
    setMessage(null);
    try {
      const samples = await AidaHealthModule.readRecentSamples(7);
      const result = await deviceApi.syncWearable(activeId, "health_connect", samples);
      setMessage(`Health Connect: +${result.inserted}, без дублей: ${result.skipped}.`);
      await refreshStatuses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить Health Connect.");
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            paddingHorizontal: responsive.contentPadding,
          },
        ]}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={21} color={colors.onSurface} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Устройства и здоровье</Text>
          <Text style={styles.subtitle}>Подключайте только те источники, которым хотите дать доступ.</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: responsive.contentPadding,
            paddingBottom: 40 + insets.bottom,
          },
        ]}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.onSurface} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.introTitle}>Данные под вашим контролем</Text>
            <Text style={styles.introText}>
              Аида запрашивает доступ отдельно у системы или сервиса устройства и принимает только выбранные показатели здоровья.
            </Text>
          </View>
        </View>

        {message ? (
          <View style={styles.messageCard}>
            <Ionicons name="information-circle-outline" size={19} color={colors.onSurface} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={[styles.grid, responsive.width < 720 && styles.gridStack]}>
          {PROVIDERS.map((provider) => {
            const isApple = provider.id === "apple";
            const isHealthConnect = provider.id === "health-connect";
            const isDirectProvider = isApple || isHealthConnect;
            const providerStatus = isHealthConnect ? wearableStatus.health_connect : null;
            const connected = isApple ? Boolean(appleStatus?.connected) : isHealthConnect ? Boolean(providerStatus?.connected) : false;
            const lastSync = isApple
              ? formatSyncDate(appleStatus?.last_sync_at)
              : isHealthConnect
                ? formatSyncDate(providerStatus?.last_sync_at)
                : null;
            const actionText = connected ? "Синхронизировать" : "Подключить";
            const busy = busyProvider === provider.id;
            const onDirectPress = isApple
              ? connected
                ? syncAppleHealth
                : connectAppleHealth
              : connected
                ? syncHealthConnect
                : connectHealthConnect;

            return (
              <View key={provider.id} style={[styles.providerCard, responsive.width >= 720 && styles.providerHalf]}>
                <View style={styles.providerHeader}>
                  <View style={[styles.providerIcon, connected && styles.providerIconConnected]}>
                    <Ionicons name={provider.icon} size={22} color={colors.onSurface} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.providerSubtitle}>{provider.subtitle}</Text>
                  </View>
                  {connected ? (
                    <View style={styles.connectedBadge}>
                      <View style={styles.connectedDot} />
                      <Text style={styles.connectedText}>Подключено</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.metricsWrap}>
                  {provider.metrics.map((metric) => (
                    <View key={metric} style={styles.metricChip}>
                      <Text style={styles.metricText}>{metric}</Text>
                    </View>
                  ))}
                </View>

                {isDirectProvider ? (
                  <>
                    {lastSync ? <Text style={styles.lastSync}>Последняя синхронизация: {lastSync}</Text> : null}
                    {Platform.OS === "web" ? (
                      <Text style={styles.note}>
                        {isApple
                          ? "Apple Health подключается в приложении Aida на iPhone."
                          : "Health Connect подключается в приложении Aida на Android."}
                      </Text>
                    ) : null}
                    {isApple && Platform.OS === "android" ? (
                      <Text style={styles.note}>Для Android используйте Health Connect.</Text>
                    ) : null}
                    {isHealthConnect && Platform.OS === "ios" ? (
                      <Text style={styles.note}>Для iPhone используйте Apple Health.</Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || loadingStatus}
                      onPress={onDirectPress}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        (busy || loadingStatus) && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      {busy || loadingStatus ? (
                        <ActivityIndicator size="small" color={colors.onSurfaceInverse} />
                      ) : (
                        <Ionicons name={connected ? "sync" : "link-outline"} size={17} color={colors.onSurfaceInverse} />
                      )}
                      <Text style={styles.primaryButtonText}>{actionText}</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.pendingRow}>
                    <Ionicons name="key-outline" size={16} color={colors.onSurfaceSecondary} />
                    <Text style={styles.pendingText}>Нужны OAuth / партнёрские доступы провайдера</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleWrap: { flex: 1, paddingTop: 1 },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    color: colors.onSurface,
    fontFamily: fonts.display,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
  },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingTop: spacing.lg, gap: 14 },
  introCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  introTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  introText: { marginTop: 3, fontSize: 12.5, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  messageCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  messageText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: colors.onSurface, fontFamily: fonts.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridStack: { flexDirection: "column", flexWrap: "nowrap" },
  providerCard: {
    minWidth: 0,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    gap: 13,
  },
  providerHalf: { width: "49%", flexGrow: 1, flexBasis: 380 },
  providerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  providerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerIconConnected: { backgroundColor: "#E4F7EA" },
  providerName: { fontSize: 14, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  providerSubtitle: { marginTop: 1, fontSize: 11.5, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: "#E4F7EA" },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  connectedText: { fontSize: 10.5, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  metricsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metricChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surface },
  metricText: { fontSize: 10.5, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  lastSync: { fontSize: 11, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  note: { fontSize: 11.5, lineHeight: 16, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  primaryButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: colors.onSurface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: colors.onSurfaceInverse, fontSize: 12.5, fontWeight: "800", fontFamily: fonts.text },
  disabledButton: { opacity: 0.55 },
  pendingRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.surface },
  pendingText: { flex: 1, fontSize: 11, lineHeight: 15, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  flexOne: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
});
