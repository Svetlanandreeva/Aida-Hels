import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Medication } from "@/src/api";
import { updateMedicationSchedule } from "@/src/medicationScheduleApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type Drafts = Record<string, string[]>;

function maskTime(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function doseLabels(med: Medication, ru: boolean) {
  const parts = (med.day_parts || []).filter(Boolean);
  if (!parts.length) return [ru ? "Время приёма" : "Dose time"];
  const labels: Record<string, string> = ru
    ? { morning: "Утро", day: "День", evening: "Вечер" }
    : { morning: "Morning", day: "Day", evening: "Evening" };
  return parts.map((part) => labels[part] || part);
}

export default function MedicationTimeSetupScreen() {
  const { activeId, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const insets = useSafeAreaInsets();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      setLoading(false);
      return;
    }
    void api.listMeds(activeId)
      .then((items) => {
        if (cancelled) return;
        const missing = items.filter((med) => med.active && !(med.times || []).length);
        setMedications(missing);
        const next: Drafts = {};
        missing.forEach((med) => { next[med.id] = doseLabels(med, ru).map(() => ""); });
        setDrafts(next);
        if (!missing.length) router.replace("/(tabs)" as any);
      })
      .catch(() => setError(ru ? "Не удалось загрузить лекарства" : "Could not load medications"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeId, ru]);

  const allValid = useMemo(() => medications.length > 0 && medications.every((med) => {
    const values = drafts[med.id] || [];
    return values.length === doseLabels(med, ru).length && values.every((value) => TIME_RE.test(value));
  }), [drafts, medications, ru]);

  const changeTime = (medId: string, index: number, value: string) => {
    setDrafts((current) => {
      const next = [...(current[medId] || [])];
      next[index] = maskTime(value);
      return { ...current, [medId]: next };
    });
    setError(null);
  };

  const save = async () => {
    if (!allValid || saving) {
      setError(ru ? "Укажите точное время для каждого приёма в формате ЧЧ:ММ" : "Enter an exact HH:MM time for every dose");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all(medications.map((med) => {
        const times = drafts[med.id];
        return updateMedicationSchedule(med.id, { times, schedule: times.join(", ") });
      }));
      bumpRefresh();
      router.replace("/(tabs)" as any);
    } catch {
      setError(ru ? "Не удалось сохранить время. Попробуйте ещё раз." : "Could not save times. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>AIDA · {ru ? "ПОСЛЕДНИЙ ШАГ" : "FINAL STEP"}</Text>
      <Text style={s.title}>{ru ? "Во сколько вы принимаете лекарства?" : "What time do you take your medications?"}</Text>
      <Text style={s.subtitle}>{ru ? "Аида использует дату и локальное время этого устройства. Точное время нужно, чтобы правильно показать ближайший приём и настроить уведомления, если они включены." : "Aida uses this device's local date and time. Exact times are needed for the next-dose card and reminders when notifications are enabled."}</Text>

      {loading ? <View style={s.loading}><ActivityIndicator size="large" color={colors.onSurface} /></View> : null}

      {!loading && medications.map((med) => {
        const labels = doseLabels(med, ru);
        const values = drafts[med.id] || [];
        return (
          <View key={med.id} style={s.card}>
            <View style={s.medHead}>
              <View style={s.medIcon}><Ionicons name="medkit-outline" size={19} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.medName}>{med.name}</Text>
                <Text style={s.medDose}>{med.dose || (ru ? "Дозировка не указана" : "Dose not specified")}</Text>
              </View>
            </View>
            {labels.map((label, index) => {
              const value = values[index] || "";
              return (
                <View key={`${med.id}-${index}`} style={s.timeRow}>
                  <Text style={s.timeLabel}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={(text) => changeTime(med.id, index, text)}
                    placeholder={ru ? "ЧЧ:ММ" : "HH:MM"}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[s.timeInput, value.length > 0 && !TIME_RE.test(value) && s.timeInputInvalid]}
                    testID={`medication-time-${med.id}-${index}`}
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {!loading && medications.length ? (
        <View style={s.actions}>
          <Pressable style={[s.primary, (!allValid || saving) && s.primaryDisabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <><Ionicons name="alarm-outline" size={18} color={colors.onSurfaceInverse} /><Text style={s.primaryText}>{ru ? "Сохранить время" : "Save times"}</Text></>}
          </Pressable>
          <Pressable style={s.secondary} onPress={() => router.replace("/(tabs)" as any)} disabled={saving}>
            <Text style={s.secondaryText}>{ru ? "Сделать позже" : "Do this later"}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: spacing.xl },
  eyebrow: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 1.2, fontFamily: fonts.text },
  title: { marginTop: spacing.lg, color: colors.onSurface, fontSize: 36, lineHeight: 42, fontWeight: "800", fontFamily: fonts.display },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 23, fontFamily: fonts.text },
  loading: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  medHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  medIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  medName: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "800", fontFamily: fonts.text },
  medDose: { marginTop: 2, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontFamily: fonts.text },
  timeRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  timeLabel: { flex: 1, color: colors.onSurface, fontSize: fontSize.base, fontWeight: "700", fontFamily: fonts.text },
  timeInput: { width: 118, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.onSurface, textAlign: "center", fontSize: fontSize.lg, fontWeight: "800", fontFamily: fonts.text },
  timeInputInvalid: { borderColor: colors.error },
  error: { color: colors.error, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.text, marginBottom: spacing.md },
  actions: { marginTop: spacing.sm, gap: spacing.sm },
  primary: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.onSurface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: colors.onSurfaceInverse, fontSize: fontSize.base, fontWeight: "800", fontFamily: fonts.text },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: "700", fontFamily: fonts.text },
});
