import { Stack, router, useSegments } from "expo-router";
import { lazy, Suspense, useEffect, useRef } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { withTimeout } from "@/src/async";
import { getPetGame } from "@/src/gameApi";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { I18nProvider } from "@/src/i18n";
import { AppProvider, useApp } from "@/src/store";
import { KeyboardRoot } from "@/src/components/KeyboardRoot";
import { StartupPreview } from "@/src/components/StartupPreview";
import { storage } from "@/src/utils/storage";
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
const ONBOARDING_ROUTES = new Set(["onboarding", "onboarding-medical", "onboarding-lifestyle", "onboarding-medications"]);
const MEDICATION_TIME_PROMPT_PREFIX = "aida.medicationTimePrompt.v1.";

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

function MedicationTimePromptGate() {
  const { activeId, activeProfile, loading } = useApp();
  const segments = useSegments();

  useEffect(() => {
    const route = String(segments[0] || "");
    if (loading || !activeId || !activeProfile?.onboarding_completed) return;
    if (route === "medication-time-setup" || PUBLIC_ROUTES.has(route)) return;

    let cancelled = false;
    void (async () => {
      const key = `${MEDICATION_TIME_PROMPT_PREFIX}${activeId}`;
      const alreadyPrompted = await storage.getItem<string>(key, "").catch(() => "");
      if (cancelled || alreadyPrompted) return;
      try {
        const medications = await withTimeout(api.listMeds(activeId), 2500, "medication_time_prompt");
        if (cancelled) return;
        const missing = medications.some((med) => med.active && !(med.times || []).length);
        await storage.setItem(key, "1").catch(() => undefined);
        if (missing && !cancelled) router.replace("/medication-time-setup" as any);
      } catch {
        // A slow/offline medication request must never block entering Aida.
        // Home still keeps the persistent missing-time warning once data loads.
      }
    })();
    return () => { cancelled = true; };
  }, [activeId, activeProfile?.onboarding_completed, loading, segments]);

  return null;
}

function PetUnlockGate() {
  const { activeId, activeProfile, loading, refreshTick } = useApp();
  const segments = useSegments();
  const redirectedProfile = useRef<string | null>(null);

  useEffect(() => {
    const route = String(segments[0] || "");
    if (loading || !activeId || activeId === "preview-profile" || !activeProfile?.onboarding_completed) return;
    if (route === "pet" || PUBLIC_ROUTES.has(route) || ONBOARDING_ROUTES.has(route)) return;
    if (redirectedProfile.current === activeId) return;

    let cancelled = false;
    void getPetGame(activeId)
      .then((game) => {
        if (cancelled || !game.pet.claim_available || game.pet.claimed) return;
        redirectedProfile.current = activeId;
        router.push("/pet" as any);
      })
      .catch(() => {
        // Gamification must never block the health app when it is offline.
      });

    return () => { cancelled = true; };
  }, [activeId, activeProfile?.onboarding_completed, loading, refreshTick, segments]);

  return null;
}

function ProfileGate({ children }: { children: React.ReactNode }) {
  const { activeProfile, loading } = useApp();
  const segments = useSegments();
  useEffect(() => {
    const route = String(segments[0] || "");
    if (PUBLIC_ROUTES.has(route) || loading || !activeProfile) return;
    const inOnboarding = ONBOARDING_ROUTES.has(route);
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
    if (hasAppAccess && route === "") router.replace("/(tabs)" as any);
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
        <Stack.Screen name="onboarding-medical" />
        <Stack.Screen name="onboarding-lifestyle" />
        <Stack.Screen name="onboarding-medications" />
        <Stack.Screen name="medication-time-setup" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="pet" />
        <Stack.Screen name="report" options={{ presentation: "modal" }} />
      </Stack>
    </View>
  );

  if (publicRoute && !hasAppAccess) return stack;
  if (loading) return <StartupPreview />;
  if (!hasAppAccess) return stack;
  return (
    <AppProvider>
      <MedicationTimePromptGate />
      <PetUnlockGate />
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
