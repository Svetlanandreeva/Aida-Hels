import React from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "home", inactive: "home-outline" },
  health: { active: "heart", inactive: "heart-outline" },
  chat: { active: "sparkles", inactive: "sparkles-outline" },
  tasks: { active: "checkbox", inactive: "checkbox-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const routeLabel = (route: any, descriptors: any): string => {
  const options = descriptors?.[route.key]?.options || {};
  return typeof options.tabBarLabel === "string" ? options.tabBarLabel : typeof options.title === "string" ? options.title : route.name;
};

export const ResponsiveTabBar = ({ state, descriptors, navigation, insets }: any) => {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const bottomInset = Platform.OS === "web" ? (desktop ? 14 : 8) : Math.max(insets?.bottom || 0, 8);
  return <View style={[styles.shell, desktop && styles.shellDesktop, { paddingBottom: bottomInset }]}>
    <View style={[styles.inner, desktop && styles.innerDesktop]}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const icon = TAB_ICONS[route.name] || TAB_ICONS.index;
        const label = routeLabel(route, descriptors);
        const options = descriptors?.[route.key]?.options || {};
        return <Pressable key={route.key} accessibilityRole="button" accessibilityState={focused ? { selected: true } : {}} accessibilityLabel={options.tabBarAccessibilityLabel || label} testID={options.tabBarButtonTestID}
          onPress={() => { const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true }); if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params); }}
          onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
          style={({ pressed }) => [styles.item, desktop && styles.itemDesktop, pressed && styles.pressed]}>
          <View style={[styles.iconWrap, focused && styles.iconWrapActive]}><Ionicons name={focused ? icon.active : icon.inactive} size={21} color={focused ? "#1B1B1D" : "#8A8A8E"} /></View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.label, desktop && styles.labelDesktop, focused && styles.labelActive]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
};

const styles = StyleSheet.create({
  shell: { backgroundColor: "#FBFBFA", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DCDCD8", alignItems: "center" },
  shellDesktop: { backgroundColor: "transparent", borderTopWidth: 0, paddingTop: 8 },
  inner: { width: "100%", maxWidth: 430, minHeight: 72, flexDirection: "row", alignItems: "stretch", paddingHorizontal: 4 },
  innerDesktop: { maxWidth: 920, minHeight: 58, backgroundColor: colors.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 12 },
  item: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 5 },
  itemDesktop: { paddingTop: 6, paddingBottom: 6 },
  iconWrap: { width: 36, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: "#EEF2DB" },
  label: { color: "#8A8A8E", fontFamily: fonts.medium, fontSize: 10, lineHeight: 13, textAlign: "center" },
  labelDesktop: { fontSize: 11, lineHeight: 14 },
  labelActive: { color: "#1B1B1D", fontFamily: fonts.bold },
  pressed: { opacity: 0.72 },
});
