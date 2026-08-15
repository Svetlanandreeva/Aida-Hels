import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { ResponsiveTabBar } from "@/src/components/ResponsiveTabBar";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";

export default function TabsLayout() {
  const { t } = useI18n();
  const responsive = useResponsiveLayout();

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: responsive.isDesktop ? "left" : "bottom",
        tabBarHideOnKeyboard: true,
        sceneStyle: responsive.isDesktop
          ? {
              flex: 1,
              minWidth: 0,
              width: "100%",
              maxWidth: 1360,
              alignSelf: "center",
              backgroundColor: colors.surface,
            }
          : {
              flex: 1,
              minWidth: 0,
              width: "100%",
              backgroundColor: colors.surface,
            },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tab_home") }} />
      <Tabs.Screen name="health" options={{ title: t("tab_health") }} />
      <Tabs.Screen name="chat" options={{ title: t("tab_chat") }} />
      <Tabs.Screen name="tasks" options={{ title: t("tab_tasks") }} />
      <Tabs.Screen name="profile" options={{ title: t("tab_profile") }} />
    </Tabs>
  );
}
