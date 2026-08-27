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
import { fontSize, radius, spacing } from "@/src/emergent/tokens";
import { Txt } from "@/src/emergent/ui";

const ACCENT_SOFT = "#F4E88C";
const ACCENT_WARM = "#F7D6D2";
const ACCENT_BLUE = "#C9D9FF";

export default function HomeEditorial() {
  const { colors, theme, lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const health = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const { state } = health;

  const dateStr = dayjs().locale(lang === "ru" ? "ru" : "en").format(lang === "ru" ? "D MMM" : "MMM D");
  const name = state.profile.name || (lang === "ru" ? "Сегодня" : "Today");
  const score = d.overall.enough ? d.overall.score : null;
  const readiness = d.readiness.enough ? d.readiness.percent : null;
  const latestBp = d.latestBp;
  const latestLab = state.labs[0];
  const openTasks = state.tasks.filter((task) => !task.done);
  const todayMeds = state.meds;
  const aiText = d.signals.length
    ? `${d.signals[0].title}. ${d.signals[0].desc}`
    : d.overall.enough
      ? (lang === "ru" ? "Картина спокойная. Продолжайте добавлять данные — так связи станут точнее." : "Your picture looks steady. Keep adding data to sharpen the connections.")
      : (lang === "ru" ? "Добавьте данные — Аида соберёт их в единую картину и начнёт искать связи." : "Add data and Aida will turn it into one picture and start finding connections.");

  return (
    <View style={[styles.page, { backgroundColor: colors.surface }]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 132 }}>
        <View style={styles.header}>
          <View>
            <Txt variant="label" color={colors.muted} weight="semibold">{dateStr}</Txt>
            <Txt variant="h1" style={styles.title}>{name}</Txt>
          </View>
          <View style={styles.headerActions}>
            <CircleButton icon="notifications-outline" onPress={() => router.push("/notification-settings")} />
            <CircleButton icon="person-outline" onPress={() => router.push("/(tabs)/profile")} />
          </View>
        </View>

        {health.error ? (
          <Pressable onPress={() => void health.reload()} style={[styles.inlineNotice, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.muted} />
            <Txt variant="label" color={colors.muted} style={{ flex: 1 }}>{lang === "ru" ? "Часть данных не обновилась. Нажмите, чтобы повторить." : "Some data did not refresh. Tap to retry."}</Txt>
          </Pressable>
        ) : null}

        <Pressable testID="home-editorial-hero" onPress={() => router.push("/(tabs)/body")} style={styles.heroWrap}>
          <LinearGradient
            colors={theme === "dark" ? ["#292929", "#171717"] : ["#F0F0ED", "#FFFFFF"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}
          >
            <View style={[styles.softOrb, styles.orbOne, { backgroundColor: ACCENT_SOFT }]} />
            <View style={[styles.softOrb, styles.orbTwo, { backgroundColor: ACCENT_BLUE }]} />
            <View style={styles.heroTop}>
              <View>
                <Txt variant="label" color={colors.muted} weight="semibold">{lang === "ru" ? "Состояние сегодня" : "Today state"}</Txt>
                <View style={styles.scoreRow}>
                  <Txt variant="display" style={styles.score}>{score ?? "—"}</Txt>
                  <Txt variant="label" color={colors.muted}>/100</Txt>
                </View>
              </View>
              <View style={[styles.statusDot, { backgroundColor: score == null ? colors.border : score >= 75 ? "#C8F1A5" : ACCENT_SOFT }]} />
            </View>

            <View style={styles.graphArea}>
              <View style={[styles.gridLine, { top: 20, backgroundColor: colors.border }]} />
              <View style={[styles.gridLine, { top: 64, backgroundColor: colors.border }]} />
              <View style={[styles.gridLine, { top: 108, backgroundColor: colors.border }]} />
              <View style={styles.sparkPath}>
                {[30, 48, 34, 72, 54, 86, 63, 92].map((height, index) => (
                  <View key={index} style={[styles.sparkBar, { height, backgroundColor: index === 7 ? colors.onSurface : colors.muted }]} />
                ))}
              </View>
              <View style={[styles.focusDot, { backgroundColor: colors.surface }]}><View style={[styles.focusInner, { backgroundColor: colors.onSurface }]} /></View>
            </View>

            <View style={styles.heroBottom}>
              <View>
                <Txt variant="label" color={colors.muted}>{lang === "ru" ? "Готовность" : "Readiness"}</Txt>
                <Txt variant="h2">{readiness != null ? `${readiness}%` : "—"}</Txt>
              </View>
              <View style={styles.heroPill}>
                <Ionicons name="analytics-outline" size={16} color={colors.onSurface} />
                <Txt variant="label" weight="bold">{lang === "ru" ? "Динамика" : "Trend"}</Txt>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable testID="home-editorial-ai" onPress={() => router.push("/(tabs)/chat")} style={[styles.aiCard, { backgroundColor: colors.onSurface }]}> 
          <View style={[styles.aiIcon, { backgroundColor: colors.surface }]}><Ionicons name="sparkles" size={19} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Txt variant="label" color={colors.surface} weight="bold">{lang === "ru" ? "Аида заметила" : "Aida noticed"}</Txt>
            <Txt variant="caption" color={colors.surface} style={{ opacity: 0.78, marginTop: 4 }}>{aiText}</Txt>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.surface} />
        </Pressable>

        <SectionHeader title={lang === "ru" ? "Сегодня" : "Today"} action={lang === "ru" ? "Все" : "All"} onPress={() => router.push("/(tabs)/tasks")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
          <MetricTile accent={ACCENT_WARM} icon="pulse-outline" label={lang === "ru" ? "Давление" : "Pressure"} value={latestBp ? `${latestBp.sys}/${latestBp.dia}` : "—"} sub={latestBp ? "mmHg" : (lang === "ru" ? "Нет измерения" : "No reading")} onPress={() => router.push("/(tabs)/pressure")} />
          <MetricTile accent={ACCENT_SOFT} icon="flask-outline" label={lang === "ru" ? "Анализы" : "Labs"} value={latestLab ? String(latestLab.value) : "—"} sub={latestLab?.name || (lang === "ru" ? "Загрузить" : "Upload")} onPress={() => router.push("/(tabs)/labs")} />
          <MetricTile accent={ACCENT_BLUE} icon="happy-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={d.latestCheckin ? `${d.latestCheckin.wellbeing}/5` : "—"} sub={lang === "ru" ? "Последняя отметка" : "Latest check-in"} onPress={() => router.push("/(tabs)/mind")} />
        </ScrollView>

        <SectionHeader title={lang === "ru" ? "План на день" : "Daily plan"} />
        <View style={styles.planStack}>
          {todayMeds.slice(0, 2).map((med, index) => {
            const taken = med.takenDates.includes(todayStr());
            return <Pressable key={med.id} onPress={() => health.toggleMedTaken(med.id)} style={[styles.planCard, { backgroundColor: colors.surfaceSecondary }]}> 
              <View style={[styles.planOrb, { backgroundColor: index === 0 ? ACCENT_SOFT : ACCENT_WARM }]}><Ionicons name="medical-outline" size={18} color="#262626" /></View>
              <View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{med.name}</Txt><Txt variant="label" color={colors.muted}>{med.time}</Txt></View>
              <View style={[styles.checkCircle, { borderColor: taken ? colors.success : colors.borderStrong, backgroundColor: taken ? colors.success : "transparent" }]}>{taken ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}</View>
            </Pressable>;
          })}
          {openTasks.slice(0, 2).map((task) => <Pressable key={task.id} onPress={() => health.toggleTask(task.id)} style={[styles.planCard, { backgroundColor: colors.surfaceSecondary }]}> 
            <View style={[styles.planOrb, { backgroundColor: ACCENT_BLUE }]}><Ionicons name="checkmark-done-outline" size={18} color="#262626" /></View>
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
    <View style={[styles.metricAccent, { backgroundColor: accent }]}><Ionicons name={icon} size={18} color="#242424" /></View>
    <Txt variant="label" color={colors.muted} style={{ marginTop: 18 }}>{label}</Txt>
    <Txt variant="h2" style={{ marginTop: 4 }}>{value}</Txt>
    <Txt variant="label" color={colors.muted} numberOfLines={1}>{sub}</Txt>
  </Pressable>;
}

function QuickAction({ icon, title, onPress }: { icon: any; title: string; onPress: () => void }) {
  const { colors } = useApp();
  return <Pressable onPress={onPress} style={[styles.quickAction, { backgroundColor: colors.surfaceSecondary }]}><Ionicons name={icon} size={20} color={colors.onSurface} /><Txt variant="label" weight="bold" style={{ marginTop: 18 }}>{title}</Txt><Ionicons name="arrow-up-outline" size={15} color={colors.muted} style={styles.quickArrow} /></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { marginTop: 2, fontSize: 32, lineHeight: 36 },
  headerActions: { flexDirection: "row", gap: 8 },
  circleButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  inlineNotice: { marginHorizontal: 20, marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  heroWrap: { marginHorizontal: 14, marginTop: 18 },
  hero: { minHeight: 390, borderRadius: 34, padding: 22, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", zIndex: 2 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 5, marginTop: 2 },
  score: { fontSize: 54, lineHeight: 58 },
  statusDot: { width: 18, height: 18, borderRadius: 9 },
  softOrb: { position: "absolute", borderRadius: 999, opacity: 0.78 },
  orbOne: { width: 150, height: 150, right: -26, top: 72 },
  orbTwo: { width: 110, height: 110, left: -28, bottom: 24, opacity: 0.45 },
  graphArea: { height: 160, marginTop: 18, justifyContent: "flex-end" },
  gridLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, opacity: 0.45 },
  sparkPath: { flexDirection: "row", alignItems: "flex-end", gap: 12, height: 120, paddingHorizontal: 12 },
  sparkBar: { flex: 1, maxWidth: 18, minWidth: 10, borderRadius: 99, opacity: 0.72 },
  focusDot: { position: "absolute", right: 26, top: 40, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  focusInner: { width: 7, height: 7, borderRadius: 4 },
  heroBottom: { marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", zIndex: 2 },
  heroPill: { minHeight: 42, paddingHorizontal: 15, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.62)", flexDirection: "row", alignItems: "center", gap: 8 },
  aiCard: { marginHorizontal: 20, marginTop: -18, borderRadius: 24, minHeight: 104, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, zIndex: 5 },
  aiIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sectionHeader: { marginTop: 28, marginBottom: 12, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  horizontalCards: { paddingHorizontal: 20, gap: 12 },
  metricTile: { width: 158, minHeight: 180, borderRadius: 26, padding: 16 },
  metricAccent: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  planStack: { paddingHorizontal: 20, gap: 10 },
  planCard: { minHeight: 74, borderRadius: 24, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  planOrb: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  checkCircle: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  quickGrid: { paddingHorizontal: 20, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: { width: "48%", minHeight: 126, borderRadius: 26, padding: 16, position: "relative" },
  quickArrow: { position: "absolute", right: 14, top: 14, transform: [{ rotate: "45deg" }] },
});
