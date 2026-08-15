import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";
import { Sheet } from "./Sheet";
import { PrimaryButton, Chip } from "./ui";
import { api, Profile } from "@/src/api";

const AVATARS = {
  me: "https://images.unsplash.com/photo-1740252117070-7aa2955b25f8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDZ8MHwxfHNlYXJjaHwyfHxzbWlsaW5nJTIwcGFyZW50JTIwYXZhdGFyJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzgyMzE4MjM5fDA&ixlib=rb-4.1.0&q=85",
  child:
    "https://images.unsplash.com/photo-1740252117044-2af197eea287?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDZ8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwcGFyZW50JTIwYXZhdGFyJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzgyMzE4MjM5fDA&ixlib=rb-4.1.0&q=85",
  relative:
    "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHNvZnQlMjAzZCUyMHNoYXBlcyUyMHdhcm18ZW58MHx8fHwxNzg0ODMwMjc2fDA&ixlib=rb-4.1.0&q=85",
};

export const avatarFor = (kind: string) => AVATARS[kind as keyof typeof AVATARS] || AVATARS.me;

export const TopBar: React.FC<{ subtitle?: string }> = ({ subtitle }) => {
  const { profiles, activeProfile, setActive, reload } = useApp();
  const { t, lang, toggleLang } = useI18n();
  const responsive = useResponsiveLayout();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Profile["kind"]>("child");
  const [saving, setSaving] = useState(false);

  const kindLabel = (k: string) => t(k === "me" ? "my_profile" : k === "child" ? "child" : "relative");

  const onAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const p = await api.createProfile({ name: name.trim(), kind });
      await reload();
      setActive(p.id);
      setName("");
      setAdding(false);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={[styles.bar, responsive.isTinyPhone && styles.barTiny]}>
        <Pressable
          testID="profile-switcher-button"
          style={styles.switcher}
          onPress={() => setOpen(true)}
        >
          <Image
            source={{ uri: avatarFor(activeProfile?.kind || "me") }}
            style={[styles.avatar, responsive.isCompactPhone && styles.topAvatarCompact]}
            contentFit="cover"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.name, responsive.isCompactPhone && styles.nameCompact]}
              numberOfLines={1}
            >
              {activeProfile?.name || t("switch_profile")}
            </Text>
            <View style={styles.kindRow}>
              <Text
                style={[styles.kind, responsive.isTinyPhone && styles.kindTiny]}
                numberOfLines={1}
              >
                {kindLabel(activeProfile?.kind || "me")}
              </Text>
              <Ionicons name="chevron-down" size={13} color={colors.onSurfaceSecondary} />
            </View>
          </View>
        </Pressable>

        <Pressable
          testID="lang-toggle"
          style={[styles.langBtn, responsive.isCompactPhone && styles.langBtnCompact]}
          onPress={toggleLang}
        >
          <Text style={[styles.langText, responsive.isCompactPhone && styles.langTextCompact]}>
            {lang === "ru" ? "RU" : "EN"}
          </Text>
        </Pressable>
      </View>
      {subtitle ? (
        <Text
          style={[styles.subtitle, responsive.isCompactPhone && styles.subtitleCompact]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="profile-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("switch_profile")}</Text>
        {profiles.map((p) => {
          const isActive = p.id === activeProfile?.id;
          return (
            <Pressable
              key={p.id}
              testID={`profile-option-${p.id}`}
              style={[styles.profileRow, isActive && styles.profileRowActive]}
              onPress={() => {
                setActive(p.id);
                setOpen(false);
              }}
            >
              <Image source={{ uri: avatarFor(p.kind) }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.kind} numberOfLines={1}>{kindLabel(p.kind)}</Text>
              </View>
              {isActive && <Ionicons name="checkmark-circle" size={22} color={colors.brand} />}
            </Pressable>
          );
        })}

        {adding ? (
          <View style={styles.addForm}>
            <TextInput
              testID="new-profile-name"
              placeholder={t("profile_name")}
              placeholderTextColor={colors.onSurfaceSecondary}
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
            <View style={styles.kindChips}>
              <Chip label={t("child")} active={kind === "child"} onPress={() => setKind("child")} testID="kind-child" />
              <Chip label={t("relative")} active={kind === "relative"} onPress={() => setKind("relative")} testID="kind-relative" />
            </View>
            <PrimaryButton label={t("save")} onPress={onAdd} loading={saving} testID="save-profile" />
          </View>
        ) : (
          <Pressable testID="add-profile-button" style={styles.addBtn} onPress={() => setAdding(true)}>
            <Ionicons name="add-circle-outline" size={22} color={colors.brand} />
            <Text style={styles.addText}>{t("add_profile")}</Text>
          </Pressable>
        )}
      </Sheet>
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  barTiny: { gap: spacing.sm },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary },
  topAvatarCompact: { width: 38, height: 38, borderRadius: 19 },
  name: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  nameCompact: { fontSize: fontSize.base },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0 },
  kind: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  kindTiny: { fontSize: 11 },
  langBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  langBtnCompact: { width: 38, height: 38, borderRadius: 19 },
  langText: { fontSize: fontSize.base, fontWeight: "800", color: colors.brand, fontFamily: fonts.text },
  langTextCompact: { fontSize: fontSize.sm },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    marginTop: spacing.md,
    fontFamily: fonts.text,
  },
  subtitleCompact: { fontSize: fontSize.sm, lineHeight: 18, marginTop: spacing.sm },
  sheetTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: spacing.lg,
    fontFamily: fonts.display,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  profileRowActive: { backgroundColor: colors.brandTertiary },
  rowName: { fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface, fontFamily: fonts.text },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  addText: { fontSize: fontSize.lg, fontWeight: "600", color: colors.brand, fontFamily: fonts.text },
  addForm: { marginTop: spacing.md, gap: spacing.md },
  input: {
    height: 52,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.text,
  },
  kindChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
