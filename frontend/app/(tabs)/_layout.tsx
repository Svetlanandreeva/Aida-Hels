import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { ResponsiveTabBar } from "@/src/components/ResponsiveTabBar";
import { HealthProvider } from "@/src/emergent/health-context";
import { AddSheetProvider } from "@/src/emergent/AddSheet";

const PRIMARY_TABS = new Set(["index", "health", "chat", "tasks", "profile"]);

export default function TabsLayout() {
  const { lang } = useI18n();
  return (
    <HealthProvider>
      <AddSheetProvider>
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
            tabBarPosition: "bottom",
            tabBarHideOnKeyboard: true,
            sceneStyle: { flex: 1, minWidth: 0, width: "100%", backgroundColor: colors.surface },
          }}
        >
          <Tabs.Screen name="index" options={{ title: lang === "ru" ? "Главная" : "Home" }} />
          <Tabs.Screen name="health" options={{ title: lang === "ru" ? "Здоровье" : "Health" }} />
          <Tabs.Screen name="chat" options={{ title: lang === "ru" ? "Аида" : "Aida" }} />
          <Tabs.Screen name="tasks" options={{ title: lang === "ru" ? "Задачи" : "Tasks" }} />
          <Tabs.Screen name="profile" options={{ title: lang === "ru" ? "Профиль" : "Profile" }} />

          <Tabs.Screen name="mind" options={{ href: null }} />
          <Tabs.Screen name="pressure" options={{ href: null }} />
          <Tabs.Screen name="body" options={{ href: null }} />
          <Tabs.Screen name="labs" options={{ href: null }} />
          <Tabs.Screen name="companion" options={{ href: null }} />
        </Tabs>
      </AddSheetProvider>
    </HealthProvider>
  );
}
