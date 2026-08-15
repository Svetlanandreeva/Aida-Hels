import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { avatarFor } from "@/src/components/TopBar";
import { Card, Muted, PrimaryButton, Tag } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const COVER = "https://images.unsplash.com/photo-1737040455054-f83c122176ef";

function ageFrom(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeProfile, reload, refreshTick, bumpRefresh } = useApp();
  const { t, lang, setLang } = useI18n();

  const [refreshing, setRefreshing] = useState(false);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [blood, setBlood] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronic, setChronic] = useState("");

  useFocusEffect(useCallback(() => {}, [refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await reload().catch(() => {});
    setRefreshing(false);
  };

  const openEdit = () => {
    if (!activeProfile) return;
    setHeight(activeProfile.height_cm ? String(activeProfile.height_cm) : "");
    setWeight(activeProfile.weight_kg ? String(activeProfile.weight_kg) : "");
    setBlood(activeProfile.blood_type || "");
    setAllergies((activeProfile.allergies || []).join(", "));
    setChronic((activeProfile.chronic_conditions || []).join(", "));
    setEdit(true);
  };

  const save = async () => {
    if (!activeProfile) return;
    setSaving(true);
    try {
      await api.updateProfile(activeProfile.id, {
        height_cm: height ? parseFloat(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        blood_type: blood || null,
        allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
        chronic_conditions: chronic.split(",").map((s) => s.trim()).filter(Boolean),
      });
      await reload();
      bumpRefresh();
      setEdit(false);
    } finally {
      setSaving(false);
    }
  };

  if (!activeProfile) {
    return (
      <View style={[styles.emptyPage, { paddingTop: insets.top + spacing["3xl"] }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="person-outline" size={34} color={colors.onSurfaceSecondary} />
        </View>
        <Text style={styles.emptyTitle}>{lang === "ru" ? "Профиль ещё не создан" : "No profile yet"}</Text>
        <Muted style={styles.emptyText}>
          {lang === "ru"
            ? "Создайте профиль, чтобы сохранять показатели здоровья, задачи и документы в одном месте."
            : "Create a profile to keep health data, tasks and documents in one place."}
        </Muted>
        <PrimaryButton
          label={lang === "ru" ? "Обновить" : "Retry"}
          onPress={() => reload().catch(() => {})}
          style={{ marginTop: spacing.lg, width: "100%" }}
          testID="profile-retry"
        />
      </View>
    );
  }

  const age = ageFrom(activeProfile.dob);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
      >
        <View style={styles.coverWrap}>
          <Image source={{ uri: COVER }} style={styles.cover} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(27,27,29,0.35)"]} style={StyleSheet.absoluteFill as any} />
          <Pressable style={[styles.langChip, { top: insets.top + spacing.md }]} onPress={() => setLang(lang === "ru" ? "en" : "ru")} testID="profile-lang-toggle">
            <Text style={styles.langChipText}>{lang === "ru" ? "RU" : "EN"}</Text>
          </Pressable>
        </View>

        <View style={styles.avatarWrap}>
          <Image source={{ uri: avatarFor(activeProfile.kind) }} style={styles.avatar} contentFit="cover" />
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{activeProfile.name}</Text>
          <View style={styles.metaRow}>
            {age !== null && <Tag label={`${age} ${t("years")}`} bg={colors.surfaceSecondary} color={colors.onSurface} />}
            {activeProfile.blood_type && <Tag label={activeProfile.blood_type} bg={colors.surfaceSecondary} color={colors.onSurface} />}
            {activeProfile.sex && (
              <Tag label={lang === "ru" ? (activeProfile.sex === "female" ? "Жен." : "Муж.") : activeProfile.sex} bg={colors.surfaceSecondary} color={colors.onSurface} />
            )}
          </View>

          <View style={styles.metricRow}>
            <Metric label={t("height")} value={activeProfile.height_cm ? `${activeProfile.height_cm} см` : "—"} />
            <Metric label={t("weight")} value={activeProfile.weight_kg ? `${activeProfile.weight_kg} кг` : "—"} />
            <Metric label={t("blood_type")} value={activeProfile.blood_type || "—"} />
          </View>

          <Pressable style={styles.medicalCardLink} onPress={() => router.push("/medical-card" as any)} testID="medical-card-link">
            <View style={styles.medicalCardIcon}>
              <Ionicons name="medical-outline" size={22} color={colors.onSurface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.medicalCardTitle}>{lang === "ru" ? "Медицинская карта" : "Medical card"}</Text>
              <Text style={styles.medicalCardHint}>{lang === "ru" ? "Диагнозы, операции, лекарства, документы и privacy" : "Diagnoses, procedures, medications, documents and privacy"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.onSurfaceSecondary} />
          </Pressable>

          <Card style={{ marginTop: spacing.md }} testID="allergies-card">
            <View style={styles.sectionHead}>
              <Ionicons name="warning-outline" size={18} color={colors.warning} />
              <Text style={styles.sectionTitle}>{t("allergies")}</Text>
            </View>
            {activeProfile.allergies.length ? (
              <View style={styles.tagWrap}>
                {activeProfile.allergies.map((a, i) => (
                  <View key={i} style={styles.pill}>
                    <Text style={styles.pillText}>{a}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Muted>{t("none")}</Muted>
            )}
          </Card>

          <Card style={{ marginTop: spacing.md }} testID="chronic-card">
            <View style={styles.sectionHead}>
              <Ionicons name="fitness-outline" size={18} color={colors.onSurface} />
              <Text style={styles.sectionTitle}>{t("chronic")}</Text>
            </View>
            {activeProfile.chronic_conditions.length ? (
              <View style={styles.tagWrap}>
                {activeProfile.chronic_conditions.map((a, i) => (
                  <View key={i} style={styles.pill}>
                    <Text style={styles.pillText}>{a}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Muted>{t("none")}</Muted>
            )}
          </Card>

          <Card style={{ marginTop: spacing.md }} testID="settings-card">
            <View style={styles.sectionHead}>
              <Ionicons name="settings-outline" size={18} color={colors.onSurface} />
              <Text style={styles.sectionTitle}>{t("settings")}</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t("language")}</Text>
              <View style={styles.langSwitch}>
                <Pressable onPress={() => setLang("ru")} style={[styles.langOpt, lang === "ru" && styles.langOptActive]} testID="set-lang-ru">
                  <Text style={[styles.langOptText, lang === "ru" && styles.langOptTextActive]}>RU</Text>
                </Pressable>
                <Pressable onPress={() => setLang("en")} style={[styles.langOpt, lang === "en" && styles.langOptActive]} testID="set-lang-en">
                  <Text style={[styles.langOptText, lang === "en" && styles.langOptTextActive]}>EN</Text>
                </Pressable>
              </View>
            </View>
            <Pressable style={styles.settingRow} onPress={openEdit} testID="edit-profile-button">
              <Text style={styles.settingLabel}>{t("edit")}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
            <Pressable
              style={styles.settingRow}
              onPress={() => router.push(`/report?profileId=${activeProfile.id}`)}
              testID="generate-report-button"
            >
              <View style={styles.settingActionLabel}>
                <Ionicons name="document-text-outline" size={19} color={colors.onSurface} />
                <Text style={styles.settingLabel}>{t("generate_report")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          </Card>
        </View>
      </ScrollView>

      <Sheet visible={edit} onClose={() => setEdit(false)} testID="edit-sheet" scroll>
        <Text style={styles.editTitle}>{t("edit")}</Text>
        <EditField label={t("height")}>
          <TextInput testID="edit-height" value={height} onChangeText={setHeight} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </EditField>
        <EditField label={t("weight")}>
          <TextInput testID="edit-weight" value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </EditField>
        <EditField label={t("blood_type")}>
          <TextInput testID="edit-blood" value={blood} onChangeText={setBlood} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </EditField>
        <EditField label={t("allergies")}>
          <TextInput testID="edit-allergies" value={allergies} onChangeText={setAllergies} placeholder={lang === "ru" ? "через запятую" : "comma separated"} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </EditField>
        <EditField label={t("chronic")}>
          <TextInput testID="edit-chronic" value={chronic} onChangeText={setChronic} placeholder={lang === "ru" ? "через запятую" : "comma separated"} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </EditField>
        <PrimaryButton label={t("save")} onPress={save} loading={saving} testID="save-profile-edit" />
      </Sheet>
    </View>
  );
}

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const EditField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ marginBottom: spacing.lg }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  emptyPage: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: spacing.lg, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, textAlign: "center" },
  emptyText: { marginTop: spacing.sm, textAlign: "center", lineHeight: 20 },
  coverWrap: { height: 180 },
  cover: { width: "100%", height: "100%", backgroundColor: colors.surfaceTertiary },
  langChip: {
    position: "absolute",
    right: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.85)",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  langChipText: { fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  avatarWrap: { alignItems: "center", marginTop: -44 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceTertiary,
  },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  name: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, textAlign: "center", letterSpacing: -0.5, fontFamily: fonts.display },
  metaRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.sm, flexWrap: "wrap" },
  metricRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  metric: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  metricValue: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  metricLabel: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2, fontFamily: fonts.text },
  medicalCardLink: { minHeight: 78, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  medicalCardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  medicalCardTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  medicalCardHint: { marginTop: 3, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  pillText: { fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500", fontFamily: fonts.text },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  settingActionLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  settingLabel: { fontSize: fontSize.lg, color: colors.onSurface, fontFamily: fonts.text },
  langSwitch: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: colors.border },
  langOpt: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  langOptActive: { backgroundColor: colors.brandPrimary },
  langOptText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  langOptTextActive: { color: colors.onBrandPrimary },
  editTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
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
});