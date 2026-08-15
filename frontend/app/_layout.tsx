import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { I18nProvider } from "@/src/i18n";
import { AppProvider } from "@/src/store";
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
          if (typeof url === "string" && url.startsWith("/")) {
            router.push(url as any);
          }
        };

        const last = Notifications.getLastNotificationResponse();
        if (last?.notification) openFromNotification(last.notification);

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          openFromNotification(response.notification);
        });
      });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.remove();
    };
  }, []);
}

function useDeferredNotificationSetup() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    const timer = setTimeout(() => {
      void import("@/src/notifications");
    }, 500);

    return () => clearTimeout(timer);
  }, []);
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useNotificationNavigation();
  useDeferredNotificationSetup();

  useEffect(() => {
    // Reveal our own lightweight branded preview immediately instead of
    // leaving the user staring at a blank native splash while fonts resolve.
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!loaded && !error) return <StartupPreview />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <I18nProvider>
            <AppProvider>
              <LogProvider>
                <View style={{ flex: 1, backgroundColor: colors.surface }}>
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="report" options={{ presentation: "modal" }} />
                  </Stack>
                </View>
              </LogProvider>
            </AppProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
