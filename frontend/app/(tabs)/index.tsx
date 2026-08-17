import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { Card, GradientCard, Title, Muted, Tag, PrimaryButton } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { ReadinessProgressCard } from "@/src/components/ReadinessProgressCard";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { api, Medication, Symptom, LabTest, Task } from "@/src/api";
import { getHome } from "@/src/homeApi";
import { getMedicationDay, markMedicationIntake, MedicationSlot } from "@/src/medicationScheduleApi";
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

const TASK_ROUTES: Record<string, string | undefined> = {
  medication: "/medications",
  pressure: "/pressure",
  diary: "/mind",
  lab: "/labs",
  upload: "/documents",
  visit: "/medical-card",
  measurement: "/measurements",
};

const CHECKIN_METRICS = [
  { key: "mood", ru: "Настроение", en: "Mood", icon: "happy-outline" as const, invert: false },
  { key: "energy", ru: "Энергия", en: "Energy", icon: "flash-outline" as const, invert: false },
  { key: "stress", ru: "Стресс", en: "Stress", icon: "thunderstorm-outline" as const, invert: true },
  { key: "anxiety", ru: "Тревога", en: "Anxiety", icon: "pulse-outline" as const, invert: true },
  { key: "sleep", ru: "Сон", en: "Sleep", icon: "moon-outline" as const, invert: false },
];

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const scaleColor = (value: number, invert = false) => {
  const good = invert ? value <= 2 : value >= 4;
  const bad = invert ? value >= 4 : value <= 2;
  if (good) return colors.success;
  if (bad) return colors.error;
  return colors.warning;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, activeProfile, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();
  const { openMenu, openLab, toast } = useLog();
  const responsive = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readiness, setReadiness] = useState<{ overall: number; scores: Record<string, number> } | null>(null);
  const [game, setGame] = useState<any>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [labs, setLabs] = useState<LabTest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [medicationSlots, setMedicationSlots] = useState<MedicationSlot[]>([]);
  const [tasksAvailable, setTasksAvailable] = useState(false);
  const [medScheduleAvailable, setMedScheduleAvailable] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<PuzzleWidget[]>([]);
  const [overview, setOverview] = useState<{ attention: any[]; ai_summary: string | null } | null>(null);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinVals, setCheckinVals] = useState<Record<string, number>>({ mood: 3, energy: 3, stress: 3, anxiety: 3, sleep: 3 });
  const [checkinTriggers, setCheckinTriggers] = useState("");

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

  const clearHome = useCallback(() => {
    setReadiness(null);
    setGame(null);
    setMeds([]);
    setSymptoms([]);
    setLabs([]);
    setTasks([]);
    setMedicationSlots([]);
    setTasksAvailable(false);
    setMedScheduleAvailable(false);
    setWidgets([]);
    setOverview(null);
  }, []);

  const load = useCallback(async () => {
    if (!activeId) {
      clearHome();
      setLoading(false);
      return;
    }

    const today = localDateString();
    try {
      const home = await getHome(activeId, today, lang);
      setReadiness(home.readiness.state === "data" && home.readiness.value !== null
        ? { overall: home.readiness.value, scores: home.readiness.scores || {} }
        : null);
      setGame(home.gamification.state === "data" ? (home.gamification.value ?? null) : null);
      setMeds(home.medications.items || []);
      setSymptoms(home.symptoms.items || []);
      setLabs(home.labs.items || []);
      setWidgets(home.puzzle.state !== "error" ? normalizeWidgets(home.puzzle.value?.widgets || []) : []);
      setOverview(home.overview.state !== "error"
        ? { attention: home.overview.attention || [], ai_summary: home.overview.ai_summary || null }
        : null);
      setTasks(home.tasks.items || []);
      setTasksAvailable(home.tasks.state !== "error");
      setMedicationSlots(home.medication_day.slots || []);
      setMedScheduleAvailable(home.medication_day.state !== "error");
    } catch (_) {
      clearHome();
    } finally {
      setLoading(false);
    }
  }, [activeId, lang, clearHome]);

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

  const { inRange, outRange } = useMemo(() => {
    let inR = 0;
    let outR = 0;
    labs.forEach((l) =>
      l.biomarkers.forEach((b) => {
        if (b.status === "high" || b.status === "low") outR += 1;
        else if (b.status === "normal") inR += 1;
      })
    );
    return { inRange: inR, outRange: outR };
  }, [labs]);

  const todayKey = localDateString();
  const todayTasks = useMemo(
    () => tasks
      .filter((task) => !task.done && task.status !== "cancelled")
      .filter((task) => (task.due || todayKey).slice(0, 10) <= todayKey)
      .slice(0, 4),
    [tasks, todayKey]
  );
  const todayMedicationSlots = medicationSlots.slice(0, 4);

  const activeMed = meds.find((m) => m.active) || null;
  const lastSymptom = symptoms[0];
  const lastLab = labs[0];
  const hasLabStatusData = inRange + outRange > 0;
  const readinessScores = readiness ? Object.values(readiness.scores || {}) : [];
  const hasReadinessData = !!readiness && readinessScores.some((score) => Number.isFinite(score) && score > 0);
  const hasHealthEvidence = hasLabStatusData || !!lastSymptom || !!activeMed || hasReadinessData;

  const readinessConfig = widgets.find((w) => w.id === "readiness");
  const readinessOn = (readinessConfig?.enabled ?? true) && (readinessConfig?.show_on_home ?? true);
  const aiAnalyticsOn = widgets.some((w) => w.enabled && w.allow_ai_analytics);

  const toggleTodayTask = async (task: Task) => {
    if (actionBusy) return;
    setActionBusy(`task-${task.id}`);
    setTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, done: true, status: "done" } : item));
    try {
      const updated = await api.toggleTask(task.id);
      setTasks((prev) => prev.map((item) => item.id === task.id ? updated : item));
      bumpRefresh();
    } catch (_) {
      await load();
    } finally {
      setActionBusy(null);
    }
  };

  const markMedication = async (slot: MedicationSlot) => {
    if (!activeId || slot.status !== "pending" || actionBusy) return;
    setActionBusy(`med-${slot.id}`);
    try {
      await markMedicationIntake(slot.medication_id, slot.scheduled_at, "taken");
      const day = await getMedicationDay(activeId, todayKey);
      setMedicationSlots(day.slots || []);
      bumpRefresh();
    } catch (_) {
      await load();
    } finally {
      setActionBusy(null);
    }
  };

  const openTaskAction = (task: Task) => {
    const route = task.action_route || TASK_ROUTES[task.kind];
    if (route) router.push(route as any);
  };

  const saveQuickCheckin = async () => {
    if (!activeId || checkinSaving) return;
    setCheckinSaving(true);
    try {
      await api.createCheckin({
        profile_id: activeId,
        ...checkinVals,
        triggers: checkinTriggers.trim() || null,
      });
      setCheckinVals({ mood: 3, energy: 3, stress: 3, anxiety: 3, sleep: 3 });
      setCheckinTriggers("");
      setCheckinOpen(false);
      bumpRefresh();
      toast(lang === "ru" ? "Самочувствие сохранено" : "Check-in saved");
    } catch (_) {
      toast(lang === "ru" ? "Не удалось сохранить. Попробуйте ещё раз" : "Could not save. Try again");
    } finally {
      setCheckinSaving(false);
    }
  };

  const renderWidget = (id: string) => {
    switch (id) {
      case "readiness":
        return null;
      case "companion":
        return <CompanionWidget key={id} game={game} />;
      case "next_medication":
        return (
          <Card key={id} testID="widget-medication" style={[styles.halfCard, responsive.width < 480 && styles.fullWidthCard]}>
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
          <Card key={id} testID="widget-symptom" style={[styles.halfCard, responsive.width < 480 && styles.fullWidthCard]}>
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
            {game?.quests?.length ? (game.quests || []).map((q: any) => <View key={q.id} style={styles.questRow}><Ionicons name={q.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={q.done ? colors.success : colors.onSurfaceSecondary} /><Text style={[styles.questText, q.done && styles.questDone]}>{lang === "ru" ? q.title : q.title_en}</Text><Tag label={`+${q.xp}`} /></View>) : <Muted>{t("not_enough_data")}</Muted>}
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
      rows.push(<View key={`row-${i}`} style={[styles.halfRow, responsive.width < 480 && styles.stackRow]}>{renderWidget(w.id)}{renderWidget(nextW!.id)}</View>);
      i++;
    } else rows.push(renderWidget(w.id));
  }

  const todayHasItems = todayMedicationSlots.length > 0 || todayTasks.length > 0;
  const todaySourcesAvailable = tasksAvailable || medScheduleAvailable;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: responsive.contentPadding }]}><TopBar subtitle={`${t("hello")}, ${activeProfile?.name || ""} · ${t("home_subtitle")}`} /></View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: responsive.contentPadding, paddingTop: spacing.lg, paddingBottom: (responsive.isDesktop ? 40 : 96) + insets.bottom }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}>
          <View style={styles.statStrip}><View style={styles.statPill}><Text style={styles.statNum}>{hasLabStatusData ? inRange : "—"}</Text><View style={[styles.statTag, { backgroundColor: colors.accent }]}><Text style={styles.statTagText}>{lang === "ru" ? "В норме" : "In range"}</Text></View></View><View style={styles.statPill}><Text style={styles.statNum}>{hasLabStatusData ? outRange : "—"}</Text><View style={[styles.statTag, { backgroundColor: "#F6D8CE" }]}><Text style={[styles.statTagText, { color: colors.error }]}>{lang === "ru" ? "Вне нормы" : "Out of range"}</Text></View></View></View>
          {readinessOn && <ReadinessProgressCard activeId={activeId} profile={activeProfile} readiness={readiness} hasReadinessData={hasReadinessData} labs={labs} symptoms={symptoms} onOpenLab={openLab} onOpenCheckin={() => setCheckinOpen(true)} onNavigate={(route) => router.push(route as any)} />}
          {aiAnalyticsOn && overview?.ai_summary ? <GradientCard gradient={gradients.lime} style={{ marginBottom: spacing.md }} testID="ai-day-card"><View style={styles.aiHead}><Ionicons name="sparkles" size={16} color={colors.onSurface} /><Text style={styles.aiHeadText}>{t("ai_day")}</Text></View><Text style={styles.aiText}>{overview.ai_summary}</Text></GradientCard> : null}
          <Card style={{ marginBottom: spacing.md }} testID="attention-card"><WidgetHeader icon="alert-circle-outline" label={t("needs_attention")} />{overview?.attention?.length ? overview.attention.map((a, i) => <Pressable key={i} style={styles.attnRow} testID={`attention-${i}`} onPress={() => router.push((a.type === "bp" ? "/pressure" : a.type === "symptom" ? "/history" : "/labs") as any)}><View style={[styles.attnDot, { backgroundColor: a.severity === "error" ? colors.error : colors.warning }]} /><View style={{ flex: 1 }}><Text style={styles.attnTitle}>{a.title}</Text>{a.subtitle ? <Muted>{a.subtitle}</Muted> : null}</View><Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /></Pressable>) : hasHealthEvidence && overview ? <View style={styles.allGood}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Muted style={{ flex: 1 }}>{t("all_good")}</Muted></View> : <View style={styles.neutralState}><Ionicons name="information-circle-outline" size={20} color={colors.onSurfaceSecondary} /><Muted style={{ flex: 1 }}>{t("not_enough_data")}</Muted></View>}</Card>

          <Card style={{ marginBottom: spacing.md }} testID="today-card">
            <View style={styles.todayHeader}>
              <WidgetHeader icon="calendar-outline" label={t("today")} />
              <Pressable onPress={() => router.push("/(tabs)/tasks" as any)} hitSlop={8} testID="today-all-tasks">
                <Text style={styles.todayLinkText}>{lang === "ru" ? "Все задачи" : "All tasks"}</Text>
              </Pressable>
            </View>
            {!todaySourcesAvailable ? (
              <View style={styles.neutralState}><Ionicons name="cloud-offline-outline" size={20} color={colors.onSurfaceSecondary} /><Muted style={{ flex: 1 }}>{lang === "ru" ? "Не удалось загрузить действия на сегодня" : "Today's actions could not be loaded"}</Muted></View>
            ) : !todayHasItems ? (
              <View style={styles.neutralState}><Ionicons name="checkmark-circle-outline" size={20} color={colors.onSurfaceSecondary} /><Muted style={{ flex: 1 }}>{lang === "ru" ? "На сегодня действий нет" : "No actions for today"}</Muted></View>
            ) : (
              <View>
                {todayMedicationSlots.map((slot, index) => {
                  const taken = slot.status === "taken";
                  const skipped = slot.status === "skipped";
                  const busy = actionBusy === `med-${slot.id}`;
                  return (
                    <View key={`med-${slot.id}`} style={[styles.todayRow, index > 0 && styles.todayDivider]} testID={`today-med-${slot.id}`}>
                      <View style={styles.todayIcon}><Ionicons name={taken ? "checkmark" : "medkit-outline"} size={17} color={colors.onSurface} /></View>
                      <Pressable style={styles.todayCopy} onPress={() => router.push("/medications" as any)}>
                        <Text style={styles.todayTitle} numberOfLines={1}>{slot.name}</Text>
                        <Text style={styles.todayMeta}>{[slot.time, slot.dose, slot.meal_relation && slot.meal_relation !== "any" ? slot.meal_relation : null].filter(Boolean).join(" · ")}</Text>
                      </Pressable>
                      {slot.status === "pending" ? (
                        <Pressable style={styles.todayAction} onPress={() => markMedication(slot)} disabled={busy} testID={`today-take-${slot.id}`}>
                          {busy ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> : <Text style={styles.todayActionText}>{lang === "ru" ? "Принять" : "Take"}</Text>}
                        </Pressable>
                      ) : <Text style={styles.todayStatusText}>{taken ? (lang === "ru" ? "Принято" : "Taken") : skipped ? (lang === "ru" ? "Пропущено" : "Skipped") : slot.status}</Text>}
                    </View>
                  );
                })}
                {todayTasks.map((task, index) => {
                  const route = task.action_route || TASK_ROUTES[task.kind];
                  const busy = actionBusy === `task-${task.id}`;
                  return (
                    <View key={`task-${task.id}`} style={[styles.todayRow, (todayMedicationSlots.length > 0 || index > 0) && styles.todayDivider]} testID={`today-task-${task.id}`}>
                      <Pressable style={styles.todayIcon} onPress={() => toggleTodayTask(task)} disabled={busy} testID={`today-toggle-${task.id}`}>
                        {busy ? <ActivityIndicator size="small" color={colors.onSurfaceSecondary} /> : <Ionicons name="ellipse-outline" size={19} color={colors.onSurfaceSecondary} />}
                      </Pressable>
                      <Pressable style={styles.todayCopy} disabled={!route} onPress={() => openTaskAction(task)}>
                        <Text style={styles.todayTitle} numberOfLines={2}>{task.title}</Text>
                        <Text style={styles.todayMeta}>{[task.due?.slice(0, 10), task.reminder_at?.slice(11, 16)].filter(Boolean).join(" · ") || (lang === "ru" ? "Задача здоровья" : "Health task")}</Text>
                      </Pressable>
                      {route ? <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <Card style={{ marginBottom: spacing.md }} onPress={() => setCheckinOpen(true)} testID="quick-checkin-card">
            <View style={styles.quickCheckinRow}>
              <View style={styles.quickCheckinIcon}><Ionicons name="happy-outline" size={19} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickCheckinTitle}>{lang === "ru" ? "Быстрый check-in" : "Quick check-in"}</Text>
                <Muted>{lang === "ru" ? "Настроение, энергия, стресс, тревога и сон" : "Mood, energy, stress, anxiety and sleep"}</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </View>
          </Card>

          <View style={[styles.dualRow, responsive.width < 480 && styles.stackRow]}><Card style={[styles.dualCard, responsive.width < 480 && styles.fullWidthCard]} onPress={() => openLab()} testID="upload-records-card"><View style={styles.plusRow}><Ionicons name="cloud-upload-outline" size={22} color={colors.onSurface} /><View style={styles.plusBtn}><Ionicons name="add" size={18} color={colors.onSurface} /></View></View><Text style={styles.dualTitle}>{t("upload_lab")}</Text><Muted numberOfLines={1}>{labs.length > 0 ? `${labs.length} ${t("labs").toLowerCase()}` : (lang === "ru" ? "Анализов пока нет" : "No labs yet")}</Muted></Card><GradientCard gradient={gradients.pink} style={[styles.dualCard, responsive.width < 480 && styles.fullWidthCard]} onPress={() => router.push("/devices")} testID="connect-device-card"><View style={styles.plusRow}><Ionicons name="watch-outline" size={22} color={colors.onSurface} /><View style={styles.plusBtn}><Ionicons name="add" size={18} color={colors.onSurface} /></View></View><Text style={styles.dualTitle}>{lang === "ru" ? "Подключить устройство" : "Connect tracker"}</Text><Muted numberOfLines={1} style={{ color: "rgba(27,27,29,0.55)" }}>Apple Watch · Xiaomi</Muted></GradientCard></View>
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>{rows}</View>
        </ScrollView>
      )}

      <Sheet visible={checkinOpen} onClose={() => setCheckinOpen(false)} testID="home-checkin-sheet" scroll>
        <Text style={styles.sheetTitle}>{lang === "ru" ? "Как вы себя чувствуете?" : "How are you feeling?"}</Text>
        <Muted style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>{lang === "ru" ? "Оцените каждый показатель от 1 до 5. Запись попадёт в дневник психики." : "Rate each metric from 1 to 5. The entry will be saved to your wellbeing diary."}</Muted>
        {CHECKIN_METRICS.map((metric) => (
          <View key={metric.key} style={styles.checkinMetric}>
            <View style={styles.checkinMetricHead}>
              <Ionicons name={metric.icon} size={17} color={colors.onSurfaceSecondary} />
              <Text style={styles.checkinLabel}>{lang === "ru" ? metric.ru : metric.en}</Text>
            </View>
            <View style={styles.scaleRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const active = checkinVals[metric.key] === value;
                const activeColor = scaleColor(value, metric.invert);
                return (
                  <Pressable
                    key={value}
                    onPress={() => setCheckinVals((prev) => ({ ...prev, [metric.key]: value }))
                    style={[styles.scaleButton, active && { backgroundColor: activeColor, borderColor: activeColor }]}
                    testID={`home-checkin-${metric.key}-${value}`}
                  >
                    <Text style={[styles.scaleButtonText, active && { color: colors.onSurfaceInverse }]}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={styles.checkinLabel}>{lang === "ru" ? "Что повлияло? · необязательно" : "What affected you? · optional"}</Text>
        <TextInput
          value={checkinTriggers}
          onChangeText={setCheckinTriggers}
          multiline
          placeholder={lang === "ru" ? "Сон, работа, боль, событие…" : "Sleep, work, pain, event…"}
          placeholderTextColor={colors.onSurfaceSecondary}
          style={styles.checkinInput}
          testID="home-checkin-triggers"
        />
        <PrimaryButton label={lang === "ru" ? "Сохранить" : "Save"} onPress={saveQuickCheckin} loading={checkinSaving} testID="home-checkin-save" style={{ marginTop: spacing.md }} />
        <Pressable onPress={() => { setCheckinOpen(false); router.push("/mind" as any); }} style={styles.historyLink} testID="home-checkin-history">
          <Text style={styles.historyLinkText}>{lang === "ru" ? "Открыть дневник и историю" : "Open diary and history"}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const WidgetHeader: React.FC<{ icon: any; label: string }> = ({ icon, label }) => <View style={styles.widgetHeader}><Ionicons name={icon} size={15} color={colors.onSurfaceSecondary} /><Text style={styles.widgetHeaderText}>{label}</Text></View>;

const CompanionWidget: React.FC<{ game: any }> = ({ game }) => {
  const { t } = useI18n();
  if (!game) {
    return <GradientCard gradient={gradients.lime} testID="widget-companion"><View style={styles.companionRow}><Image source={{ uri: COMPANION_IMG }} style={styles.companionImg} contentFit="cover" /><View style={{ flex: 1 }}><Text style={styles.companionName}>{t("companion")}</Text><Muted style={{ marginTop: spacing.sm }}>{t("not_enough_data")}</Muted></View></View></GradientCard>;
  }
  const nextThreshold = Number(game.next_threshold) || 0;
  const xpInLevel = Number(game.xp_in_level) || 0;
  const pct = nextThreshold > 0 ? Math.max(0, Math.min(100, (xpInLevel / nextThreshold) * 100)) : 0;
  return <GradientCard gradient={gradients.lime} testID="widget-companion"><View style={styles.companionRow}><Image source={{ uri: COMPANION_IMG }} style={styles.companionImg} contentFit="cover" /><View style={{ flex: 1 }}><Text style={styles.companionName}>{t("companion")}</Text><View style={styles.levelRow}><View style={styles.levelBadge}><Text style={styles.levelBadgeText}>{t("level")} {game.level}</Text></View><Text style={styles.xpText}>{game.xp} XP</Text></View>{nextThreshold > 0 ? <><View style={{ marginTop: spacing.sm }}><View style={styles.companionBar}><View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 4 }} /></View></View><Text style={styles.companionHint}>{game.xp_to_next} {t("xp_to_next")} {Number(game.level) + 1}</Text></> : null}</View></View></GradientCard>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  stackRow: { flexDirection: "column" },
  fullWidthCard: { flex: 0, width: "100%" },
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
  todayHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  todayLinkText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  todayRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  todayDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  todayIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  todayCopy: { flex: 1, minWidth: 0 },
  todayTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  todayMeta: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  todayAction: { minWidth: 76, height: 34, borderRadius: radius.pill, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  todayActionText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  todayStatusText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  quickCheckinRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  quickCheckinIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  quickCheckinTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text, marginBottom: 2 },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.display },
  checkinMetric: { marginBottom: spacing.lg },
  checkinMetricHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: spacing.sm },
  checkinLabel: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface, fontFamily: fonts.text },
  scaleRow: { flexDirection: "row", gap: spacing.sm },
  scaleButton: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scaleButtonText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  checkinInput: { minHeight: 82, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: fontSize.base, fontFamily: fonts.text, textAlignVertical: "top" },
  historyLink: { alignItems: "center", paddingVertical: spacing.md },
  historyLinkText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
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
});