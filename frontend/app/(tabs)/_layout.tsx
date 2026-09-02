import React, { useCallback, useState } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { ResponsiveTabBar } from "@/src/components/ResponsiveTabBar";
import { useApp } from "@/src/store";
import { getModuleConfig } from "@/src/moduleConfigApi";
import { getPetGame } from "@/src/gameApi";
import { HealthProvider } from "@/src/emergent/health-context";
import { AddSheetProvider } from "@/src/emergent/AddSheet";

const PRIMARY_TABS = new Set(["index", "health", "chat", "tasks", "profile"]);

// Keep server-controlled module gates even though medical modules are now
// detail routes under the five-tab Figma information architecture.
const MODULE_GATES: Record<string, string | null> = {
  index: null,
  health: null,
  chat: null,
  profile: null,
  mind: "mental",
  pressure: "pressure",
  body: "body",
  labs: "labs",
  tasks: "tasks",
};

export default function TabsLayout() {
  const { lang } = useI18n();
  const { activeId, refreshTick } = useApp();
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null);
  const [petUnlocked, setPetUnlocked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!activeId || activeId === "preview-profile") {
        setEnabledModules(null);
        setPetUnlocked(false);
        return () => { cancelled = true; };
      }

      void getModuleConfig(activeId)
        .then((response) => {
          if (cancelled) return;
          setEnabledModules(new Set((response.modules || []).filter((module) => module.enabled).map((module) => module.module_code)));
        })
        .catch(() => {
          if (!cancelled) setEnabledModules(null);
        });

      void getPetGame(activeId)
        .then((game) => {
          if (!cancelled) setPetUnlocked(Boolean(game.pet.claimed || game.pet.claim_available || Number(game.level) >= 2));
        })
        .catch(() => {
          if (!cancelled) setPetUnlocked(false);
        });

      return () => { cancelled = true; };
    }, [activeId, refreshTick]),
  );

  const routeVisible = (name: string) => {
    if (name === "companion") return petUnlocked;
    const moduleCode = MODULE_GATES[name];
    return moduleCode == null || enabledModules === null || enabledModules.has(moduleCode);
  };

  return (
    <HealthProvider>
      <AddSheetProvider>
        <Tabs
          detachInactiveScreens
          tabBar={(props) => {
            const visibleRoutes = props.state.routes.filter((route) => PRIMARY_TABS.has(route.name) && routeVisible(route.name));
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
