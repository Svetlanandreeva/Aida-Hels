import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Vital } from "@/src/api";
import { validateMeasurementInput, VitalKind } from "@/src/vitalValidation";
import { AddCard, FCard, figma, FigmaTxt as Txt, mobileStyles, RoundIcon, SectionHeader } from "@/src/emergent/figma-mobile";

const KINDS = [
  { key: "weight" as VitalKind, ru: "Вес", en: "Weight", unit: "кг", icon: "scale-outline" as const, bg: "#FFF6D8" },
  { key: "temperature" as VitalKind, ru: "Температура", en: "Temperature", unit: "°C", icon: "thermometer-outline" as const, bg: "#FBEAE5" },
  { key: "pulse" as VitalKind, ru: "Пульс", en: "Pulse", unit: "уд/мин", icon: "heart-outline" as const, bg: "#F8E7EF" },
  { key: "spo2" as VitalKind, ru: "SpO₂", en: "SpO₂", unit: "%", icon: "water-outline" as const, bg: "#EAF2FA" },
  { key: "waist" as VitalKind, ru: "Талия", en: "Waist", unit: "см", icon: "resize-outline" as const, bg: "#F1FAD0" },
];

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [items, setItems] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<VitalKind>("weight");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); setLoadError(false); setLoading(false); return; }
    setLoadError(false);
    try { const all = await api.listVitals(activeId); setItems(all.filter((v) => v.kind !== "bp")); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load, refreshTick]));
  const meta = (k: string) => KINDS.find((x) => x.key === k) || KINDS[0];

  const save = async () => {
    if (!activeId) return;
    const validation = validateMeasurementInput(kind, value, ru);
    if ("error" in validation) { setSaveError(validation.error ?? (ru ? "Проверьте значение измерения" : "Check the measurement value")); return; }
    setSaveError(null); setSaving(true);
    try {
      await api.createVital({ profile_id: activeId, kind, value: validation.value, unit: meta(kind).unit });
      setValue(""); setOpen(false); await load(); bumpRefresh();
    } catch { setSaveError(ru ? "Не удалось сохранить измерение. Попробуйте ещё раз." : "Could not save the measurement. Try again."); }
    finally { setSaving(false); }
  };

  return <View style={mobileStyles.page}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 + insets.bottom }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><RoundIcon icon="chevron-back" size={42} bg={figma.card} /></Pressable>
          <View style={{ flex: 1 }}><Txt variant="h1" style={styles.title}>{ru ? "Измерения" : "Measurements"}</Txt><Txt variant="label" color={figma.muted}>{ru ? "Вес, температура, пульс, SpO₂ и другое" : "Weight, temperature, pulse, SpO₂ and more"}</Txt></View>
          <Pressable onPress={() => { setSaveError(null); setOpen(true); }}><RoundIcon icon="add" size={42} bg={figma.card} /></Pressable>
        </View>

        {!!activeId && <View style={{ marginTop: 18 }}><AddCard testID="add-measure-button" title={ru ? "Добавить измерение" : "Add measurement"} subtitle={ru ? "Выберите показатель и внесите значение" : "Choose a metric and add a value"} icon="fitness-outline" onPress={() => { setSaveError(null); setOpen(true); }} /></View>}

        {loading ? <View style={styles.center}><ActivityIndicator size="small" color={figma.ink} /><Txt variant="label" color={figma.muted}>{ru ? "Обновляем измерения…" : "Refreshing measurements…"}</Txt></View> : null}
        {!loading && !activeId ? <FCard style={styles.state}><RoundIcon icon="person-circle-outline" size={48} bg={figma.bg} /><Txt variant="caption" weight="bold">{ru ? "Выберите профиль" : "Choose a profile"}</Txt><Txt variant="label" color={figma.muted} center>{ru ? "Измерения сохраняются для выбранного профиля." : "Measurements are stored for the selected profile."}</Txt></FCard> : null}
        {!loading && activeId && loadError ? <FCard style={styles.state}><RoundIcon icon="cloud-offline-outline" size={48} bg={figma.bg} /><Txt variant="caption" weight="bold">{ru ? "Не удалось загрузить измерения" : "Could not load measurements"}</Txt><Pressable onPress={() => void load()} style={styles.blackBtn}><Txt variant="label" color="#fff" weight="bold">{ru ? "Повторить" : "Retry"}</Txt></Pressable></FCard> : null}

        {!loading && activeId && !loadError ? <>
          <SectionHeader title={ru ? "Последние измерения" : "Latest measurements"} action={items.length ? `${items.length}` : undefined} />
          {items.length === 0 ? <FCard style={styles.state}><RoundIcon icon="fitness-outline" size={48} bg={figma.bg} /><Txt variant="caption" weight="bold">{ru ? "Измерений пока нет" : "No measurements yet"}</Txt><Txt variant="label" color={figma.muted} center>{ru ? "Добавьте первое значение — оно появится здесь и в истории здоровья." : "Add your first value and it will appear here and in health history."}</Txt></FCard> : <View style={styles.stack}>{items.map((v) => { const m = meta(v.kind); return <FCard key={v.id} style={styles.rowCard}><View style={[styles.metricIcon, { backgroundColor: m.bg }]}><Ionicons name={m.icon} size={20} color={figma.ink} /></View><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{ru ? m.ru : m.en}</Txt><Txt variant="label" color={figma.muted} style={{ marginTop: 3 }}>{(v.date || "").slice(0, 10)}</Txt></View><Txt variant="h3" style={styles.value}>{v.value} {v.unit}</Txt><Pressable onPress={async () => { await api.deleteVital(v.id); void load(); }} hitSlop={8} testID={`delete-measure-${v.id}`}><Ionicons name="trash-outline" size={18} color={figma.muted} /></Pressable></FCard>; })}</View>}
        </> : null}
      </View>
    </ScrollView>

    <Sheet visible={open} onClose={() => { setSaveError(null); setOpen(false); }} testID="measure-sheet" scroll>
      <Txt variant="h1" style={styles.sheetTitle}>{ru ? "Новое измерение" : "New measurement"}</Txt>
      <Txt variant="label" color={figma.muted} style={{ marginTop: 4, marginBottom: 14 }}>{ru ? "Выберите показатель" : "Choose a metric"}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>{KINDS.map((k) => <Pressable key={k.key} onPress={() => { setKind(k.key); setSaveError(null); }} style={[styles.kindChip, kind === k.key && styles.kindChipActive]} testID={`measure-kind-${k.key}`}><Ionicons name={k.icon} size={16} color={figma.ink} /><Txt variant="label" weight="bold">{ru ? k.ru : k.en}</Txt></Pressable>)}</ScrollView>
      <Txt variant="label" weight="bold" style={{ marginTop: 18 }}>{ru ? meta(kind).ru : meta(kind).en} ({meta(kind).unit})</Txt>
      <TextInput testID="measure-value" value={value} onChangeText={(v) => { setValue(v); setSaveError(null); }} keyboardType="numeric" style={styles.input} placeholder="—" placeholderTextColor={figma.muted} />
      {saveError ? <Txt variant="label" color="#C64E5B" style={{ marginTop: 8 }} testID="measure-validation-error">{saveError}</Txt> : null}
      <Pressable disabled={saving} onPress={save} testID="save-measure" style={styles.saveBtn}>{saving ? <ActivityIndicator size="small" color="#fff" /> : <Txt variant="caption" color="#fff" weight="bold">{ru ? "Сохранить" : "Save"}</Txt>}</Pressable>
    </Sheet>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 }, title: { fontSize: 28, lineHeight: 32 },
  center: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10 }, state: { minHeight: 180, marginTop: 20, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, blackBtn: { marginTop: 8, minHeight: 40, paddingHorizontal: 20, borderRadius: 999, backgroundColor: figma.ink, alignItems: "center", justifyContent: "center" },
  stack: { gap: 10 }, rowCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12 }, metricIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" }, value: { fontSize: 18, lineHeight: 22 },
  sheetTitle: { fontSize: 28, lineHeight: 32 }, kinds: { gap: 8, paddingVertical: 4 }, kindChip: { minHeight: 42, paddingHorizontal: 14, borderRadius: 999, backgroundColor: figma.bg, flexDirection: "row", alignItems: "center", gap: 7 }, kindChipActive: { backgroundColor: figma.lime },
  input: { height: 58, marginTop: 8, borderRadius: 18, backgroundColor: figma.bg, paddingHorizontal: 18, fontSize: 22, color: figma.ink }, saveBtn: { height: 52, borderRadius: 999, backgroundColor: figma.ink, marginTop: 18, alignItems: "center", justifyContent: "center" },
});