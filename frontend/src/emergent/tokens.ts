// Design tokens for Aida — derived from design_guidelines.json

export const palette = {
  light: {
    surface: "#F5F5F7",
    onSurface: "#000000",
    surfaceSecondary: "#FFFFFF",
    onSurfaceSecondary: "#1D1D1F",
    surfaceTertiary: "#EAEAEB",
    onSurfaceTertiary: "#3A3A3C",
    surfaceInverse: "#000000",
    onSurfaceInverse: "#FFFFFF",
    brand: "#E60023",
    brandPrimary: "#E60023",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#FFEBEE",
    onBrandSecondary: "#D30020",
    brandTertiary: "#F2F2F7",
    onBrandTertiary: "#E60023",
    success: "#34C759",
    warning: "#FF9F0A",
    error: "#FF3B30",
    info: "#007AFF",
    border: "#E5E5EA",
    borderStrong: "#C7C7CC",
    divider: "#E5E5EA",
    muted: "#8A8A8E",
    glassTint: "light" as const,
    heroGlow: "rgba(230,0,35,0.12)",
  },
  dark: {
    surface: "#050505",
    onSurface: "#FFFFFF",
    surfaceSecondary: "#111111",
    onSurfaceSecondary: "#EBEBF5",
    surfaceTertiary: "#1C1C1E",
    onSurfaceTertiary: "#EBEBF5",
    surfaceInverse: "#FFFFFF",
    onSurfaceInverse: "#000000",
    brand: "#FF2D55",
    brandPrimary: "#FF2D55",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#3A000A",
    onBrandSecondary: "#FF4A6A",
    brandTertiary: "#1C1C1E",
    onBrandTertiary: "#FF2D55",
    success: "#30D158",
    warning: "#FF9F0A",
    error: "#FF453A",
    info: "#0A84FF",
    border: "#38383A",
    borderStrong: "#48484A",
    divider: "#38383A",
    muted: "#8E8E93",
    glassTint: "dark" as const,
    heroGlow: "rgba(255,45,85,0.18)",
  },
};

export type ThemeColors = (typeof palette)[keyof typeof palette];

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
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

export const font = {
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
};

// Responsive layout caps — keep content readable & centered on wide screens
// (desktop / tablet / mobile web) while staying full-width on phones.
export const CONTENT_MAX = 720;
export const FORM_MAX = 460;

