import { Platform, useWindowDimensions } from "react-native";

// Shared breakpoints keep navigation and primary screens responsive to the same viewport rules.
export const layoutBreakpoints = {
  tinyPhone: 340,
  compactPhone: 380,
  phone: 600,
  tablet: 900,
  desktop: 1024,
  wideDesktop: 1360,
} as const;

export const layoutMetrics = {
  overlayMaxWidth: 640,
} as const;

export const useResponsiveLayout = () => {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isTinyPhone = width < layoutBreakpoints.tinyPhone;
  const isCompactPhone = width < layoutBreakpoints.compactPhone;
  const isPhone = width < layoutBreakpoints.phone;
  const isTablet = width >= layoutBreakpoints.phone && width < layoutBreakpoints.desktop;
  const isDesktop = isWeb && width >= layoutBreakpoints.desktop;
  const isWideDesktop = isDesktop && width >= layoutBreakpoints.wideDesktop;

  const contentPadding = isTinyPhone ? 10 : isCompactPhone ? 12 : isPhone ? 16 : isTablet ? 20 : 24;
  const sidebarRailWidth = isWideDesktop ? 68 : 64;
  const sidebarPanelWidth = isWideDesktop ? 176 : 164;
  const sidebarWidth = sidebarRailWidth + sidebarPanelWidth;
  const showMobileLabels = width >= 360;
  const mobileTabHeight = isTinyPhone ? 58 : isCompactPhone ? 60 : 64;
  const overlayWidth = isPhone
    ? width
    : Math.min(Math.max(0, width - contentPadding * 2), layoutMetrics.overlayMaxWidth);

  return {
    width,
    height,
    isWeb,
    isTinyPhone,
    isCompactPhone,
    isPhone,
    isTablet,
    isDesktop,
    isWideDesktop,
    contentPadding,
    sidebarRailWidth,
    sidebarPanelWidth,
    sidebarWidth,
    showMobileLabels,
    mobileTabHeight,
    overlayWidth,
  } as const;
};
