import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "grid", inactive: "grid-outline" },
  health: { active: "heart", inactive: "heart-outline" },
  chat: { active: "sparkles", inactive: "sparkles-outline" },
  tasks: { active: "checkbox", inactive: "checkbox-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const routeLabel = (route: any, descriptors: any): string => {
  const options = descriptors?.[route.key]?.options || {};
  if (typeof options.tabBarLabel === "string") return options.tabBarLabel;
  if (typeof options.title === "string") return options.title;
  return route.name;
};

export const ResponsiveTabBar = ({ state, descriptors, navigation, insets }: any) => {
  const responsive = useResponsiveLayout();
  const nativeBottomInset = Platform.OS === "web" ? 0 : Math.max(insets?.bottom || 0, 8);

  const openRoute = (route: any, focused: boolean) => {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const longPressRoute = (route: any) => {
    navigation.emit({ type: "tabLongPress", target: route.key });
  };

  if (responsive.isDesktop) {
    return (
      <View
        style={[
          styles.sidebar,
          {
            width: responsive.sidebarWidth,
            paddingTop: Math.max(insets?.top || 0, 14),
            paddingBottom: Math.max(insets?.bottom || 0, 14),
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Ionicons name="sparkles" size={17} color={colors.onSurfaceInverse} />
          </View>
          <Text style={styles.brandText}>Аида</Text>
        </View>

        <View style={styles.desktopItems}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const meta = TAB_ICONS[route.name] || TAB_ICONS.index;
            const label = routeLabel(route, descriptors);
            const options = descriptors?.[route.key]?.options || {};

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={() => openRoute(route, focused)}
                onLongPress={() => longPressRoute(route)}
                style={({ pressed }) => [
                  styles.desktopItem,
                  focused && styles.desktopItemActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.desktopIcon, focused && styles.desktopIconActive]}>
                  <Ionicons
                    name={focused ? meta.active : meta.inactive}
                    size={19}
                    color={focused ? colors.onSurfaceInverse : colors.onSurfaceSecondary}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.desktopLabel, focused && styles.desktopLabelActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sidebarSpacer} />
        <View style={styles.sidebarFooter}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>aidaassistent.ru</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bottomBar,
        {
          height: responsive.mobileTabHeight + nativeBottomInset,
          paddingBottom: nativeBottomInset,
        },
      ]}
    >
      <View style={[styles.bottomInner, responsive.isTablet && styles.bottomInnerTablet]}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const meta = TAB_ICONS[route.name] || TAB_ICONS.index;
          const label = routeLabel(route, descriptors);
          const options = descriptors?.[route.key]?.options || {};

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={() => openRoute(route, focused)}
              onLongPress={() => longPressRoute(route)}
              style={({ pressed }) => [
                styles.mobileItem,
                responsive.isTinyPhone && styles.mobileItemTiny,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={focused ? meta.active : meta.inactive}
                size={responsive.isTinyPhone ? 21 : 22}
                color={focused ? colors.onSurface : colors.onSurfaceSecondary}
              />
              {responsive.showMobileLabels ? (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  style={[
                    styles.mobileLabel,
                    responsive.isCompactPhone && styles.mobileLabelCompact,
                    focused && styles.mobileLabelActive,
                  ]}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 10,
  },
  brandRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.onSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.onSurface,
    fontFamily: fonts.display,
    letterSpacing: -0.3,
  },
  desktopItems: { gap: 5 },
  desktopItem: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "transparent",
  },
  desktopItemActive: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  desktopIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  desktopIconActive: { backgroundColor: colors.onSurface },
  desktopLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
  },
  desktopLabelActive: { color: colors.onSurface, fontWeight: "700" },
  sidebarSpacer: { flex: 1 },
  sidebarFooter: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  footerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  footerText: { fontSize: 11, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  bottomBar: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 5,
    paddingHorizontal: 4,
  },
  bottomInner: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "stretch",
  },
  bottomInnerTablet: { maxWidth: 720 },
  mobileItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  mobileItemTiny: { minHeight: 46 },
  mobileLabel: {
    maxWidth: "100%",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
    textAlign: "center",
  },
  mobileLabelCompact: { fontSize: 9.5, lineHeight: 12 },
  mobileLabelActive: { color: colors.onSurface, fontWeight: "700" },
  pressed: { opacity: 0.65 },
});
