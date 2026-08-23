import { Platform } from "react-native";

// Emergent design system: a low-glare clinical canvas with warm editorial type,
// translucent graphite surfaces and a restrained coral/blue data palette.
export const colors = {
  surface: "#09090B",
  onSurface: "#F7F4EF",
  surfaceSecondary: "#151517",
  onSurfaceSecondary: "#A5A2A0",
  surfaceTertiary: "#202023",
  onSurfaceTertiary: "#CBC7C2",
  surfaceInverse: "#F7F4EF",
  onSurfaceInverse: "#111113",

  // glass
  glass: "rgba(24,24,27,0.76)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassStrong: "rgba(31,31,35,0.92)",

  brand: "#F0445B",
  brandPrimary: "#F0445B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3B82F6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#2A171B",
  onBrandTertiary: "#FF9AAA",

  accent: "#F0445B",
  onAccent: "#FFFFFF",

  success: "#4FB286",
  onSuccess: "#07130F",
  warning: "#F2A65A",
  onWarning: "#171006",
  error: "#FF6577",
  onError: "#19080B",
  info: "#5B9BFF",
  onInfo: "#07101E",

  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  divider: "rgba(255,255,255,0.08)",
};

// Gradient palettes for hero cards
export const gradients = {
  warm: ["#351B1F", "#241417", "#171719"] as const,
  warmSoft: ["#2B1B19", "#211719", "#171719"] as const,
  pink: ["#341924", "#25151D", "#171719"] as const,
  lime: ["#20221A", "#1C2118", "#151517"] as const,
  cool: ["#172337", "#171E2A", "#151517"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 10,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 26,
  "3xl": 34,
  "4xl": 46,
};

export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }),
  text: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
};

export const statusColor = (status?: string | null) => {
  switch (status) {
    case "high":
      return colors.warning;
    case "low":
      return colors.info;
    case "normal":
      return colors.success;
    default:
      return colors.onSurfaceSecondary;
  }
};
