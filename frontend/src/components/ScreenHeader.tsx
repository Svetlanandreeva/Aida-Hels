import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { colors, spacing, fontSize, fonts } from "@/src/theme";

export const ScreenHeader: React.FC<{ title: string; right?: React.ReactNode; fallbackHref?: string }> = ({ title, right, fallbackHref = "/" }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const responsive = useResponsiveLayout();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref as any);
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: responsive.contentPadding,
        },
      ]}
    >
      <Pressable
        onPress={goBack}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("back")}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        testID="screen-back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  backPressed: { opacity: 0.86 },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.xl,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.4,
    fontFamily: fonts.extrabold,
  },
  right: { minWidth: 44, alignItems: "flex-end" },
});
