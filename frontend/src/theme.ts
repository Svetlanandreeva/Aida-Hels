// Tokens are kept in lockstep with the Emergent reference application.
export const colors = {
  surface: "#050505",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#111111",
  onSurfaceSecondary: "#8E8E93",
  surfaceTertiary: "#1C1C1E",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#050505",

  // glass
  glass: "rgba(17,17,17,0.82)",
  glassBorder: "#38383A",
  glassStrong: "rgba(28,28,30,0.94)",

  brand: "#FF2D55",
  brandPrimary: "#FF2D55",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3A000A",
  onBrandSecondary: "#FFB3C1",
  brandTertiary: "#3A000A",
  onBrandTertiary: "#FFB3C1",

  accent: "#FF2D55",
  onAccent: "#FFFFFF",

  success: "#30D158",
  onSuccess: "#FFFFFF",
  warning: "#FF9F0A",
  onWarning: "#FFFFFF",
  error: "#FF453A",
  onError: "#FFFFFF",
  info: "#0A84FF",
  onInfo: "#FFFFFF",

  border: "#38383A",
  borderStrong: "#48484A",
  divider: "#38383A",
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
  sm: 8,
  md: 16,
  lg: 24,
  xl: 24,
  pill: 999,
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

export const fonts = {
  regular: "Manrope-Regular",
  display: "Manrope-ExtraBold",
  text: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
};

export const CONTENT_MAX = 720;
export const FORM_MAX = 460;

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
