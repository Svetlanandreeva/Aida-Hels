import { Stack, router, useSegments } from "expo-router";
import { lazy, Suspense, useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/src/auth";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { I18nProvider } from "@/src/i18n";
import { AppProvider, useApp } from "@/src/store";
import { KeyboardRoot } from "@/src/components/KeyboardRoot";
import { StartupPreview } from "@/src/components/StartupPreview";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

if (Platform.OS !== "web") {
  void import("expo-splash-screen")
    .then((SplashScreen) => SplashScreen.preventAutoHideAsync())
    .catch(() => undefined);
  void import("expo-system-ui")
    .then((SystemUI) => SystemUI.setBackgroundColorAsync(colors.surface))
    .catch(() => undefined);
}

const PUBLIC_ROUTES = new Set(["", "auth", "register", "reset-password", "terms", "privacy-policy"]);

const DeferredLogProvider = lazy(async () => {
  await import("@/src/lab-runtime-compat");
  const module = await import("@/src/components/LogProvider");
  return { default: module.LogProvider };
});

const DeferredAuthenticatedSyncRuntime = lazy(async () => {
  const module = await import("@/src/components/AuthenticatedSyncRuntime");
  return { default: module.AuthenticatedSyncRuntime };
});

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
  useEffect(() => {
    const route = String(segments[0] || "");
    if (PUBLIC_ROUTES.has(route) || loading || !activeProfile) return;
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
  const route = String(segments[0] || "");
  const publicRoute = PUBLIC_ROUTES.has(route);

  useEffect(() => {
    if (loading) return;
    if (!hasAppAccess && !publicRoute) router.replace("/auth" as any);
    if (hasAppAccess && (route === "auth" || route === "register" || route === "reset-password")) router.replace("/(tabs)" as any);
  }, [hasAppAccess, loading, publicRoute, route]);

  const stack = (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="register" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="report" options={{ presentation: "modal" }} />
      </Stack>
    </View>
  );

  if (publicRoute) return stack;
  if (loading) return <StartupPreview />;
  if (!hasAppAccess) return stack;
  return (
    <AppProvider>
      <ProfileGate>
        <Suspense fallback={null}>
          <DeferredAuthenticatedSyncRuntime />
        </Suspense>
        <Suspense fallback={<StartupPreview />}>
          <DeferredLogProvider>{stack}</DeferredLogProvider>
        </Suspense>
      </ProfileGate>
    </AppProvider>
  );
}

export default function RootLayout() {
  useIconFonts();
  useEffect(() => {
    if (Platform.OS === "web") return;
    void import("expo-splash-screen")
      .then((SplashScreen) => SplashScreen.hideAsync())
      .catch(() => undefined);
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardRoot>
        <SafeAreaProvider>
          <I18nProvider>
            <AuthProvider>
              <RoutedApp />
            </AuthProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </KeyboardRoot>
    </GestureHandlerRootView>
  );
}
