import React, { useCallback, useState } from "react";
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
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Checkin } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const METRICS = [
  { key: "mood", label: "mood", icon: "happy-outline" as const },
  { key: "energy", label: "energy", icon: "flash-outline" as const },
  { key: "stress", label: "stress", icon: "thunderstorm-outline" as const },
  { key: "anxiety", label: "anxiety", icon: "pulse-outline" as const },
  { key: "sleep", label: "sleep_q", icon: "moon-outline" as const },
];

const scaleColor = (v: number, invert = false) => {
  const good = invert ? v <= 2 : v >= 4;
  const bad = invert ? v >= 4 : v <= 2;
  if (good) return colors.success;
  if (bad) return colors.error;
  return colors.warning;
};

export default function MindScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();
  const { toast } = useLog();

  const [items, setItems] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, number>>({ mood: 3, energy: 3, stress: 3, anxiety: 3, sleep: 3 });
  const [triggers, setTriggers] = useState("");
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
      setItems(await api.listCheckins(activeId));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const save = async () => {
    if (!activeId) return;
    setSaving(true);
    try {
      await api.createCheckin({ profile_id: activeId, ...vals, triggers: triggers.trim() || null });
      setVals({ mood: 3, energy: 3, stress: 3, anxiety: 3, sleep: 3 });
      setTriggers("");
      setOpen(false);
      await load();
      bumpRefresh();
      toast(t("checkin_saved"));
    } finally {
      setSaving(false);
    }
  };

  const stateView = !activeId ? (
    <View style={styles.empty}>
      <Ionicons name="person-circle-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.emptyTitle}>{lang === "ru" ? "Сначала выберите профиль" : "Choose a profile first"}</Text>
      <Muted style={styles.emptyText}>{lang === "ru" ? "Записи самочувствия сохраняются отдельно для каждого профиля." : "Wellbeing check-ins are stored separately for each profile."}</Muted>
    </View>
  ) : error ? (
    <View style={styles.empty}>
      <Ionicons name="cloud-offline-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.emptyTitle}>{lang === "ru" ? "Не удалось загрузить дневник" : "Could not load wellbeing history"}</Text>
      <Muted style={styles.emptyText}>{lang === "ru" ? "Проверьте соединение и попробуйте ещё раз." : "Check your connection and try again."}</Muted>
      <PrimaryButton label={lang === "ru" ? "Повторить" : "Retry"} onPress={() => { setLoading(true); load(); }} style={{ marginTop: spacing.lg }} />
    </View>
  ) : items.length === 0 ? (
    <View style={styles.empty}>
      <Ionicons name="happy-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.emptyTitle}>{lang === "ru" ? "Пока нет записей" : "No check-ins yet"}</Text>
      <Muted style={styles.emptyText}>{t("mind_empty")}</Muted>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_mind")} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : stateView ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom }}>{stateView}</ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {items.map((c) => (
            <Card key={c.id} testID={`checkin-${c.id}`}>
              <View style={styles.itemHead}>
                <Text style={styles.itemDate}>{(c.date || "").slice(0, 10)}</Text>
              </View>
              <View style={styles.metricsRow}>
                {METRICS.map((m) => {
                  const v = (c as any)[m.key] as number;
                  const invert = m.key === "stress" || m.key === "anxiety";
                  return (
                    <View key={m.key} style={styles.metricCol}>
                      <Ionicons name={m.icon} size={16} color={colors.onSurfaceSecondary} />
                      <View style={[styles.metricDot, { backgroundColor: scaleColor(v, invert) }]}>
                        <Text style={styles.metricDotText}>{v}</Text>
                      </View>
                      <Text style={styles.metricLabel} numberOfLines={1}>{t(m.label)}</Text>
                    </View>
                  );
                })}
              </View>
              {c.triggers ? <Muted style={{ marginTop: spacing.sm }}>{t("triggers")}: {c.triggers}</Muted> : null}
            </Card>
          ))}
        </ScrollView>
      )}

      {!loading && activeId && !error && (
        <View style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}>
          <PrimaryButton label={t("quick_checkin")} icon="add" onPress={() => setOpen(true)} testID="add-checkin-button" />
        </View>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="checkin-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("quick_checkin")}</Text>
        {METRICS.map((m) => {
          const invert = m.key === "stress" || m.key === "anxiety";
          return (
            <View key={m.key} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.fieldLabel}>{t(m.label)}</Text>
              <View style={styles.scaleRow}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = vals[m.key] === n;
                  return (
                    <Pressable
                      key={n}
                      testID={`${m.key}-${n}`}
                      onPress={() => setVals((p) => ({ ...p, [m.key]: n }))}
                      style={[styles.scaleDot, active && { backgroundColor: scaleColor(n, invert), borderColor: scaleColor(n, invert) }]}
                    >
                      <Text style={[styles.scaleText, active && { color: colors.onSurfaceInverse }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={styles.fieldLabel}>{`${t("triggers")} (${t("optional")})`}</Text>
        <TextInput
          testID="checkin-triggers"
          value={triggers}
          onChangeText={setTriggers}
          multiline
          style={[styles.input, { height: 80, paddingTop: spacing.md, textAlignVertical: "top" }]}
          placeholderTextColor={colors.onSurfaceSecondary}
        />
        <PrimaryButton label={t("save_checkin")} onPress={save} loading={saving} testID="save-checkin" style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], paddingHorizontal: spacing.lg },
  emptyTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  emptyText: { marginTop: spacing.sm, textAlign: "center", maxWidth: 320 },
  itemHead: { marginBottom: spacing.md },
  itemDate: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  metricsRow: { flexDirection: "row", justifyContent: "space-between" },
  metricCol: { alignItems: "center", gap: 4, flex: 1 },
  metricDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  metricDotText: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: fontSize.base, fontFamily: fonts.text },
  metricLabel: { fontSize: 10, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurface, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  scaleRow: { flexDirection: "row", gap: spacing.sm },
  scaleDot: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  input: {
    minHeight: 52,
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
