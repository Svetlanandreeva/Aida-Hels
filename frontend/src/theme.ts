// Shared product tokens aligned with the approved Figma mobile light system.
export const colors = {
  surface: "#EAEAE8",
  onSurface: "#1B1B1D",
  surfaceSecondary: "#FBFBFA",
  onSurfaceSecondary: "#8A8A8E",
  surfaceTertiary: "#F2F2EF",
  onSurfaceTertiary: "#1B1B1D",
  surfaceInverse: "#1B1B1D",
  onSurfaceInverse: "#FFFFFF",

  // light glass / elevated surfaces
  glass: "rgba(251,251,250,0.86)",
  glassBorder: "#DCDCD8",
  glassStrong: "rgba(251,251,250,0.96)",

  brand: "#FF315B",
  brandPrimary: "#FF315B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F6A8C9",
  onBrandSecondary: "#1B1B1D",
  brandTertiary: "#E7F7A6",
  onBrandTertiary: "#1B1B1D",

  accent: "#CFF24A",
  onAccent: "#1B1B1D",

  success: "#4EBB8B",
  onSuccess: "#FFFFFF",
  warning: "#F39A3A",
  onWarning: "#1B1B1D",
  error: "#D63A52",
  onError: "#FFFFFF",
  info: "#7D91D9",
  onInfo: "#FFFFFF",

  border: "#DCDCD8",
  borderStrong: "#CBCBC6",
  divider: "#DCDCD8",
};

// Gradient palettes mirror the Figma mobile cards.
export const gradients = {
  warm: ["#F6D8B0", "#F79C7E", "#EE8BB3"] as const,
  warmSoft: ["#F9E3CD", "#F7C2AE", "#F3C3D5"] as const,
  pink: ["#FBD6E4", "#F6A8C9", "#F1A1C7"] as const,
  lime: ["#E7F7A6", "#CFF24A", "#B9E22E"] as const,
  cool: ["#D9EBFA", "#CFD7F5", "#D5C6EB"] as const,
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
  lg: 24,
  xl: 26,
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
