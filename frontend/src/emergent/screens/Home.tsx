import React from "react";
import { ActivityIndicator, StyleSheet, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth, useDerived, todayStr } from "@/src/emergent/health-context";
import { useAddSheet } from "@/src/emergent/AddSheet";
import { CONTENT_MAX, fontSize, radius, spacing } from "@/src/emergent/tokens";
import { Txt, LangToggle, ThemeToggle, PillButton } from "@/src/emergent/ui";
import { Card, SectionTitle, StatusBadge, EmptyState, IconTile, ScaleRow, MetricRow } from "@/src/emergent/health";

export default function Home() {
  const { colors, theme, t, lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const health = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const m = t.mod;
  const { state } = health;

  const [mood, setMood] = React.useState(3);
  const [energy, setEnergy] = React.useState(3);
  const [stress, setStress] = React.useState(3);
  const [wellbeing, setWellbeing] = React.useState(3);
  const [savedCheckin, setSavedCheckin] = React.useState(false);

  const hour = dayjs().hour();
  const greet = hour < 12 ? (lang === "ru" ? "Доброе утро" : "Good morning") : hour < 18 ? (lang === "ru" ? "Добрый день" : "Good afternoon") : (lang === "ru" ? "Добрый вечер" : "Good evening");
  const dateStr = dayjs().locale(lang === "ru" ? "ru" : "en").format(lang === "ru" ? "D MMMM" : "MMMM D");

  const statusLabel = (k: "normal" | "attention" | "noData") => m.statuses[k];

  const aiText = d.signals.length > 0
    ? `${d.signals[0].title}. ${d.signals[0].desc}`
    : d.overall.enough
      ? (lang === "ru" ? "Показатели стабильны. Продолжайте вносить данные для более точных выводов." : "Metrics are stable. Keep adding data for sharper conclusions.")
      : (lang === "ru" ? "Добавьте больше данных, чтобы Аида начала находить связи." : "Add more data so Aida can start finding connections.");

  const saveCheckin = () => {
    health.addCheckin({ mood, energy, stress, wellbeing });
    setSavedCheckin(true);
    setTimeout(() => setSavedCheckin(false), 1500);
  };

  const todayMeds = state.meds;
  const openTasks = state.tasks.filter((x) => !x.done);
  const failedSections = Object.entries(state.sectionStates).filter(([, value]) => value === "error");

  if (health.loading) {
    return <View style={[styles.statePage, { backgroundColor: colors.surface }]}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (health.error) {
    return (
      <View style={[styles.statePage, { backgroundColor: colors.surface, paddingTop: insets.top + spacing.xl }]} testID="home-load-error">
        <Card style={{ width: "100%", maxWidth: CONTENT_MAX }}>
          <EmptyState icon="cloud-offline-outline" text={lang === "ru" ? "Не удалось загрузить данные. Это техническая ошибка: сохранённые данные не считаются отсутствующими." : "Could not load data. This is a technical error; saved records are not treated as missing."} actionLabel={lang === "ru" ? "Повторить" : "Retry"} onAction={() => void health.reload()} />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing["3xl"], alignItems: "center" }}>
        <View style={styles.wrap}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable testID="home-avatar" onPress={() => router.push("/(tabs)/profile")} style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: colors.brandSecondary }]}>
                <Ionicons name="person" size={22} color={colors.brand} />
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Txt variant="h3">{state.profile.name}</Txt>
                <Txt variant="label" color={colors.muted} weight="medium">{dateStr}</Txt>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pressable testID="home-bell" onPress={() => router.push("/notification-settings")} style={[styles.iconChip, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.onSurface} />
              </Pressable>
              <LangToggle />
              <ThemeToggle />
            </View>
          </View>
          <Txt variant="caption" color={colors.muted} style={{ marginTop: spacing.sm }}>{greet} · {m.collecting}</Txt>

          {failedSections.length ? (
            <Card style={{ marginTop: spacing.md }}>
              <EmptyState icon="cloud-offline-outline" text={lang === "ru" ? `Часть данных временно недоступна: ${failedSections.map(([key]) => key).join(", ")}. Это ошибка загрузки, а не отсутствие записей.` : `Some data is temporarily unavailable: ${failedSections.map(([key]) => key).join(", ")}. This is a loading error, not missing records.`} actionLabel={lang === "ru" ? "Повторить" : "Retry"} onAction={() => void health.reload()} />
            </Card>
          ) : null}

          {/* Overall today */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Txt variant="h3">{m.overallToday}</Txt>
              {d.overall.enough ? <StatusBadge status={d.overall.status} label={statusLabel(d.overall.status)} /> : null}
            </View>
            {d.overall.enough ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: spacing.md }}>
                  <Txt variant="display" color={colors.brand} style={{ fontSize: 48, lineHeight: 50 }}>{d.overall.score}</Txt>
                  <Txt variant="caption" color={colors.muted} style={{ marginBottom: 8, marginLeft: 6 }}>/ 100</Txt>
                </View>
                <Txt variant="caption" color={colors.muted}>{m.dynamicsFlat}</Txt>
                <View style={{ marginTop: spacing.md }}>
                  <PillButton testID="home-overall-more" label={m.more} variant="secondary" onPress={() => router.push("/(tabs)/body")} />
                </View>
              </>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <EmptyState icon="analytics-outline" text={m.notEnough} />
                <View style={{ marginTop: spacing.sm }}>
                  <PillButton testID="home-add-data" label={m.addData} onPress={() => open()} icon="add" />
                </View>
              </View>
            )}
          </Card>

          {/* Readiness gradient */}
          <Pressable testID="home-readiness" onPress={() => router.push("/biological-age")} style={{ marginTop: spacing.md }}>
            <LinearGradient colors={[colors.brand, "#FF7A59"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.readiness}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="h3" color="#FFFFFF">{m.readiness}</Txt>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </View>
              <Txt variant="display" color="#FFFFFF" style={{ fontSize: 40, lineHeight: 44, marginTop: spacing.sm }}>
                {d.readiness.enough ? `${d.readiness.percent}%` : "—"}
              </Txt>
              <Txt variant="caption" color="rgba(255,255,255,0.9)">{d.readiness.enough ? m.dynamicsUp : m.notEnough}</Txt>
            </LinearGradient>
          </Pressable>

          {/* AI summary */}
          <SectionTitle title={m.aiSummaryTitle} icon="sparkles-outline" />
          <Card>
            <Txt variant="caption">{aiText}</Txt>
            <Pressable testID="home-see-breakdown" onPress={() => router.push("/(tabs)/chat")} style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center" }}>
              <Txt variant="label" weight="bold" color={colors.brand}>{m.seeBreakdown}</Txt>
              <Ionicons name="arrow-forward" size={16} color={colors.brand} style={{ marginLeft: 6 }} />
            </Pressable>
          </Card>

          {/* Needs attention */}
          <SectionTitle title={m.needsAttention} icon="alert-circle-outline" />
          <Card>
            {d.signals.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {d.signals.map((s, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                    <IconTile icon={s.icon as any} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Txt variant="label" weight="bold" style={{ fontSize: fontSize.lg }}>{s.title}</Txt>
                      <Txt variant="label" color={colors.muted} weight="medium" style={{ marginTop: 2 }}>{s.desc}</Txt>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="checkmark-circle-outline" text={m.noSignals} />
            )}
          </Card>

          {/* Today */}
          <SectionTitle title={m.today} icon="calendar-outline" actionLabel={m.allTasks} onAction={() => router.push("/(tabs)/tasks")} testID="home-all-tasks" />
          <Card>
            <Txt variant="label" weight="bold" color={colors.muted} style={{ marginBottom: spacing.sm }}>{m.meds}</Txt>
            {todayMeds.length > 0 ? todayMeds.map((med) => {
              const taken = med.takenDates.includes(todayStr());
              return (
                <View key={med.id} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="caption" weight="semibold">{med.name}</Txt>
                    <Txt variant="label" color={colors.muted} weight="medium">{med.time}</Txt>
                  </View>
                  <Pressable testID={`home-med-${med.id}`} onPress={() => health.toggleMedTaken(med.id)} style={[styles.takeBtn, { backgroundColor: taken ? colors.success : colors.brandSecondary }]}>
                    <Ionicons name={taken ? "checkmark" : "add"} size={16} color={taken ? "#FFFFFF" : colors.brand} />
                    <Txt variant="label" weight="bold" color={taken ? "#FFFFFF" : colors.brand} style={{ marginLeft: 4 }}>{taken ? m.taken : m.take}</Txt>
                  </Pressable>
                </View>
              );
            }) : <EmptyState icon="medkit-outline" text={m.noMeds} />}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable testID="home-measure-bp" onPress={() => router.push("/(tabs)/pressure")} style={styles.rowItem}>
              <IconTile icon="pulse-outline" />
              <Txt variant="caption" weight="semibold" style={{ flex: 1, marginLeft: spacing.md }}>{m.measureBp}</Txt>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            {openTasks.length > 0 ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Txt variant="label" weight="bold" color={colors.muted} style={{ marginBottom: spacing.sm }}>{m.otherTasks}</Txt>
                {openTasks.slice(0, 3).map((task) => (
                  <Pressable key={task.id} testID={`home-task-${task.id}`} onPress={() => health.toggleTask(task.id)} style={styles.rowItem}>
                    <View style={[styles.check, { borderColor: colors.borderStrong }]} />
                    <Txt variant="caption" weight="semibold" style={{ flex: 1, marginLeft: spacing.md }}>{task.title}</Txt>
                    <Txt variant="label" color={colors.muted} weight="medium">{task.time}</Txt>
                  </Pressable>
                ))}
              </>
            ) : null}
          </Card>

          {/* Quick check-in */}
          <SectionTitle title={m.quickCheckin} icon="happy-outline" />
          <Card>
            <Txt variant="label" color={colors.muted} weight="medium" style={{ marginBottom: spacing.md }}>{m.checkinDesc}</Txt>
            <ScaleRow testID="home-mood" label={m.mood} value={mood} onChange={setMood} />
            <ScaleRow testID="home-energy" label={m.energy} value={energy} onChange={setEnergy} />
            <ScaleRow testID="home-stress" label={m.stress} value={stress} onChange={setStress} invert />
            <ScaleRow testID="home-wellbeing" label={m.wellbeing} value={wellbeing} onChange={setWellbeing} />
            <PillButton testID="home-save-checkin" label={savedCheckin ? "✓" : m.save} onPress={saveCheckin} full icon={savedCheckin ? "checkmark" : "save-outline"} />
          </Card>

          {/* Body systems */}
          <SectionTitle title={m.bodySystems} icon="body-outline" actionLabel={m.allSystems} onAction={() => router.push("/(tabs)/body")} testID="home-all-systems" />
          <View style={styles.systemsGrid}>
            {m.systems.slice(0, 4).map((sys) => {
              const st = d.systemStatus[sys.key] ?? "noData";
              return (
                <View key={sys.key} style={[styles.systemCell, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Txt variant="label" weight="bold">{sys.name}</Txt>
                  <View style={{ marginTop: spacing.sm }}>
                    <StatusBadge status={st} label={statusLabel(st)} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Biological age */}
          <SectionTitle title={m.bioAge} icon="hourglass-outline" />
          <Card>
            {d.bioAge != null ? (
              <>
                <View style={{ flexDirection: "row", gap: spacing.xl }}>
                  <View>
                    <Txt variant="label" color={colors.muted} weight="semibold">{m.actualAge}</Txt>
                    <Txt variant="h1">{d.actualAge} <Txt variant="caption" color={colors.muted}>{m.years}</Txt></Txt>
                  </View>
                  <View>
                    <Txt variant="label" color={colors.muted} weight="semibold">{m.estimatedAge}</Txt>
                    <Txt variant="h1" color={colors.brand}>{d.bioAge} <Txt variant="caption" color={colors.muted}>{m.years}</Txt></Txt>
                  </View>
                </View>
                <Pressable testID="home-bioage-why" onPress={() => router.push("/biological-age")} style={{ marginTop: spacing.md }}>
                  <Txt variant="label" weight="bold" color={colors.brand}>{m.whyThis}</Txt>
                </Pressable>
              </>
            ) : (
              <EmptyState icon="hourglass-outline" text={m.notEnough} actionLabel={m.whatToAdd} onAction={() => open()} testID="home-bioage-add" />
            )}
          </Card>

          {/* Women's health */}
          {state.profile.cycleEnabled && d.cycle ? (
            <>
              <SectionTitle title={m.womenHealth} icon="female-outline" />
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View>
                    <Txt variant="label" color={colors.muted} weight="semibold">{m.cycleDay}</Txt>
                    <Txt variant="h1" color={colors.brand}>{d.cycle.day}</Txt>
                  </View>
                  <View>
                    <Txt variant="label" color={colors.muted} weight="semibold">{m.phase}</Txt>
                    <Txt variant="h3" style={{ marginTop: 6 }}>{m.phases[d.cycle.phase]}</Txt>
                  </View>
                  <View>
                    <Txt variant="label" color={colors.muted} weight="semibold">{m.nextPeriod}</Txt>
                    <Txt variant="h3" style={{ marginTop: 6 }}>{d.cycle.nextInDays} {m.daysShort}</Txt>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
                  <View style={{ flex: 1 }}><PillButton testID="home-mark-symptoms" label={m.markSymptoms} variant="secondary" onPress={() => open("symptom")} /></View>
                  <View style={{ flex: 1 }}><PillButton testID="home-open-calendar" label={m.openCalendar} variant="secondary" onPress={() => router.push("/cycle")} /></View>
                </View>
              </Card>
            </>
          ) : null}

          {/* Latest metrics */}
          <SectionTitle title={m.latest} icon="time-outline" actionLabel={m.history} onAction={() => router.push("/history")} testID="home-history" />
          <View style={{ gap: spacing.sm }}>
            {d.latestBp ? <MetricRow testID="home-last-bp" icon="pulse-outline" title={m.lastMeasurements} value={`${d.latestBp.sys}/${d.latestBp.dia}`} sub={m.pressureTitle} onPress={() => router.push("/(tabs)/pressure")} /> : null}
            {state.labs[0] ? <MetricRow testID="home-last-lab" icon="flask-outline" title={m.lastLabs} value={`${state.labs[0].value}`} sub={state.labs[0].name} onPress={() => router.push("/(tabs)/labs")} /> : null}
            {d.latestCheckin ? <MetricRow testID="home-last-checkin" icon="happy-outline" title={m.lastWellbeing} value={`${d.latestCheckin.wellbeing}/5`} sub={m.wellbeing} onPress={() => router.push("/(tabs)/mind")} /> : null}
            {!d.latestBp && !state.labs[0] && !d.latestCheckin ? (
              <Card><EmptyState icon="time-outline" text={m.notEnough} actionLabel={m.addData} onAction={() => open()} /></Card>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <PillButton testID="home-universal-add" label={m.add} onPress={() => open()} size="lg" icon="add" full />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statePage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  wrap: { width: "100%", maxWidth: CONTENT_MAX, paddingHorizontal: spacing.xl },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  iconChip: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  readiness: { borderRadius: radius.lg, padding: spacing.xl },
  rowItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  takeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  divider: { height: StyleSheet.hairlineWidth * 2, marginVertical: spacing.md },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2 },
  systemsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  systemCell: { width: "47%", flexGrow: 1, borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
});
