import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { Card, GradientCard, Title, Muted, Tag } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Medication, Symptom, LabTest } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, gradients, statusColor } from "@/src/theme";

const COMPANION_IMG =
  "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHNvZnQlMjAzZCUyMHNoYXBlcyUyMHdhcm18ZW58MHx8fHwxNzg0ODMwMjc2fDA&ixlib=rb-4.1.0&q=85";

type PuzzleWidget = {
  id: string;
  enabled: boolean;
  show_on_home: boolean;
  order: number;
  allow_ai_analytics: boolean;
  notifications: boolean;
};

const WIDGET_LABELS: Record<string, { ru: string; en: string; icon: any }> = {
  companion: { ru: "Спутник Аида", en: "Aida companion", icon: "heart-outline" },
  readiness: { ru: "Готовность аналитики", en: "Analytics readiness", icon: "analytics-outline" },
  next_medication: { ru: "Ближайшее лекарство", en: "Next medication", icon: "medkit-outline" },
  recent_symptom: { ru: "Последний симптом", en: "Recent symptom", icon: "pulse-outline" },
  latest_lab: { ru: "Последний анализ", en: "Latest lab result", icon: "water-outline" },
  quests: { ru: "Квесты", en: "Quests", icon: "trophy-outline" },
  quick_note: { ru: "Быстрая заметка", en: "Quick note", icon: "create-outline" },
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, activeProfile, refreshTick } = useApp();
  const { t, lang } = useI18n();
  const { openMenu, openLab, toast } = useLog();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readiness, setReadiness] = useState<{ overall: number; scores: Record<string, number> } | null>(null);
  const [game, setGame] = useState<any>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [labs, setLabs] = useState<LabTest[]>([]);
  const [widgets, setWidgets] = useState<PuzzleWidget[]>([]);
  const [overview, setOverview] = useState<{ attention: any[]; ai_summary: string | null } | null>(null);
  const [customize, setCustomize] = useState(false);

  const normalizeWidgets = (items: any[]): PuzzleWidget[] =>
    (items || [])
      .map((w: any) => ({
        id: w.id,
        enabled: w.enabled !== false,
        show_on_home: w.show_on_home !== false,
        order: Number.isFinite(w.order) ? w.order : 0,
        allow_ai_analytics: w.allow_ai_analytics !== false,
        notifications: w.notifications === true,
      }))
      .sort((a, b) => a.order - b.order);

  const load = useCallback(async () => {
    if (!activeId) {
      setLoading(false);
      return;
    }
    try {
      const [r, g, m, s, l, p] = await Promise.all([
        api.readiness(activeId),
        api.gamification(activeId),
        api.listMeds(activeId),
        api.listSymptoms(activeId),
        api.listLabs(activeId),
        api.getPuzzle(activeId),
      ]);
      setReadiness(r);
      setGame(g);
      setMeds(m);
      setSymptoms(s);
      setLabs(l);
      setWidgets(normalizeWidgets(p.widgets || []));
    } catch (e) {
      // Widgets keep honest empty states when a request is unavailable.
    } finally {
      setLoading(false);
    }
    api.overview(activeId, lang).then(setOverview).catch(() => setOverview(null));
  }, [activeId, lang]);

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

  const persistWidgets = async (next: PuzzleWidget[]) => {
    const normalized = next
      .sort((a, b) => a.order - b.order)
      .map((w, index) => ({ ...w, order: index }));
    setWidgets(normalized);
    if (activeId) await api.savePuzzle(activeId, normalized).catch(() => {});
  };

  const patchWidget = async (id: string, patch: Partial<PuzzleWidget>) => {
    await persistWidgets(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const moveWidget = async (id: string, direction: -1 | 1) => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((w) => w.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    await persistWidgets(sorted.map((w, i) => ({ ...w, order: i })));
  };

  const { inRange, outRange, biomarkerCount } = useMemo(() => {
    let inR = 0;
    let outR = 0;
    let total = 0;
    labs.forEach((l) =>
      l.biomarkers.forEach((b) => {
        total += 1;
        if (b.status === "high" || b.status === "low") outR += 1;
        else if (b.status === "normal") inR += 1;
      })
    );
    return { inRange: inR, outRange: outR, biomarkerCount: total };
  }, [labs]);

  const hasLabData = biomarkerCount > 0;
  const hasClinicalData = hasLabData || meds.length > 0 || symptoms.length > 0;
  const activeMed = meds.find((m) => m.active) || meds[0];
  const lastSymptom = symptoms[0];
  const lastLab = labs[0];

  const readinessConfig = widgets.find((w) => w.id === "readiness");
  const readinessOn = (readinessConfig?.enabled ?? true) && (readinessConfig?.show_on_home ?? true);
  const aiAnalyticsOn = widgets.some((w) => w.enabled && w.allow_ai_analytics);

  const renderWidget = (id: string) => {
    switch (id) {
      case "readiness":
        return null;
      case "companion":
        return <CompanionWidget key={id} game={game} />;
      case "next_medication":
        return (
          <Card key={id} testID="widget-medication" style={styles.halfCard}>
            <WidgetHeader icon="medkit-outline" label={t("next_medication")} />
            {activeMed ? (
              <>
                <Title numberOfLines={1}>{activeMed.name}</Title>
                <Muted style={{ marginTop: 2 }} numberOfLines={1}>{[activeMed.dose, activeMed.schedule].filter(Boolean).join(" · ") || "—"}</Muted>
              </>
            ) : <Muted>{t("no_active_meds")}</Muted>}
          </Card>
        );
      case "recent_symptom":
        return (
          <Card key={id} testID="widget-symptom" style={styles.halfCard}>
            <WidgetHeader icon="pulse-outline" label={t("recent_symptom")} />
            {lastSymptom ? (
              <>
                <Title numberOfLines={1}>{lastSymptom.name}</Title>
                <View style={styles.sevInline}><View style={styles.sevBadge}><Text style={styles.sevBadgeText}>{lastSymptom.severity}/10</Text></View></View>
              </>
            ) : <Muted>{t("none_yet")}</Muted>}
          </Card>
        );
      case "latest_lab":
        return (
          <Card key={id} testID="widget-lab">
            <WidgetHeader icon="water-outline" label={t("latest_lab")} />
            {lastLab ? (
              <>
                <Title>{lastLab.title}</Title>
                <Muted style={{ marginTop: 2 }}>{lastLab.date} · {lastLab.biomarkers.length} {t("biomarkers")}</Muted>
                <View style={styles.bioTags}>{lastLab.biomarkers.slice(0, 3).map((b, i) => <View key={i} style={styles.bioTag}><View style={[styles.dot, { backgroundColor: statusColor(b.status) }]} /><Text style={styles.bioTagText}>{b.name} {b.value}</Text></View>)}</View>
              </>
            ) : <Muted>{t("none_yet")}</Muted>}
          </Card>
        );
      case "quests":
        return (
          <Card key={id} testID="widget-quests">
            <WidgetHeader icon="trophy-outline" label={t("quests")} />
            {(game?.quests || []).map((q: any) => <View key={q.id} style={styles.questRow}><Ionicons name={q.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={q.done ? colors.success : colors.onSurfaceSecondary} /><Text style={[styles.questText, q.done && styles.questDone]}>{lang === "ru" ? q.title : q.title_en}</Text><Tag label={`+${q.xp}`} /></View>)}
          </Card>
        );
      case "quick_note":
        return <Card key={id} testID="widget-note" onPress={openMenu}><WidgetHeader icon="create-outline" label={t("quick_note")} /><Muted>{lang === "ru" ? "Нажмите, чтобы добавить данные" : "Tap to add data"}</Muted></Card>;
      default:
        return null;
    }
  };

  const enabledWidgets = widgets.filter((w) => w.enabled && w.show_on_home && w.id !== "readiness");
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < enabledWidgets.length; i++) {
    const w = enabledWidgets[i];
    const isHalf = w.id === "next_medication" || w.id === "recent_symptom";
    const nextW = enabledWidgets[i + 1];
    const nextHalf = nextW && (nextW.id === "next_medication" || nextW.id === "recent_symptom");
    if (isHalf && nextHalf) {
      rows.push(<View key={`row-${i}`} style={styles.halfRow}>{renderWidget(w.id)}{renderWidget(nextW!.id)}</View>);
      i++;
    } else rows.push(renderWidget(w.id));
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}><TopBar subtitle={`${t("hello")}, ${activeProfile?.name || ""} · ${t("home_subtitle")}`} /></View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}>
          {!hasClinicalData && (
            <GradientCard gradient={gradients.warm} style={styles.emptyHero} testID="home-empty-state">
              <View style={styles.emptyIcon}><Ionicons name="sparkles-outline" size={22} color={colors.onSurface} /></View>
              <Text style={styles.emptyTitle}>{lang === "ru" ? "Начнём собирать картину здоровья" : "Let’s build your health picture"}</Text>
              <Text style={styles.emptyText}>{lang === "ru" ? "Добавьте первый анализ, измерение или запись. До этого Аида не будет показывать оценки и выводы." : "Add your first lab, measurement or health entry. Until then Aida will not show scores or conclusions."}</Text>
              <Pressable style={styles.emptyAction} onPress={() => openLab()} testID="empty-upload-lab"><Ionicons name="cloud-upload-outline" size={18} color={colors.onSurfaceInverse} /><Text style={styles.emptyActionText}>{lang === "ru" ? "Загрузить первый анализ" : "Upload first lab"}</Text></Pressable>
            </GradientCard>
          )}

          {hasLabData && <View style={styles.statStrip}><View style={styles.statPill}><Text style={styles.statNum}>{inRange}</Text><View style={[styles.statTag, { backgroundColor: colors.accent }]}><Text style={styles.statTagText}>{lang === "ru" ? "В норме" : "In range"}</Text></View></View><View style={styles.statPill}><Text style={styles.statNum}>{outRange}</Text><View style={[styles.statTag, { backgroundColor: "#F6D8CE" }]}><Text style={[styles.statTagText, { color: colors.error }]}>{lang === "ru" ? "Вне нормы" : "Out of range"}</Text></View></View></View>}

          {readinessOn && hasClinicalData && readiness && <GradientCard gradient={gradients.warm} style={styles.hero} testID="hero-readiness"><Text style={styles.heroLabel}>{t("readiness")}</Text><Text style={styles.heroNum}>{readiness.overall}%</Text><Text style={styles.heroSub}>{t("readiness_hint")}</Text><View style={styles.heroBar}><View style={{ width: `${readiness.overall}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 3 }} /></View></GradientCard>}
          {aiAnalyticsOn && hasClinicalData && overview?.ai_summary ? <GradientCard gradient={gradients.lime} style={{ marginBottom: spacing.md }} testID="ai-day-card"><View style={styles.aiHead}><Ionicons name="sparkles" size={16} color={colors.onSurface} /><Text style={styles.aiHeadText}>{t("ai_day")}</Text></View><Text style={styles.aiText}>{overview.ai_summary}</Text></GradientCard> : null}

          {hasClinicalData && <Card style={{ marginBottom: spacing.md }} testID="attention-card"><WidgetHeader icon="alert-circle-outline" label={t("needs_attention")} />{overview && overview.attention.length > 0 ? overview.attention.map((a, i) => <Pressable key={i} style={styles.attnRow} testID={`attention-${i}`} onPress={() => router.push((a.type === "bp" ? "/pressure" : a.type === "symptom" ? "/history" : "/labs") as any)}><View style={[styles.attnDot, { backgroundColor: a.severity === "error" ? colors.error : colors.warning }]} /><View style={{ flex: 1 }}><Text style={styles.attnTitle}>{a.title}</Text>{a.subtitle ? <Muted>{a.subtitle}</Muted> : null}</View><Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /></Pressable>) : overview ? <View style={styles.allGood}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Muted style={{ flex: 1 }}>{t("all_good")}</Muted></View> : <View style={styles.neutralState}><Ionicons name="information-circle-outline" size={20} color={colors.onSurfaceSecondary} /><Muted style={{ flex: 1 }}>{lang === "ru" ? "Вывод появится, когда Аида получит достаточно данных" : "Insights will appear when Aida has enough data"}</Muted></View>}</Card>}

          <View style={styles.dualRow}><Card style={styles.dualCard} onPress={() => openLab()} testID="upload-records-card"><View style={styles.plusRow}><Ionicons name="cloud-upload-outline" size={22} color={colors.onSurface} /><View style={styles.plusBtn}><Ionicons name="add" size={18} color={colors.onSurface} /></View></View><Text style={styles.dualTitle}>{t("upload_lab")}</Text><Muted numberOfLines={1}>{labs.length > 0 ? `${labs.length} ${t("labs").toLowerCase()}` : (lang === "ru" ? "Анализов пока нет" : "No labs yet")}</Muted></Card><GradientCard gradient={gradients.pink} style={styles.dualCard} onPress={() => toast(lang === "ru" ? "Подключение устройств — скоро" : "Device sync — coming soon")} testID="connect-device-card"><View style={styles.plusRow}><Ionicons name="watch-outline" size={22} color={colors.onSurface} /><View style={styles.plusBtn}><Ionicons name="add" size={18} color={colors.onSurface} /></View></View><Text style={styles.dualTitle}>{lang === "ru" ? "Подключить устройство" : "Connect tracker"}</Text><Muted numberOfLines={1} style={{ color: "rgba(27,27,29,0.55)" }}>Apple Watch · Xiaomi</Muted></GradientCard></View>
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>{rows}</View>
          <Pressable style={styles.customizeBtn} onPress={() => setCustomize(true)} testID="customize-button"><Ionicons name="options-outline" size={18} color={colors.onSurface} /><Text style={styles.customizeText}>{t("customize")}</Text></Pressable>
        </ScrollView>
      )}

      <Sheet visible={customize} onClose={() => setCustomize(false)} testID="customize-sheet" scroll>
        <Text style={styles.customizeTitle}>{t("customize")}</Text>
        <Muted style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>{lang === "ru" ? "Выберите, что работает, что видно на Главной и какие функции может использовать Аида." : "Choose what is active, visible on Home and available to Aida."}</Muted>
        {widgets.map((w, index) => {
          const meta = WIDGET_LABELS[w.id];
          if (!meta) return null;
          return (
            <View key={w.id} style={styles.configCard} testID={`config-${w.id}`}>
              <View style={styles.configHeader}>
                <View style={styles.configIcon}><Ionicons name={meta.icon} size={19} color={colors.onSurface} /></View>
                <View style={{ flex: 1 }}><Text style={styles.configTitle}>{lang === "ru" ? meta.ru : meta.en}</Text><Text style={styles.configOrder}>{lang === "ru" ? `Позиция ${index + 1}` : `Position ${index + 1}`}</Text></View>
                <View style={styles.orderButtons}>
                  <Pressable disabled={index === 0} onPress={() => moveWidget(w.id, -1)} style={[styles.orderButton, index === 0 && styles.orderDisabled]} testID={`move-up-${w.id}`}><Ionicons name="chevron-up" size={18} color={colors.onSurface} /></Pressable>
                  <Pressable disabled={index === widgets.length - 1} onPress={() => moveWidget(w.id, 1)} style={[styles.orderButton, index === widgets.length - 1 && styles.orderDisabled]} testID={`move-down-${w.id}`}><Ionicons name="chevron-down" size={18} color={colors.onSurface} /></Pressable>
                </View>
              </View>

              <ConfigToggle label={lang === "ru" ? "Модуль включён" : "Module enabled"} value={w.enabled} onChange={(value) => patchWidget(w.id, { enabled: value })} testID={`enabled-${w.id}`} />
              <ConfigToggle label={lang === "ru" ? "Показывать на Главной" : "Show on Home"} value={w.show_on_home} disabled={!w.enabled} onChange={(value) => patchWidget(w.id, { show_on_home: value })} testID={`home-${w.id}`} />
              <ConfigToggle label={lang === "ru" ? "Разрешить AI-аналитику" : "Allow AI analytics"} value={w.allow_ai_analytics} disabled={!w.enabled} onChange={(value) => patchWidget(w.id, { allow_ai_analytics: value })} testID={`ai-${w.id}`} />
              <ConfigToggle label={lang === "ru" ? "Уведомления" : "Notifications"} value={w.notifications} disabled={!w.enabled} onChange={(value) => patchWidget(w.id, { notifications: value })} testID={`notifications-${w.id}`} last />
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}

const ConfigToggle: React.FC<{ label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; testID: string; last?: boolean }> = ({ label, value, onChange, disabled, testID, last }) => (
  <View style={[styles.configToggle, last && styles.configToggleLast, disabled && styles.configDisabled]}>
    <Text style={styles.configToggleLabel}>{label}</Text>
    <Switch testID={testID} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.surfaceTertiary }} thumbColor={colors.surfaceSecondary} />
  </View>
);

const WidgetHeader: React.FC<{ icon: any; label: string }> = ({ icon, label }) => <View style={styles.widgetHeader}><Ionicons name={icon} size={15} color={colors.onSurfaceSecondary} /><Text style={styles.widgetHeaderText}>{label}</Text></View>;

const CompanionWidget: React.FC<{ game: any }> = ({ game }) => {
  const { t } = useI18n();
  const pct = game ? (game.xp_in_level / game.next_threshold) * 100 : 0;
  return <GradientCard gradient={gradients.lime} testID="widget-companion"><View style={styles.companionRow}><Image source={{ uri: COMPANION_IMG }} style={styles.companionImg} contentFit="cover" /><View style={{ flex: 1 }}><Text style={styles.companionName}>{t("companion")}</Text><View style={styles.levelRow}><View style={styles.levelBadge}><Text style={styles.levelBadgeText}>{t("level")} {game?.level ?? 1}</Text></View><Text style={styles.xpText}>{game?.xp ?? 0} XP</Text></View><View style={{ marginTop: spacing.sm }}><View style={styles.companionBar}><View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 4 }} /></View></View><Text style={styles.companionHint}>{game?.xp_to_next ?? 0} {t("xp_to_next")} {(game?.level ?? 1) + 1}</Text></View></View></GradientCard>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyHero: { marginBottom: spacing.md, paddingVertical: spacing.xl },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  emptyTitle: { fontSize: fontSize.xl, lineHeight: 28, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, letterSpacing: -0.4 },
  emptyText: { marginTop: spacing.sm, fontSize: fontSize.base, lineHeight: 22, color: "rgba(27,27,29,0.62)", fontFamily: fonts.text },
  emptyAction: { marginTop: spacing.lg, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill },
  emptyActionText: { color: colors.onSurfaceInverse, fontWeight: "700", fontSize: fontSize.base, fontFamily: fonts.text },
  statStrip: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statPill: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.glassBorder },
  statNum: { fontSize: fontSize["4xl"], fontWeight: "800", color: colors.onSurface, letterSpacing: -1, fontFamily: fonts.display },
  statTag: { alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginTop: 4 },
  statTagText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onAccent, fontFamily: fonts.text },
  hero: { marginBottom: spacing.md, paddingVertical: spacing.xl },
  heroLabel: { fontSize: fontSize.base, fontWeight: "600", color: "rgba(27,27,29,0.6)", fontFamily: fonts.text },
  heroNum: { fontSize: 64, fontWeight: "800", color: colors.onSurface, letterSpacing: -2, marginTop: 4, fontFamily: fonts.display },
  heroSub: { fontSize: fontSize.base, color: "rgba(27,27,29,0.6)", marginTop: 2, fontFamily: fonts.text },
  heroBar: { height: 6, backgroundColor: "rgba(27,27,29,0.15)", borderRadius: 3, marginTop: spacing.lg, overflow: "hidden" },
  dualRow: { flexDirection: "row", gap: spacing.md },
  dualCard: { flex: 1, minHeight: 130, justifyContent: "space-between" },
  plusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  plusBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" },
  dualTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.lg, fontFamily: fonts.text, letterSpacing: -0.2 },
  widgetHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  aiHeadText: { fontSize: fontSize.sm, color: colors.onSurface, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: fonts.text },
  aiText: { fontSize: fontSize.base, color: colors.onSurface, lineHeight: 21, fontFamily: fonts.text },
  attnRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  attnDot: { width: 10, height: 10, borderRadius: 5 },
  attnTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  allGood: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  neutralState: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  widgetHeaderText: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontWeight: "600", fontFamily: fonts.text },
  halfRow: { flexDirection: "row", gap: spacing.md },
  halfCard: { flex: 1, minHeight: 110 },
  sevInline: { flexDirection: "row", marginTop: spacing.sm },
  sevBadge: { backgroundColor: "#F6D8CE", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  sevBadgeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.error, fontFamily: fonts.text },
  bioTags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  bioTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  bioTagText: { fontSize: fontSize.sm, color: colors.onSurface, fontFamily: fonts.text },
  dot: { width: 8, height: 8, borderRadius: 4 },
  questRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 7 },
  questText: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  questDone: { color: colors.onSurfaceSecondary, textDecorationLine: "line-through" },
  companionRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  companionImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.5)" },
  companionName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 4 },
  levelBadge: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill },
  levelBadgeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  xpText: { fontSize: fontSize.sm, fontWeight: "700", color: "rgba(27,27,29,0.6)", fontFamily: fonts.text },
  companionBar: { height: 8, backgroundColor: "rgba(27,27,29,0.15)", borderRadius: 4, overflow: "hidden" },
  companionHint: { fontSize: fontSize.sm, color: "rgba(27,27,29,0.6)", marginTop: 6, fontFamily: fonts.text },
  customizeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, paddingVertical: spacing.md },
  customizeText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  customizeTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.display },
  configCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  configHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md },
  configIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  configTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  configOrder: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  orderButtons: { flexDirection: "row", gap: 6 },
  orderButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  orderDisabled: { opacity: 0.28 },
  configToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.divider },
  configToggleLast: { paddingBottom: 0 },
  configToggleLabel: { flex: 1, paddingRight: spacing.md, fontSize: fontSize.sm, color: colors.onSurface, fontFamily: fonts.text },
  configDisabled: { opacity: 0.45 },
});