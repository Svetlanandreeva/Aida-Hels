import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth, useDerived, todayStr } from "@/src/emergent/health-context";
import { useAddSheet } from "@/src/emergent/AddSheet";
import { Txt } from "@/src/emergent/ui";

const YELLOW = "#F3E783";
const PINK = "#F6D5D7";
const BLUE = "#CCD9FF";
const GREEN = "#D8F0C5";

export default function HomeEditorialPolished() {
  const { colors, theme, lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const health = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const { state } = health;

  const dateStr = dayjs().locale(lang === "ru" ? "ru" : "en").format(lang === "ru" ? "D MMM" : "MMM D");
  const title = state.profile.name || (lang === "ru" ? "Сегодня" : "Today");
  const score = d.overall.enough ? d.overall.score : null;
  const readiness = d.readiness.enough ? d.readiness.percent : null;
  const latestBp = d.latestBp;
  const latestLab = state.labs[0];
  const openTasks = state.tasks.filter((task) => !task.done);
  const todayMeds = state.meds;
  const aiText = d.signals.length
    ? `${d.signals[0].title}. ${d.signals[0].desc}`
    : d.overall.enough
      ? (lang === "ru" ? "Картина выглядит спокойно. Чем больше данных, тем точнее становятся связи." : "Your picture looks steady. More data will make the connections sharper.")
      : (lang === "ru" ? "Добавьте первые данные — Аида соберёт их в единую картину и начнёт искать связи." : "Add your first data and Aida will start connecting the picture.");

  return (
    <View style={[styles.page, { backgroundColor: colors.surface }]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 132 }}>
        <View style={styles.header}>
          <View>
            <Txt variant="label" color={colors.muted} weight="semibold">{dateStr}</Txt>
            <Txt variant="h1" style={styles.title}>{title}</Txt>
          </View>
          <View style={styles.headerActions}>
            <CircleButton icon="notifications-outline" onPress={() => router.push("/notification-settings")} />
            <CircleButton icon="person-outline" onPress={() => router.push("/(tabs)/profile")} />
          </View>
        </View>

        {health.error ? (
          <Pressable onPress={() => void health.reload()} style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="cloud-offline-outline" size={17} color={colors.muted} />
            <Txt variant="label" color={colors.muted} style={{ flex: 1 }}>{lang === "ru" ? "Часть данных не обновилась. Нажмите, чтобы повторить." : "Some data did not refresh. Tap to retry."}</Txt>
          </Pressable>
        ) : null}

        <Pressable testID="home-editorial-hero" onPress={() => router.push("/(tabs)/body")} style={styles.heroWrap}>
          <LinearGradient
            colors={theme === "dark" ? ["#202020", "#171717", "#111111"] : ["#F5F5F1", "#EFEFEB", "#FFFFFF"]}
            locations={[0, 0.66, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderColor: colors.border }]}
          >
            <View style={[styles.glow, styles.glowYellow, { backgroundColor: YELLOW }]} />
            <View style={[styles.glow, styles.glowBlue, { backgroundColor: BLUE }]} />

            <View style={styles.heroHeader}>
              <View>
                <Txt variant="label" color={colors.muted} weight="semibold">{lang === "ru" ? "Состояние сегодня" : "Today state"}</Txt>
                <View style={styles.scoreLine}>
                  <Txt variant="display" style={styles.score}>{score ?? "—"}</Txt>
                  <Txt variant="label" color={colors.muted} style={{ paddingBottom: 7 }}>/100</Txt>
                </View>
              </View>
              <View style={[styles.stateBadge, { backgroundColor: score == null ? colors.surfaceSecondary : score >= 75 ? GREEN : YELLOW }]}> 
                <View style={[styles.stateBadgeDot, { backgroundColor: "#171717" }]} />
                <Txt variant="label" color="#171717" weight="bold">{score == null ? (lang === "ru" ? "Ждём данные" : "Need data") : score >= 75 ? (lang === "ru" ? "Стабильно" : "Stable") : (lang === "ru" ? "Наблюдаем" : "Watch")}</Txt>
              </View>
            </View>

            <View style={styles.chartShell}>
              <View style={[styles.chartGuide, { backgroundColor: colors.border }]} />
              <View style={styles.chartBars}>
                {[32, 46, 39, 62, 53, 70, 61, 78].map((height, index) => (
                  <View key={index} style={[styles.chartBar, { height, backgroundColor: index === 7 ? colors.onSurface : colors.muted, opacity: index === 7 ? 0.92 : 0.42 }]} />
                ))}
              </View>
              <View style={[styles.chartPoint, { borderColor: colors.surface, backgroundColor: colors.onSurface }]} />
            </View>

            <View style={styles.heroMeta}>
              <View>
                <Txt variant="label" color={colors.muted}>{lang === "ru" ? "Готовность" : "Readiness"}</Txt>
                <Txt variant="h2" style={{ marginTop: 2 }}>{readiness != null ? `${readiness}%` : "—"}</Txt>
              </View>
              <View style={[styles.trendChip, { backgroundColor: theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.74)" }]}> 
                <Ionicons name="trending-up-outline" size={15} color={colors.onSurface} />
                <Txt variant="label" weight="bold">{lang === "ru" ? "Динамика" : "Trend"}</Txt>
              </View>
            </View>

            <Pressable testID="home-editorial-ai" onPress={() => router.push("/(tabs)/chat")} style={[styles.aiInset, { backgroundColor: theme === "dark" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.90)" }]}> 
              <View style={styles.aiIcon}><Ionicons name="sparkles" size={18} color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <Txt variant="label" color="#222222" weight="bold">{lang === "ru" ? "Аида заметила" : "Aida noticed"}</Txt>
                <Txt variant="caption" color="#555555" style={{ marginTop: 4 }} numberOfLines={3}>{aiText}</Txt>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#222222" />
            </Pressable>
          </LinearGradient>
        </Pressable>

        <SectionHeader title={lang === "ru" ? "Сегодня" : "Today"} action={lang === "ru" ? "Все" : "All"} onPress={() => router.push("/(tabs)/tasks")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
          <MetricTile accent={PINK} icon="pulse-outline" label={lang === "ru" ? "Давление" : "Pressure"} value={latestBp ? `${latestBp.sys}/${latestBp.dia}` : "—"} sub={latestBp ? "mmHg" : (lang === "ru" ? "Нет измерения" : "No reading")} onPress={() => router.push("/(tabs)/pressure")} />
          <MetricTile accent={YELLOW} icon="flask-outline" label={lang === "ru" ? "Анализы" : "Labs"} value={latestLab ? String(latestLab.value) : "—"} sub={latestLab?.name || (lang === "ru" ? "Загрузить" : "Upload")} onPress={() => router.push("/(tabs)/labs")} />
          <MetricTile accent={BLUE} icon="happy-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={d.latestCheckin ? `${d.latestCheckin.wellbeing}/5` : "—"} sub={lang === "ru" ? "Последняя отметка" : "Latest check-in"} onPress={() => router.push("/(tabs)/mind")} />
        </ScrollView>

        <SectionHeader title={lang === "ru" ? "План на день" : "Daily plan"} />
        <View style={styles.planStack}>
          {todayMeds.slice(0, 2).map((med, index) => {
            const taken = med.takenDates.includes(todayStr());
            return <Pressable key={med.id} onPress={() => health.toggleMedTaken(med.id)} style={[styles.planCard, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.planOrb, { backgroundColor: index === 0 ? YELLOW : PINK }]}><Ionicons name="medical-outline" size={18} color="#222" /></View>
              <View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{med.name}</Txt><Txt variant="label" color={colors.muted}>{med.time}</Txt></View>
              <View style={[styles.checkCircle, { borderColor: taken ? colors.success : colors.borderStrong, backgroundColor: taken ? colors.success : "transparent" }]}>{taken ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}</View>
            </Pressable>;
          })}
          {openTasks.slice(0, 2).map((task) => <Pressable key={task.id} onPress={() => health.toggleTask(task.id)} style={[styles.planCard, { backgroundColor: colors.surfaceSecondary }]}> 
            <View style={[styles.planOrb, { backgroundColor: BLUE }]}><Ionicons name="checkmark-done-outline" size={18} color="#222" /></View>
            <View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{task.title}</Txt><Txt variant="label" color={colors.muted}>{task.time}</Txt></View>
            <View style={[styles.checkCircle, { borderColor: colors.borderStrong }]} />
          </Pressable>)}
          {!todayMeds.length && !openTasks.length ? <Txt variant="caption" color={colors.muted}>{lang === "ru" ? "На сегодня ничего обязательного." : "Nothing urgent for today."}</Txt> : null}
        </View>

        <SectionHeader title={lang === "ru" ? "Быстрые действия" : "Quick actions"} />
        <View style={styles.quickGrid}>
          <QuickAction icon="add" title={lang === "ru" ? "Добавить данные" : "Add data"} onPress={() => open()} />
          <QuickAction icon="flask-outline" title={lang === "ru" ? "Загрузить анализ" : "Upload lab"} onPress={() => router.push("/(tabs)/labs")} />
          <QuickAction icon="pulse-outline" title={lang === "ru" ? "Давление" : "Pressure"} onPress={() => router.push("/(tabs)/pressure")} />
          <QuickAction icon="sparkles-outline" title={lang === "ru" ? "Спросить Аиду" : "Ask Aida"} onPress={() => router.push("/(tabs)/chat")} />
        </View>
      </ScrollView>
    </View>
  );
}

function CircleButton({ icon, onPress }: { icon: any; onPress: () => void }) {
  const { colors } = useApp();
  return <Pressable onPress={onPress} style={[styles.circleButton, { backgroundColor: colors.surfaceSecondary }]}><Ionicons name={icon} size={19} color={colors.onSurface} /></Pressable>;
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { colors } = useApp();
  return <View style={styles.sectionHeader}><Txt variant="h3">{title}</Txt>{action && onPress ? <Pressable onPress={onPress}><Txt variant="label" color={colors.muted} weight="bold">{action}</Txt></Pressable> : null}</View>;
}

function MetricTile({ accent, icon, label, value, sub, onPress }: { accent: string; icon: any; label: string; value: string; sub: string; onPress: () => void }) {
  const { colors } = useApp();
  return <Pressable onPress={onPress} style={[styles.metricTile, { backgroundColor: colors.surfaceSecondary }]}>
    <View style={[styles.metricAccent, { backgroundColor: accent }]}><Ionicons name={icon} size={18} color="#222" /></View>
    <Txt variant="label" color={colors.muted} style={{ marginTop: 16 }}>{label}</Txt>
    <Txt variant="h2" style={{ marginTop: 3 }}>{value}</Txt>
    <Txt variant="label" color={colors.muted} numberOfLines={1}>{sub}</Txt>
  </Pressable>;
}

function QuickAction({ icon, title, onPress }: { icon: any; title: string; onPress: () => void }) {
  const { colors } = useApp();
  return <Pressable onPress={onPress} style={[styles.quickAction, { backgroundColor: colors.surfaceSecondary }]}><Ionicons name={icon} size={20} color={colors.onSurface} /><Txt variant="label" weight="bold" style={{ marginTop: 16 }}>{title}</Txt><Ionicons name="arrow-up-outline" size={15} color={colors.muted} style={styles.quickArrow} /></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { marginTop: 2, fontSize: 32, lineHeight: 36 },
  headerActions: { flexDirection: "row", gap: 8 },
  circleButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  notice: { marginHorizontal: 20, marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  heroWrap: { marginHorizontal: 14, marginTop: 18 },
  hero: { minHeight: 430, borderRadius: 38, padding: 22, paddingBottom: 18, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", zIndex: 3 },
  scoreLine: { flexDirection: "row", alignItems: "flex-end", gap: 5, marginTop: 3 },
  score: { fontSize: 50, lineHeight: 54 },
  stateBadge: { minHeight: 34, borderRadius: 17, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  stateBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.20 },
  glowYellow: { width: 190, height: 190, right: -58, top: 80 },
  glowBlue: { width: 130, height: 130, left: -52, top: 182, opacity: 0.12 },
  chartShell: { height: 128, marginTop: 26, justifyContent: "flex-end" },
  chartGuide: { position: "absolute", left: 0, right: 0, bottom: 24, height: StyleSheet.hairlineWidth, opacity: 0.55 },
  chartBars: { height: 92, flexDirection: "row", alignItems: "flex-end", gap: 13, paddingHorizontal: 6 },
  chartBar: { flex: 1, maxWidth: 17, minWidth: 10, borderRadius: 9 },
  chartPoint: { position: "absolute", right: 5, bottom: 18, width: 14, height: 14, borderRadius: 7, borderWidth: 4 },
  heroMeta: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  trendChip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7 },
  aiInset: { marginTop: 18, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  aiIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#111111", alignItems: "center", justifyContent: "center" },
  sectionHeader: { marginTop: 30, marginBottom: 12, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  horizontalCards: { paddingHorizontal: 20, gap: 12 },
  metricTile: { width: 160, minHeight: 174, borderRadius: 28, padding: 16 },
  metricAccent: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  planStack: { paddingHorizontal: 20, gap: 10 },
  planCard: { minHeight: 72, borderRadius: 24, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  planOrb: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  quickGrid: { paddingHorizontal: 20, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: { width: "48%", minHeight: 126, borderRadius: 26, padding: 16 },
  quickArrow: { position: "absolute", right: 14, top: 14, transform: [{ rotate: "45deg" }] },
});
