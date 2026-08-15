import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, PrimaryButton, Chip } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Vital } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const KINDS = [
  { key: "weight", ru: "Вес", en: "Weight", unit: "кг", icon: "scale-outline" as const },
  { key: "temperature", ru: "Температура", en: "Temperature", unit: "°C", icon: "thermometer-outline" as const },
  { key: "pulse", ru: "Пульс", en: "Pulse", unit: "уд/мин", icon: "heart-outline" as const },
  { key: "spo2", ru: "SpO₂", en: "SpO₂", unit: "%", icon: "water-outline" as const },
  { key: "waist", ru: "Талия", en: "Waist", unit: "см", icon: "resize-outline" as const },
];

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();

  const [items, setItems] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("weight");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setItems([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoadError(false);
    try {
      const all = await api.listVitals(activeId);
      setItems(all.filter((v) => v.kind !== "bp"));
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const meta = (k: string) => KINDS.find((x) => x.key === k) || KINDS[0];

  const save = async () => {
    if (!value || !activeId) return;
    setSaving(true);
    try {
      await api.createVital({ profile_id: activeId, kind, value: parseFloat(value), unit: meta(kind).unit });
      setValue("");
      setOpen(false);
      await load();
      bumpRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_measures")} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : !activeId ? (
        <View style={styles.stateWrap}><Ionicons name="person-circle-outline" size={56} color={colors.onSurfaceSecondary} /><Text style={styles.stateTitle}>{lang === "ru" ? "Выберите профиль" : "Choose a profile"}</Text><Muted style={styles.stateText}>{lang === "ru" ? "Измерения сохраняются для выбранного профиля." : "Measurements are stored for the selected profile."}</Muted></View>
      ) : loadError ? (
        <View style={styles.stateWrap}><Ionicons name="cloud-offline-outline" size={56} color={colors.onSurfaceSecondary} /><Text style={styles.stateTitle}>{lang === "ru" ? "Не удалось загрузить измерения" : "Could not load measurements"}</Text><Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>{lang === "ru" ? "Повторить" : "Retry"}</Text></Pressable></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="fitness-outline" size={56} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: spacing.md, textAlign: "center" }}>{lang === "ru" ? "Измерений пока нет" : "No measurements yet"}</Muted>
              <Pressable onPress={() => setOpen(true)} style={styles.retryBtn}><Text style={styles.retryText}>{lang === "ru" ? "Добавить измерение" : "Add measurement"}</Text></Pressable>
            </View>
          ) : (
            items.map((v) => {
              const m = meta(v.kind);
              return (
                <Card key={v.id} testID={`measure-${v.id}`}>
                  <View style={styles.row}>
                    <View style={styles.icon}><Ionicons name={m.icon} size={18} color={colors.onSurface} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mName}>{lang === "ru" ? m.ru : m.en}</Text>
                      <Muted>{(v.date || "").slice(0, 10)}</Muted>
                    </View>
                    <Text style={styles.mVal}>{v.value} {v.unit}</Text>
                    <Pressable onPress={async () => { await api.deleteVital(v.id); load(); }} hitSlop={8} style={{ marginLeft: spacing.sm }} testID={`delete-measure-${v.id}`}>
                      <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {!!activeId && !loadError && <View style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}><PrimaryButton label={lang === "ru" ? "Добавить измерение" : "Add measurement"} icon="add" onPress={() => setOpen(true)} testID="add-measure-button" /></View>}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="measure-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("m_measures")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {KINDS.map((k) => <Chip key={k.key} label={lang === "ru" ? k.ru : k.en} active={kind === k.key} onPress={() => setKind(k.key)} testID={`measure-kind-${k.key}`} />)}
        </ScrollView>
        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{lang === "ru" ? meta(kind).ru : meta(kind).en} ({meta(kind).unit})</Text>
        <TextInput testID="measure-value" value={value} onChangeText={setValue} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        <PrimaryButton label={t("save")} onPress={save} loading={saving} testID="save-measure" style={{ marginTop: spacing.lg }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  stateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text, textAlign: "center" },
  stateText: { marginTop: spacing.sm, textAlign: "center" },
  retryBtn: { marginTop: spacing.lg, backgroundColor: colors.onSurface, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText: { color: colors.surfaceSecondary, fontWeight: "700", fontFamily: fonts.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  mName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  mVal: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurface, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  input: { height: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.text },
});