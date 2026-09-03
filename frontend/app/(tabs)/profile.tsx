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
import { PrimaryButton } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";

const COVER = "https://images.unsplash.com/photo-1737040455054-f83c122176ef";

const figma = {
  bg: "#EAEAE8",
  card: "#FBFBFA",
  text: "#1B1B1D",
  muted: "#8A8A8E",
  divider: "#ECECEA",
  allergy: "#F6E7DE",
  coverA: "#E9D8C8",
  coverB: "#DEC7B1",
  coverC: "#D9BEA6",
};

function ageFrom(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
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
      <View style={[styles.empty, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="person-outline" size={36} color={figma.muted} />
        <Text style={styles.emptyTitle}>{lang === "ru" ? "Профиль ещё не создан" : "No profile yet"}</Text>
        <PrimaryButton label={lang === "ru" ? "Обновить" : "Retry"} onPress={() => reload().catch(() => {})} testID="profile-retry" />
      </View>
    );
  }

  const age = ageFrom(activeProfile.dob);
  const sexLabel = lang === "ru"
    ? activeProfile.sex === "female" ? "Жен." : activeProfile.sex === "male" ? "Муж." : "—"
    : activeProfile.sex || "—";

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={figma.text} />}
      >
        <View style={[styles.cover, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[figma.coverA, figma.coverB, figma.coverC]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={{ uri: COVER }} style={styles.coverTexture} contentFit="cover" />
          <Pressable style={styles.langButton} onPress={() => setLang(lang === "ru" ? "en" : "ru")} testID="profile-lang-toggle">
            <Text style={styles.langText}>{lang === "ru" ? "RU" : "EN"}</Text>
          </Pressable>
        </View>

        <View style={styles.avatarWrap}>
          <Image source={{ uri: avatarFor(activeProfile.kind) }} style={styles.avatar} contentFit="cover" />
        </View>

        <Text style={styles.name}>{activeProfile.name}</Text>

        <View style={styles.metaRow}>
          {age !== null ? <Pill text={`${age} ${lang === "ru" ? "год" : "y"}`} /> : null}
          {activeProfile.blood_type ? <Pill text={activeProfile.blood_type} /> : null}
          <Pill text={sexLabel} />
        </View>

        <View style={styles.metricsRow}>
          <Metric value={activeProfile.height_cm ? `${activeProfile.height_cm} см` : "—"} label={t("height")} />
          <Metric value={activeProfile.weight_kg ? `${activeProfile.weight_kg} кг` : "—"} label={t("weight")} />
          <Metric value={activeProfile.blood_type || "—"} label={t("blood_type")} />
        </View>

        <Pressable style={styles.medCard} onPress={() => router.push("/medical-card" as any)} testID="medical-card-link">
          <View style={styles.medIcon}><Ionicons name="medical-outline" size={23} color={figma.text} /></View>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{lang === "ru" ? "Медицинская карта" : "Medical card"}</Text>
            <Text style={styles.rowSubtitle}>{lang === "ru" ? "Диагнозы, операции, лекарства и документы" : "Diagnoses, procedures, medications and documents"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={figma.muted} />
        </Pressable>

        <View style={styles.allergyCard} testID="allergies-card">
          <Text style={styles.allergyTitle}>⚠ {t("allergies")}</Text>
          <View style={styles.allergyRow}>
            {(activeProfile.allergies || []).length ? activeProfile.allergies.map((item, i) => (
              <View key={`${item}-${i}`} style={styles.allergyPill}><Text style={styles.allergyText}>{item}</Text></View>
            )) : <Text style={styles.noneText}>{t("none")}</Text>}
          </View>
        </View>

        <View style={styles.settingsCard} testID="settings-card">
          <Text style={styles.settingsTitle}>{t("settings")}</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{t("language")}</Text>
            <Pressable onPress={() => setLang(lang === "ru" ? "en" : "ru")} testID="profile-language-row">
              <Text style={styles.settingValue}>{lang === "ru" ? "RU / EN" : "EN / RU"}</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.settingRow} onPress={openEdit} testID="edit-profile-button">
            <Text style={styles.settingLabel}>{t("edit")}</Text>
            <Ionicons name="chevron-forward" size={18} color={figma.muted} />
          </Pressable>
        </View>

        <Pressable style={styles.secondaryRow} onPress={() => router.push("/settings" as any)} testID="full-settings-link">
          <Ionicons name="settings-outline" size={20} color={figma.text} />
          <Text style={styles.secondaryText}>{lang === "ru" ? "Все настройки и разделы профиля" : "All profile settings"}</Text>
          <Ionicons name="chevron-forward" size={18} color={figma.muted} />
        </Pressable>
      </ScrollView>

      <Sheet visible={edit} onClose={() => setEdit(false)} testID="edit-sheet" scroll>
        <Text style={styles.editTitle}>{t("edit")}</Text>
        <EditField label={t("height")}><TextInput testID="edit-height" value={height} onChangeText={setHeight} keyboardType="numeric" style={styles.input} /></EditField>
        <EditField label={t("weight")}><TextInput testID="edit-weight" value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} /></EditField>
        <EditField label={t("blood_type")}><TextInput testID="edit-blood" value={blood} onChangeText={setBlood} style={styles.input} /></EditField>
        <EditField label={t("allergies")}><TextInput testID="edit-allergies" value={allergies} onChangeText={setAllergies} style={styles.input} /></EditField>
        <EditField label={t("chronic")}><TextInput testID="edit-chronic" value={chronic} onChangeText={setChronic} style={styles.input} /></EditField>
        <PrimaryButton label={t("save")} onPress={save} loading={saving} testID="save-profile-edit" />
      </Sheet>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  return <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const EditField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.editField}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: figma.bg },
  empty: { flex: 1, backgroundColor: figma.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 18 },
  emptyTitle: { color: figma.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  cover: { height: 180, overflow: "hidden" },
  coverTexture: { ...StyleSheet.absoluteFillObject, opacity: 0.08 },
  langButton: { position: "absolute", right: 16, bottom: 77, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(251,251,250,0.94)", alignItems: "center", justifyContent: "center" },
  langText: { color: figma.text, fontSize: 12, fontWeight: "800" },
  avatarWrap: { alignItems: "center", marginTop: -44 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: figma.bg, backgroundColor: "#DEDEDC" },
  name: { color: figma.text, fontSize: 26, lineHeight: 34, fontWeight: "800", textAlign: "center", marginTop: 10 },
  metaRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 4 },
  pill: { height: 28, minWidth: 48, paddingHorizontal: 12, borderRadius: 999, backgroundColor: figma.card, alignItems: "center", justifyContent: "center" },
  pillText: { color: figma.text, fontSize: 12, fontWeight: "800" },
  metricsRow: { flexDirection: "row", gap: 11, paddingHorizontal: 16, marginTop: 16 },
  metric: { flex: 1, height: 82, borderRadius: 18, backgroundColor: figma.card, alignItems: "center", justifyContent: "center" },
  metricValue: { color: figma.text, fontSize: 16, fontWeight: "800" },
  metricLabel: { color: figma.muted, fontSize: 11, marginTop: 5 },
  medCard: { minHeight: 72, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 16, borderRadius: 26, backgroundColor: figma.card, flexDirection: "row", alignItems: "center", gap: 14 },
  medIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F0F0EE", alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  rowTitle: { color: figma.text, fontSize: 15, fontWeight: "800" },
  rowSubtitle: { color: figma.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  allergyCard: { minHeight: 84, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 26, backgroundColor: figma.card },
  allergyTitle: { color: figma.text, fontSize: 13, fontWeight: "800" },
  allergyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  allergyPill: { height: 24, paddingHorizontal: 12, borderRadius: 999, backgroundColor: figma.allergy, alignItems: "center", justifyContent: "center" },
  allergyText: { color: figma.text, fontSize: 11, fontWeight: "700" },
  noneText: { color: figma.muted, fontSize: 12 },
  settingsCard: { marginHorizontal: 16, marginTop: 16, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 6, borderRadius: 26, backgroundColor: figma.card },
  settingsTitle: { color: figma.text, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  settingRow: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingLabel: { color: figma.text, fontSize: 13 },
  settingValue: { color: figma.muted, fontSize: 12 },
  divider: { height: 1, backgroundColor: figma.divider },
  secondaryRow: { marginHorizontal: 16, marginTop: 14, minHeight: 56, paddingHorizontal: 18, borderRadius: 22, backgroundColor: "rgba(251,251,250,0.66)", flexDirection: "row", alignItems: "center", gap: 12 },
  secondaryText: { flex: 1, color: figma.text, fontSize: 13, fontWeight: "700" },
  editTitle: { color: figma.text, fontSize: 24, fontWeight: "800", marginBottom: 18 },
  editField: { marginBottom: 16 },
  fieldLabel: { color: figma.muted, fontSize: 13, marginBottom: 8, fontWeight: "600" },
  input: { height: 52, borderRadius: 16, paddingHorizontal: 16, backgroundColor: figma.card, color: figma.text, borderWidth: 1, borderColor: "#D8D8D6", fontSize: 16 },
});
