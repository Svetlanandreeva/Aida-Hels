import React, { useState } from "react";
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
  const [desktopExpanded, setDesktopExpanded] = useState(true);
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
    const shellWidth = desktopExpanded ? responsive.sidebarWidth : responsive.sidebarRailWidth;

    return (
      <View
        style={[
          styles.sidebarShell,
          {
            width: shellWidth,
            paddingTop: Math.max(insets?.top || 0, 12),
            paddingBottom: Math.max(insets?.bottom || 0, 12),
          },
        ]}
      >
        <View style={[styles.iconRail, { width: responsive.sidebarRailWidth }]}>
          <View style={styles.railBrandArea}>
            <View style={styles.brandMark}>
              <Ionicons name="sparkles" size={17} color={colors.onSurfaceInverse} />
            </View>
            {!desktopExpanded ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Развернуть меню"
                onPress={() => setDesktopExpanded(true)}
                style={({ pressed }) => [styles.railToggle, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-forward" size={15} color={colors.onSurfaceSecondary} />
              </Pressable>
            ) : null}
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
                  accessibilityLabel={options.tabBarAccessibilityLabel || label}
                  testID={options.tabBarButtonTestID}
                  onPress={() => openRoute(route, focused)}
                  onLongPress={() => longPressRoute(route)}
                  style={({ pressed }) => [
                    styles.railItem,
                    focused && styles.railItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={focused ? meta.active : meta.inactive}
                    size={19}
                    color={focused ? colors.onSurfaceInverse : colors.onSurfaceSecondary}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sidebarSpacer} />
          <View style={styles.railStatusDot} />
        </View>

        {desktopExpanded ? (
          <View style={[styles.labelPanel, { width: responsive.sidebarPanelWidth }]}>
            <View style={styles.panelBrandRow}>
              <Text style={styles.brandText}>Аида</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Свернуть меню"
                onPress={() => setDesktopExpanded(false)}
                style={({ pressed }) => [styles.panelToggle, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={15} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <View style={styles.desktopItems}>
              {state.routes.map((route: any, index: number) => {
                const focused = state.index === index;
                const label = routeLabel(route, descriptors);
                const options = descriptors?.[route.key]?.options || {};

                return (
                  <Pressable
                    key={route.key}
                    accessibilityRole="button"
                    accessibilityState={focused ? { selected: true } : {}}
                    accessibilityLabel={options.tabBarAccessibilityLabel || label}
                    onPress={() => openRoute(route, focused)}
                    onLongPress={() => longPressRoute(route)}
                    style={({ pressed }) => [
                      styles.panelItem,
                      focused && styles.panelItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
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
              <Text style={styles.footerText}>aidaassistent.ru</Text>
            </View>
          </View>
        ) : null}
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
  sidebarShell: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  iconRail: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  railBrandArea: {
    minHeight: 54,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 4,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: colors.onSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  railToggle: {
    width: 24,
    height: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  labelPanel: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 9,
    backgroundColor: colors.surfaceSecondary,
  },
  panelBrandRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  panelToggle: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
  desktopItems: { gap: 6 },
  railItem: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  railItemActive: {
    backgroundColor: colors.onSurface,
    borderColor: colors.onSurface,
  },
  panelItem: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  panelItemActive: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
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
  railStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginBottom: 12,
  },
  sidebarFooter: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
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
