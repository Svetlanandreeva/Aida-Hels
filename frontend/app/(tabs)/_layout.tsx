import React, { useCallback, useState } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { ResponsiveTabBar } from "@/src/components/ResponsiveTabBar";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { useApp } from "@/src/store";
import { getModuleConfig } from "@/src/moduleConfigApi";
import { getPetGame } from "@/src/gameApi";

const PRIMARY_TAB_MODULES: Record<string, string | null> = {
  index: null,
  mind: "mental",
  pressure: "pressure",
  body: "body",
  labs: "labs",
  chat: null,
  tasks: "tasks",
};

export default function TabsLayout() {
  const { lang } = useI18n();
  const responsive = useResponsiveLayout();
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
    if (!(name in PRIMARY_TAB_MODULES)) return false;
    const moduleCode = PRIMARY_TAB_MODULES[name];
    return moduleCode === null || enabledModules === null || enabledModules.has(moduleCode);
  };

  return (
    <Tabs
      detachInactiveScreens
      tabBar={(props) => {
        const visibleRoutes = props.state.routes.filter((route) => routeVisible(route.name));
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
      <Tabs.Screen name="companion" options={{ title: lang === "ru" ? "Питомец" : "Pet" }} />
      <Tabs.Screen name="health" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
