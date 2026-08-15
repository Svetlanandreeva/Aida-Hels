import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted } from "@/src/components/ui";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, LabTest } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, statusColor } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "all" },
  { key: "normal", label: "success_label" },
  { key: "high", label: "high_label" },
  { key: "low", label: "low_label" },
] as const;

export default function LabsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, refreshTick } = useApp();
  const { t, lang } = useI18n();
  const { openLab } = useLog();

  const [labs, setLabs] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    if (!activeId) {
      setLabs([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoadError(false);
    try {
      setLabs(await api.listLabs(activeId));
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const flat = useMemo(() => {
    const rows: { lab: LabTest; b: any }[] = [];
    labs.forEach((l) => l.biomarkers.forEach((b) => rows.push({ lab: l, b })));
    if (filter === "all") return rows;
    return rows.filter((r) => (r.b.status || "unknown") === filter);
  }, [labs, filter]);

  const label = (key: string) => {
    switch (key) {
      case "all": return t("all");
      case "success_label": return lang === "ru" ? "В норме" : "In range";
      case "high_label": return lang === "ru" ? "Выше" : "High";
      case "low_label": return lang === "ru" ? "Ниже" : "Low";
      default: return key;
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_labs")} />
      <View style={styles.filterHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} testID={`labfilter-${f.key}`} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key ? styles.chipActive : styles.chipInactive]}>
              <Text style={[styles.chipText, filter === f.key && { color: colors.onBrandPrimary }]}>{label(f.label)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : !activeId ? (
        <View style={styles.stateWrap}><Ionicons name="person-circle-outline" size={56} color={colors.onSurfaceSecondary} /><Text style={styles.stateTitle}>{lang === "ru" ? "Выберите профиль" : "Choose a profile"}</Text><Muted style={styles.stateText}>{lang === "ru" ? "Анализы будут привязаны к выбранному профилю." : "Lab results are linked to the selected profile."}</Muted></View>
      ) : loadError ? (
        <View style={styles.stateWrap}><Ionicons name="cloud-offline-outline" size={56} color={colors.onSurfaceSecondary} /><Text style={styles.stateTitle}>{lang === "ru" ? "Не удалось загрузить анализы" : "Could not load labs"}</Text><Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>{lang === "ru" ? "Повторить" : "Retry"}</Text></Pressable></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {labs.length > 0 && (
            <Pressable style={styles.trendsCard} onPress={() => router.push("/lab-trends" as any)} testID="open-lab-trends">
              <View style={styles.trendsIcon}><Ionicons name="analytics-outline" size={22} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trendsTitle}>{lang === "ru" ? "Тренды показателей" : "Biomarker trends"}</Text>
                <Text style={styles.trendsText}>{lang === "ru" ? "Сравнить повторные результаты во времени" : "Compare repeated results over time"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.onSurfaceSecondary} />
            </Pressable>
          )}

          {flat.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="water-outline" size={56} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: spacing.md, textAlign: "center" }}>{labs.length === 0 ? (lang === "ru" ? "Анализов пока нет" : "No lab results yet") : (lang === "ru" ? "По этому фильтру ничего не найдено" : "Nothing matches this filter")}</Muted>
              {labs.length === 0 && <Pressable onPress={() => openLab()} style={styles.retryBtn}><Text style={styles.retryText}>{lang === "ru" ? "Загрузить анализ" : "Upload lab"}</Text></Pressable>}
            </View>
          ) : (
            flat.map(({ lab, b }, i) => (
              <Card key={`${lab.id}-${i}`} testID={`biomarker-${i}`}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: statusColor(b.status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bName}>{b.name}</Text>
                    <Muted numberOfLines={1}>{lab.title} · {lab.date}{b.reference ? ` · ${t("reference")}: ${b.reference}` : ""}</Muted>
                  </View>
                  <Text style={[styles.bVal, { color: statusColor(b.status) }]}>{b.value} {b.unit || ""}</Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {!!activeId && !loadError && <Pressable style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={() => openLab()} testID="labs-upload-fab"><Ionicons name="add" size={28} color={colors.onBrandPrimary} /></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  filterHeader: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipInactive: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  stateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text, textAlign: "center" },
  stateText: { marginTop: spacing.sm, textAlign: "center" },
  retryBtn: { marginTop: spacing.lg, backgroundColor: colors.onSurface, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText: { color: colors.surfaceSecondary, fontWeight: "700", fontFamily: fonts.text },
  trendsCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.glassBorder },
  trendsIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  trendsTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  trendsText: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  bVal: { fontSize: fontSize.lg, fontWeight: "800", fontFamily: fonts.text },
  fab: { position: "absolute", right: spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", elevation: 4 },
});