import { Platform } from "react-native";

// Modern airy longevity aesthetic: light neutral canvas, frosted glass cards,
// warm orange→coral→pink gradient heroes, neon lime accent, large clean type.
export const colors = {
  surface: "#EAEAE8",
  onSurface: "#1B1B1D",
  surfaceSecondary: "#FBFBFA",
  onSurfaceSecondary: "#8A8A8E",
  surfaceTertiary: "#E1E1DE",
  onSurfaceTertiary: "#6E6E72",
  surfaceInverse: "#1B1B1D",
  onSurfaceInverse: "#FBFBFA",

  // glass
  glass: "rgba(255,255,255,0.55)",
  glassBorder: "rgba(255,255,255,0.75)",
  glassStrong: "rgba(255,255,255,0.72)",

  brand: "#1B1B1D",
  brandPrimary: "#1B1B1D",
  onBrandPrimary: "#FBFBFA",
  brandSecondary: "#CFF24A",
  onBrandSecondary: "#1B1B1D",
  brandTertiary: "#EFEFEC",
  onBrandTertiary: "#1B1B1D",

  // neon lime accent
  accent: "#CFF24A",
  onAccent: "#1B1B1D",

  success: "#4BAF7E",
  onSuccess: "#FBFBFA",
  warning: "#F0913E",
  onWarning: "#FBFBFA",
  error: "#EF6B5E",
  onError: "#FBFBFA",
  info: "#7DA0C4",
  onInfo: "#FBFBFA",

  border: "rgba(27,27,29,0.06)",
  borderStrong: "rgba(27,27,29,0.14)",
  divider: "rgba(27,27,29,0.06)",
};

// Gradient palettes for hero cards
export const gradients = {
  warm: ["#F6D8B0", "#F79C7E", "#EE8BB3"] as const, // biological-age style
  warmSoft: ["#FBE3CE", "#F7B79C", "#F0A7C4"] as const,
  pink: ["#FBD6E4", "#F6A8C9", "#F18FB6"] as const,
  lime: ["#E7F7A6", "#CFF24A", "#B9E22E"] as const,
  cool: ["#DCE7F5", "#C4D4EE", "#D9CDEB"] as const,
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
  display: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
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
