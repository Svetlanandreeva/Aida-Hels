import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

export const Card: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}> = ({ children, style, onPress, testID }) => {
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.9 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
};

export const GradientCard: React.FC<{
  children: React.ReactNode;
  gradient: readonly string[];
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}> = ({ children, gradient, style, onPress, testID }) => {
  const content = (
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.card, styles.gradientCard, style]}
    >
      {children}
    </LinearGradient>
  );
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID}>{content}</View>
  );
};

export const Display: React.FC<{ children: React.ReactNode; style?: StyleProp<TextStyle> }> = ({
  children,
  style,
}) => <Text style={[styles.display, style]}>{children}</Text>;

export const Title: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.title, style]}>
    {children}
  </Text>
);

export const Body: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.body, style]}>
    {children}
  </Text>
);

export const Muted: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.muted, style]}>
    {children}
  </Text>
);

export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "accent";
  testID?: string;
}> = ({ label, onPress, icon, loading, disabled, style, variant = "primary", testID }) => {
  const isSecondary = variant === "secondary";
  const isAccent = variant === "accent";
  const fg = isSecondary ? colors.onSurface : isAccent ? colors.onAccent : colors.onBrandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isSecondary ? styles.btnSecondary : isAccent ? styles.btnAccent : styles.btnPrimary,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

export const Chip: React.FC<{
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}> = ({ label, active, onPress, icon, testID }) => (
  <Pressable
    testID={testID}
    onPress={onPress}
    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
  >
    {icon && (
      <Ionicons
        name={icon}
        size={14}
        color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}
        style={{ marginRight: 6 }}
      />
    )}
    <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{label}</Text>
  </Pressable>
);

export const ProgressBar: React.FC<{ value: number; color?: string; height?: number }> = ({
  value,
  color = colors.accent,
  height = 10,
}) => (
  <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
    <View
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        backgroundColor: color,
        height: "100%",
        borderRadius: height / 2,
      }}
    />
  </View>
);

export const Tag: React.FC<{ label: string; color?: string; bg?: string }> = ({
  label,
  color = colors.onAccent,
  bg = colors.accent,
}) => (
  <View style={[styles.tag, { backgroundColor: bg }]}>
    <Text style={[styles.tagText, { color }]}>{label}</Text>
  </View>
);

export const IconCircle: React.FC<{
  name: keyof typeof Ionicons.glyphMap;
  bg?: string;
  color?: string;
  size?: number;
}> = ({ name, bg = colors.surface, color = colors.onSurface, size = 40 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: bg,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Ionicons name={name} size={size * 0.5} color={color} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  gradientCard: { borderColor: "rgba(255,255,255,0.4)", overflow: "hidden" },
  display: {
    fontFamily: fonts.display,
    fontSize: fontSize["3xl"],
    color: colors.onSurface,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: fonts.text,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    color: colors.onSurface,
    lineHeight: 20,
  },
  muted: {
    fontFamily: fonts.text,
    fontSize: fontSize.sm,
    color: colors.onSurfaceSecondary,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
  },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnAccent: { backgroundColor: colors.accent },
  btnSecondary: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    fontFamily: fonts.text,
    letterSpacing: -0.2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipInactive: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
    fontFamily: fonts.text,
  },
  progressTrack: {
    width: "100%",
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  tagText: { fontSize: fontSize.sm, fontWeight: "700", fontFamily: fonts.text },
});
