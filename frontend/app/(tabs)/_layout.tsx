import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { ResponsiveTabBar } from "@/src/components/ResponsiveTabBar";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";

const PRIMARY_TABS = new Set(["index", "mind", "pressure", "body", "labs", "chat", "tasks"]);

export default function TabsLayout() {
  const { lang } = useI18n();
  const responsive = useResponsiveLayout();

  return (
    <Tabs
      detachInactiveScreens
      tabBar={(props) => {
        const visibleRoutes = props.state.routes.filter((route) => PRIMARY_TABS.has(route.name));
        const activeName = props.state.routes[props.state.index]?.name;
        const visibleIndex = Math.max(0, visibleRoutes.findIndex((route) => route.name === activeName));
        return <ResponsiveTabBar {...props} state={{ ...props.state, routes: visibleRoutes, index: visibleIndex }} />;
      }}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
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
      <Tabs.Screen name="index" options={{ title: lang === "ru" ? "Главная" : "Home" }} />
      <Tabs.Screen name="mind" options={{ title: lang === "ru" ? "Психика" : "Mind" }} />
      <Tabs.Screen name="pressure" options={{ title: lang === "ru" ? "Давление" : "Pressure" }} />
      <Tabs.Screen name="body" options={{ title: lang === "ru" ? "Организм" : "Body" }} />
      <Tabs.Screen name="labs" options={{ title: lang === "ru" ? "Анализы" : "Labs" }} />
      <Tabs.Screen name="chat" options={{ title: lang === "ru" ? "Аида" : "Aida" }} />
      <Tabs.Screen name="tasks" options={{ title: lang === "ru" ? "Задачи" : "Tasks" }} />
      <Tabs.Screen name="health" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
