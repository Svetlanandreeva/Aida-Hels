import { Platform, useWindowDimensions } from "react-native";

export const layoutBreakpoints = {
  tinyPhone: 340,
  compactPhone: 380,
  phone: 600,
  tablet: 900,
  desktop: 1024,
  wideDesktop: 1360,
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
  const sidebarWidth = isWideDesktop ? 216 : 196;
  const showMobileLabels = width >= 360;
  const mobileTabHeight = isTinyPhone ? 58 : isCompactPhone ? 60 : 64;

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
    sidebarWidth,
    showMobileLabels,
    mobileTabHeight,
  } as const;
};
