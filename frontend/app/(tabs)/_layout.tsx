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

  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && width >= 1024;
  const compact = width < 390;
  const safeBottom = isWeb ? 0 : Math.max(insets.bottom, 8);
  const baseHeight = compact ? 62 : 66;
  const iconSize = isDesktop ? 22 : compact ? 21 : 23;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? "left" : "bottom",
        tabBarLabelPosition: isDesktop ? "beside-icon" : "below-icon",
        tabBarActiveTintColor: isDesktop ? colors.brand : colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarActiveBackgroundColor: isDesktop ? colors.brandTertiary : undefined,
        tabBarHideOnKeyboard: true,
        sceneStyle: isDesktop
          ? {
              backgroundColor: colors.surface,
              width: "100%",
              maxWidth: 1440,
              alignSelf: "center",
            }
          : { backgroundColor: colors.surface },
        tabBarStyle: isDesktop
          ? {
              width: 236,
              backgroundColor: colors.surfaceSecondary,
              borderRightColor: colors.border,
              borderRightWidth: 1,
              borderTopWidth: 0,
              paddingTop: 28,
              paddingBottom: 28,
              paddingHorizontal: 12,
            }
          : {
              backgroundColor: colors.surfaceSecondary,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: baseHeight + safeBottom,
              paddingBottom: safeBottom,
              paddingTop: compact ? 5 : 7,
            },
        tabBarItemStyle: isDesktop
          ? {
              minHeight: 52,
              borderRadius: 14,
              marginVertical: 4,
              paddingHorizontal: 14,
            }
          : {
              minWidth: 0,
              paddingHorizontal: 0,
              paddingTop: 1,
              paddingBottom: 1,
            },
        tabBarIconStyle: isDesktop
          ? {
              width: 30,
              marginHorizontal: 0,
            }
          : {
              marginTop: 0,
            },
        tabBarLabelStyle: isDesktop
          ? {
              fontSize: 14,
              lineHeight: 18,
              fontWeight: "700",
              fontFamily: fonts.text,
              marginLeft: 8,
              textAlign: "left",
            }
          : {
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
            <Ionicons name={focused ? "grid" : "grid-outline"} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t("tab_health"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("tab_chat"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("tab_tasks"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "checkbox" : "checkbox-outline"} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={iconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
