import React from "react";
import { Platform, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/src/theme";
import { useI18n } from "@/src/i18n";

export default function TabsLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // A normal mobile browser already shrinks its visual viewport around browser chrome.
  // Adding an extra synthetic safe-area on web lifts the tab bar too high, so only
  // native builds use the device safe-area inset.
  const isWeb = Platform.OS === "web";
  const compact = width < 390;
  const safeBottom = isWeb ? 0 : Math.max(insets.bottom, 8);
  const baseHeight = compact ? 62 : 66;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: baseHeight + safeBottom,
          paddingBottom: safeBottom,
          paddingTop: compact ? 5 : 7,
        },
        tabBarItemStyle: {
          minWidth: 0,
          paddingHorizontal: 0,
          paddingTop: 1,
          paddingBottom: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarLabelStyle: {
          fontSize: compact ? 10 : 11,
          lineHeight: compact ? 13 : 15,
          fontWeight: "600",
          fontFamily: fonts.text,
          marginTop: 1,
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={compact ? 21 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t("tab_health"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={compact ? 21 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("tab_chat"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={compact ? 21 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("tab_tasks"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "checkbox" : "checkbox-outline"} size={compact ? 21 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={compact ? 21 : 23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
