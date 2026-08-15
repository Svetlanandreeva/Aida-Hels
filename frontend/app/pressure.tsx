import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, PrimaryButton } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Vital } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const bpColor = (s: number, d: number) => {
  if (s >= 140 || d >= 90) return colors.error;
  if (s >= 130 || d >= 85) return colors.warning;
  return colors.success;
};

export default function PressureScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();

  const [items, setItems] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pul, setPul] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setItems([]);
      setError(false);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      setItems(await api.listVitals(activeId, "bp"));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const save = async () => {
    if (!sys || !dia || !activeId) return;
    setSaving(true);
    try {
      await api.createVital({
        profile_id: activeId,
        kind: "bp",
        systolic: parseFloat(sys),
        diastolic: parseFloat(dia),
        pulse: pul ? parseFloat(pul) : null,
      });
      setSys(""); setDia(""); setPul("");
      setOpen(false);
      await load();
      bumpRefresh();
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    if (!items.length) return null;
    const s = items.map((x) => x.systolic || 0);
    const d = items.map((x) => x.diastolic || 0);
    const avg = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
    return {
      avgS: avg(s), avgD: avg(d),
      minS: Math.min(...s), maxS: Math.max(...s),
    };
  }, [items]);

  const chart = items.slice(0, 10).reverse();
  const maxVal = Math.max(160, ...chart.map((x) => x.systolic || 0));

  const stateView = !activeId ? (
    <View style={styles.empty}>
      <Ionicons name="person-circle-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.emptyTitle}>{lang === "ru" ? "Сначала выберите профиль" : "Choose a profile first"}</Text>
      <Muted style={styles.emptyText}>{lang === "ru" ? "Давление будет сохраняться в медицинскую историю выбранного профиля." : "Blood pressure will be stored in the selected profile's health history."}</Muted>
    </View>
  ) : error ? (
    <View style={styles.empty}>
      <Ionicons name="cloud-offline-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.emptyTitle}>{lang === "ru" ? "Не удалось загрузить давление" : "Could not load blood pressure"}</Text>
      <Muted style={styles.emptyText}>{lang === "ru" ? "Проверьте соединение и попробуйте ещё раз." : "Check your connection and try again."}</Muted>
      <PrimaryButton label={lang === "ru" ? "Повторить" : "Retry"} onPress={() => { setLoading(true); load(); }} style={{ marginTop: spacing.lg }} />
    </View>
  ) : items.length === 0 ? (
    <View style={styles.empty}>
      <Ionicons name="heart-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.emptyTitle}>{lang === "ru" ? "Пока нет измерений давления" : "No blood pressure readings yet"}</Text>
      <Muted style={styles.emptyText}>{t("pressure_empty")}</Muted>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_pressure")} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : stateView ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom }}>{stateView}</ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <>
            {stats && (
              <View style={styles.statRow}>
                <Card style={styles.statCard}>
                  <Text style={styles.statLabel}>{t("avg")}</Text>
                  <Text style={styles.statBig}>{stats.avgS}/{stats.avgD}</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statLabel}>{t("min")}–{t("max")}</Text>
                  <Text style={styles.statBig}>{stats.minS}–{stats.maxS}</Text>
                </Card>
              </View>
            )}

            {chart.length > 1 && (
              <Card>
                <Text style={styles.chartTitle}>{t("m_pressure")}</Text>
                <View style={styles.chart}>
                  {chart.map((x) => {
                    const sH = ((x.systolic || 0) / maxVal) * 120;
                    const dH = ((x.diastolic || 0) / maxVal) * 120;
                    return (
                      <View key={x.id} style={styles.barGroup}>
                        <View style={styles.barTrack}>
                          <View style={[styles.bar, { height: sH, backgroundColor: bpColor(x.systolic || 0, x.diastolic || 0) }]} />
                          <View style={[styles.bar, { height: dH, backgroundColor: colors.surfaceTertiary, marginLeft: 3 }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
                  {t("systolic").split(" ")[0]} / {t("diastolic").split(" ")[0]}
                </Muted>
              </Card>
            )}

            {items.map((x) => (
              <Card key={x.id} testID={`bp-${x.id}`}>
                <View style={styles.itemRow}>
                  <View style={[styles.dot, { backgroundColor: bpColor(x.systolic || 0, x.diastolic || 0) }]} />
                  <Text style={styles.itemVal}>{Math.round(x.systolic || 0)}/{Math.round(x.diastolic || 0)}</Text>
                  {x.pulse ? <Text style={styles.itemPulse}>· {Math.round(x.pulse)} {t("pulse").toLowerCase()}</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Muted>{(x.date || "").slice(0, 10)}</Muted>
                  <Pressable onPress={async () => { await api.deleteVital(x.id); load(); }} hitSlop={8} style={{ marginLeft: spacing.sm }} testID={`delete-bp-${x.id}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </>
        </ScrollView>
      )}

      {!loading && activeId && !error && (
        <View style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}>
          <PrimaryButton label={t("add_pressure")} icon="add" onPress={() => setOpen(true)} testID="add-pressure-button" />
        </View>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="pressure-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("add_pressure")}</Text>
        <Field label={t("systolic")}>
          <TextInput testID="input-systolic" value={sys} onChangeText={setSys} keyboardType="numeric" placeholder="120" style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <Field label={t("diastolic")}>
          <TextInput testID="input-diastolic" value={dia} onChangeText={setDia} keyboardType="numeric" placeholder="80" style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <Field label={`${t("pulse")} (${t("optional")})`}>
          <TextInput testID="input-pulse" value={pul} onChangeText={setPul} keyboardType="numeric" placeholder="70" style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <PrimaryButton label={t("save")} onPress={save} loading={saving} testID="save-pressure" />
      </Sheet>
    </View>
  );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ marginBottom: spacing.lg }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], paddingHorizontal: spacing.lg },
  emptyTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  emptyText: { marginTop: spacing.sm, textAlign: "center", maxWidth: 320 },
  statRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, padding: spacing.lg },
  statLabel: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  statBig: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, marginTop: 4, fontFamily: fonts.display },
  chartTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md, fontFamily: fonts.text },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 130 },
  barGroup: { alignItems: "center" },
  barTrack: { flexDirection: "row", alignItems: "flex-end" },
  bar: { width: 8, borderRadius: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemVal: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  itemPulse: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
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
