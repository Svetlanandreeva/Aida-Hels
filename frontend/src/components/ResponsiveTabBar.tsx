import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "home", inactive: "home-outline" },
  mind: { active: "happy", inactive: "happy-outline" },
  pressure: { active: "pulse", inactive: "pulse-outline" },
  body: { active: "body", inactive: "body-outline" },
  labs: { active: "flask", inactive: "flask-outline" },
  chat: { active: "sparkles", inactive: "sparkles-outline" },
  tasks: { active: "checkbox", inactive: "checkbox-outline" },
  companion: { active: "paw", inactive: "paw-outline" },
};

const routeLabel = (route: any, descriptors: any): string => {
  const options = descriptors?.[route.key]?.options || {};
  return typeof options.tabBarLabel === "string" ? options.tabBarLabel : typeof options.title === "string" ? options.title : route.name;
};

export const ResponsiveTabBar = ({ state, descriptors, navigation, insets }: any) => {
  const bottomInset = Platform.OS === "web" ? 8 : Math.max(insets?.bottom || 0, 8);
  return (
    <View style={[styles.shell, { paddingBottom: bottomInset }]}>
      <View style={styles.inner}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const icon = TAB_ICONS[route.name] || TAB_ICONS.index;
          const label = routeLabel(route, descriptors);
          const options = descriptors?.[route.key]?.options || {};
          return (
            <Pressable key={route.key} accessibilityRole="button" accessibilityState={focused ? { selected: true } : {}} accessibilityLabel={options.tabBarAccessibilityLabel || label} testID={options.tabBarButtonTestID}
              onPress={() => { const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true }); if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params); }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <Ionicons name={focused ? icon.active : icon.inactive} size={21} color={focused ? colors.brand : colors.onSurfaceSecondary} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: { backgroundColor: colors.surfaceSecondary, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border, alignItems: "center" },
  inner: { width: "100%", maxWidth: 720, minHeight: 66, flexDirection: "row", alignItems: "stretch", paddingHorizontal: 4 },
  item: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 10, lineHeight: 13, textAlign: "center" },
  labelActive: { color: colors.brand, fontFamily: fonts.bold },
  pressed: { opacity: 0.72 },
});
