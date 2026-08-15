import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Title, Body, Muted, PrimaryButton } from "@/src/components/ui";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, LabTest, Symptom, Medication } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, statusColor } from "@/src/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1706366490101-a7a078c4c98a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwbGFib3JhdG9yeSUyMHRlc3RzJTIwcGFwZXJzJTIwd2FybSUyMGRlc2t8ZW58MHx8fHwxNzg2NzEyMDYxfDA&ixlib=rb-4.1.0&q=85";

type Entry =
  | { type: "lab"; date: string; data: LabTest }
  | { type: "symptom"; date: string; data: Symptom }
  | { type: "med"; date: string; data: Medication };

const FILTERS = ["all", "labs", "symptoms", "medications"] as const;

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();
  const { openLab } = useLog();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [labs, setLabs] = useState<LabTest[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeId) {
      setLabs([]);
      setSymptoms([]);
      setMeds([]);
      setError(false);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const [l, s, m] = await Promise.all([
        api.listLabs(activeId),
        api.listSymptoms(activeId),
        api.listMeds(activeId),
      ]);
      setLabs(l);
      setSymptoms(s);
      setMeds(m);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load, refreshTick])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const entries: Entry[] = useMemo(() => {
    const list: Entry[] = [];
    if (filter === "all" || filter === "labs") labs.forEach((d) => list.push({ type: "lab", date: d.date, data: d }));
    if (filter === "all" || filter === "symptoms") symptoms.forEach((d) => list.push({ type: "symptom", date: d.date, data: d }));
    if (filter === "all" || filter === "medications")
      meds.forEach((d) => list.push({ type: "med", date: d.start_date || d.date || "", data: d }));
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [labs, symptoms, meds, filter]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === id ? null : id));
  };

  const del = async (entry: Entry) => {
    if (entry.type === "lab") await api.deleteLab(entry.data.id);
    else if (entry.type === "symptom") await api.deleteSymptom(entry.data.id);
    else await api.deleteMed(entry.data.id);
    bumpRefresh();
  };

  const renderEntry = (entry: Entry) => {
    if (entry.type === "lab") {
      const lab = entry.data;
      const isOpen = expanded === lab.id;
      const abnormal = lab.biomarkers.filter((b) => b.status === "high" || b.status === "low").length;
      return (
        <Card key={lab.id} testID={`lab-${lab.id}`}>
          <Pressable onPress={() => toggleExpand(lab.id)} style={styles.entryHead}>
            <View style={[styles.iconBox, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="water" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Title>{lab.title}</Title>
              <Muted style={{ marginTop: 2 }}>
                {lab.date}
                {lab.lab_name ? ` · ${lab.lab_name}` : ""} · {lab.biomarkers.length} {t("biomarkers")}
              </Muted>
              {abnormal > 0 && (
                <View style={styles.abnormalTag}>
                  <Ionicons name="alert-circle" size={13} color={colors.warning} />
                  <Text style={styles.abnormalText}>
                    {abnormal} {t("all") === "All" ? "out of range" : "вне нормы"}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          {isOpen && (
            <View style={styles.expandBody}>
              {lab.biomarkers.map((b, i) => (
                <View key={i} style={styles.bioRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bioName}>{b.name}</Text>
                    {b.reference ? (
                      <Muted style={{ fontSize: 11 }}>
                        {t("reference")}: {b.reference}
                      </Muted>
                    ) : null}
                  </View>
                  <View style={styles.bioValueBox}>
                    <View style={[styles.dot, { backgroundColor: statusColor(b.status) }]} />
                    <Text style={[styles.bioValue, { color: statusColor(b.status) }]}>
                      {b.value} {b.unit || ""}
                    </Text>
                  </View>
                </View>
              ))}
              {lab.ai_summary ? (
                <View style={styles.aiNote}>
                  <View style={styles.aiNoteHead}>
                    <Ionicons name="sparkles" size={14} color={colors.brand} />
                    <Text style={styles.aiNoteLabel}>{t("ai_note")}</Text>
                  </View>
                  <Body style={{ color: colors.onSurfaceSecondary }}>{lab.ai_summary}</Body>
                </View>
              ) : null}
              <Pressable style={styles.delBtn} onPress={() => del(entry)} testID={`delete-lab-${lab.id}`}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.delText}>{t("delete")}</Text>
              </Pressable>
            </View>
          )}
        </Card>
      );
    }

    if (entry.type === "symptom") {
      const s = entry.data;
      return (
        <Card key={s.id} testID={`symptom-${s.id}`}>
          <View style={styles.entryHead}>
            <View style={[styles.iconBox, { backgroundColor: "#F3E4DE" }]}>
              <Ionicons name="pulse" size={18} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Title>{s.name}</Title>
              <Muted style={{ marginTop: 2 }}>{s.date}</Muted>
              {s.note ? <Body style={{ marginTop: 4, color: colors.onSurfaceSecondary }}>{s.note}</Body> : null}
            </View>
            <View style={styles.sevBadge}>
              <Text style={styles.sevBadgeText}>{s.severity}/10</Text>
            </View>
            <Pressable onPress={() => del(entry)} hitSlop={10} style={{ marginLeft: spacing.sm }} testID={`delete-symptom-${s.id}`}>
              <Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
        </Card>
      );
    }

    const m = entry.data;
    return (
      <Card key={m.id} testID={`med-${m.id}`}>
        <View style={styles.entryHead}>
          <View style={[styles.iconBox, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="medkit" size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Title>{m.name}</Title>
            <Muted style={{ marginTop: 2 }}>{[m.dose, m.schedule].filter(Boolean).join(" · ") || m.start_date || "—"}</Muted>
          </View>
          {m.active && (
            <View style={[styles.sevBadge, { backgroundColor: colors.brandTertiary }]}>
              <Text style={[styles.sevBadgeText, { color: colors.brand }]}>{t("active")}</Text>
            </View>
          )}
          <Pressable onPress={() => del(entry)} hitSlop={10} style={{ marginLeft: spacing.sm }} testID={`delete-med-${m.id}`}>
            <Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>
        </View>
      </Card>
    );
  };

  const stateView = !activeId ? (
    <View style={styles.stateBox}>
      <Ionicons name="person-circle-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.stateTitle}>{lang === "ru" ? "Сначала выберите профиль" : "Choose a profile first"}</Text>
      <Muted style={styles.stateText}>{lang === "ru" ? "История здоровья собирается отдельно для каждого профиля." : "Health history is collected separately for each profile."}</Muted>
    </View>
  ) : error ? (
    <View style={styles.stateBox}>
      <Ionicons name="cloud-offline-outline" size={56} color={colors.onSurfaceSecondary} />
      <Text style={styles.stateTitle}>{lang === "ru" ? "Не удалось загрузить историю" : "Could not load history"}</Text>
      <Muted style={styles.stateText}>{lang === "ru" ? "Проверьте соединение и попробуйте ещё раз." : "Check your connection and try again."}</Muted>
      <PrimaryButton label={lang === "ru" ? "Повторить" : "Retry"} onPress={() => { setLoading(true); load(); }} style={{ marginTop: spacing.lg }} />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_history")} />
      <View style={styles.filterHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              testID={`filter-${f}`}
              onPress={() => setFilter(f)}
              style={[styles.filterChip, filter === f ? styles.filterActive : styles.filterInactive]}
            >
              <Text style={[styles.filterText, filter === f && { color: colors.onBrandPrimary }]}>{t(f)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : stateView ? (
        <ScrollView contentContainerStyle={styles.emptyWrap}>{stateView}</ScrollView>
      ) : entries.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.stateTitle}>{lang === "ru" ? "История пока пуста" : "History is empty"}</Text>
          <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>{t("timeline_empty")}</Muted>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {entries.map(renderEntry)}
        </ScrollView>
      )}

      {!loading && activeId && !error && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={() => openLab()} testID="upload-lab-fab">
          <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  filterHeader: {
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  filterChip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, justifyContent: "center", flexShrink: 0 },
  filterActive: { backgroundColor: colors.brandPrimary },
  filterInactive: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  filterText: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", padding: spacing.xl, paddingTop: spacing["3xl"] },
  emptyImg: { width: 220, height: 160, borderRadius: radius.lg },
  stateBox: { alignItems: "center", paddingHorizontal: spacing.lg },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  stateText: { marginTop: spacing.sm, textAlign: "center", maxWidth: 320 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  abnormalTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  abnormalText: { fontSize: fontSize.sm, color: colors.warning, fontWeight: "600", fontFamily: fonts.text },
  expandBody: { marginTop: spacing.lg, gap: spacing.sm },
  bioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  bioName: { fontSize: fontSize.base, color: colors.onSurface, fontWeight: "600", fontFamily: fonts.text },
  bioValueBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  bioValue: { fontSize: fontSize.base, fontWeight: "700", fontFamily: fonts.text },
  dot: { width: 8, height: 8, borderRadius: 4 },
  aiNote: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  aiNoteHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  aiNoteLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.brand, fontFamily: fonts.text },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: spacing.md },
  delText: { color: colors.error, fontSize: fontSize.base, fontWeight: "600", fontFamily: fonts.text },
  sevBadge: { backgroundColor: "#F3E4DE", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  sevBadgeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.error, fontFamily: fonts.text },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
