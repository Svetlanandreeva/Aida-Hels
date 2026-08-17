import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { AuthProvider, useAuth } from "@/src/auth";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useMedicationReminderSync } from "@/src/hooks/use-medication-reminder-sync";
import { useSleepRecommendationSync } from "@/src/hooks/use-sleep-recommendation-sync";
import { I18nProvider } from "@/src/i18n";
import { AppProvider, useApp } from "@/src/store";
import { LogProvider } from "@/src/components/LogProvider";
import { StartupPreview } from "@/src/components/StartupPreview";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SystemUI.setBackgroundColorAsync(colors.surface).catch(() => undefined);

function useNotificationNavigation() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;
    const timer = setTimeout(() => {
      void import("expo-notifications").then((Notifications) => {
        if (cancelled) return;
        const openFromNotification = (notification: any) => {
          const url = notification.request.content.data?.url;
          if (typeof url === "string" && url.startsWith("/")) router.push(url as any);
        };
        const last = Notifications.getLastNotificationResponse();
        if (last?.notification) openFromNotification(last.notification);
        subscription = Notifications.addNotificationResponseReceivedListener((response) => openFromNotification(response.notification));
      });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); subscription?.remove(); };
  }, []);
}

function useDeferredNotificationSetup() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const timer = setTimeout(() => { void import("@/src/notifications"); }, 500);
    return () => clearTimeout(timer);
  }, []);
}

function ProfileGate({ children }: { children: React.ReactNode }) {
  const { activeProfile, loading } = useApp();
  const segments = useSegments();
  useMedicationReminderSync();
  useSleepRecommendationSync();
  useEffect(() => {
    if (loading || !activeProfile) return;
    const route = String(segments[0] || "");
    const inOnboarding = route === "onboarding";
    if (!activeProfile.onboarding_completed && !inOnboarding) router.replace("/onboarding" as any);
    if (activeProfile.onboarding_completed && inOnboarding) router.replace("/(tabs)" as any);
  }, [activeProfile, loading, segments]);
  if (loading) return <StartupPreview />;
  return <>{children}</>;
}

function RoutedApp() {
  const { token, preview, loading } = useAuth();
  const segments = useSegments();
  useNotificationNavigation();
  useDeferredNotificationSetup();
  const hasAppAccess = Boolean(token) || preview;

  useEffect(() => {
    if (loading) return;
    const route = String(segments[0] || "");
    const publicRoute = route === "" || route === "auth" || route === "reset-password";
    if (!hasAppAccess && !publicRoute) router.replace("/auth" as any);
    if (hasAppAccess && (route === "auth" || route === "reset-password")) router.replace("/(tabs)" as any);
  }, [hasAppAccess, loading, segments]);

  if (loading) return <StartupPreview />;

  const stack = (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="report" options={{ presentation: "modal" }} />
      </Stack>
    </View>
  );

  if (!hasAppAccess) return stack;
  return <AppProvider><ProfileGate><LogProvider>{stack}</LogProvider></ProfileGate></AppProvider>;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useEffect(() => { SplashScreen.hideAsync().catch(() => undefined); }, []);
  if (!loaded && !error) return <StartupPreview />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <I18nProvider>
            <AuthProvider>
              <RoutedApp />
            </AuthProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
