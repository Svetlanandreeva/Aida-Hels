import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { AddCard, FCard, figma, gradients, GradientPanel, mobileStyles, RoundIcon, SectionHeader } from "@/src/emergent/figma-mobile";

export default function HomeEditorialPolished() {
  const { lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const health = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const { state } = health;

  const name = state.profile.name?.trim() || (lang === "ru" ? "" : "");
  const greeting = lang === "ru" ? `Добрый вечер${name ? `, ${name}` : ""}` : `Good evening${name ? `, ${name}` : ""}`;
  const date = dayjs().locale(lang === "ru" ? "ru" : "en").format(lang === "ru" ? "D MMMM · dddd" : "MMMM D · dddd");
  const score = d.overall.enough ? d.overall.score : null;
  const latestBp = d.latestBp;
  const latestLab = state.labs[0];
  const latestCheckin = d.latestCheckin;
  const openTasks = state.tasks.filter((task) => !task.done);
  const todayMeds = state.meds;
  const topSignal = d.signals[0];
  const secondSignal = d.signals[1];
  const aiText = topSignal
    ? `${topSignal.title}. ${topSignal.desc}`
    : d.overall.enough
      ? (lang === "ru" ? "Картина выглядит спокойно. Аида продолжает искать связи между показателями." : "Your picture looks steady. Aida keeps looking for connections between metrics.")
      : (lang === "ru" ? "Добавьте первые данные — Аида соберёт их в единую картину и начнёт искать связи." : "Add your first data and Aida will start connecting the picture.");

  const cycleDay = d.cycle?.day ?? null;
  const biologicalAge = d.bioAge ?? null;
  const actualAge = d.actualAge ?? null;

  return <View style={mobileStyles.page}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 34 }}>
      <View style={mobileStyles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brand}><View style={styles.mark}><Ionicons name="pulse" size={14} color="#fff" /></View><Txt variant="h3" style={styles.brandText}>Аида</Txt></View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push("/notification-settings" as any)}><RoundIcon icon="notifications-outline" size={42} bg={figma.card} /></Pressable>
            <Pressable onPress={() => router.push("/(tabs)/profile" as any)}><RoundIcon icon="person-outline" size={42} bg={figma.card} /></Pressable>
          </View>
        </View>
        <Txt variant="h2" style={styles.greeting}>{greeting}</Txt>
        <Txt variant="label" color={figma.muted}>{date}</Txt>

        {health.error ? <Pressable onPress={() => void health.reload()} style={styles.notice}><Ionicons name="cloud-offline-outline" size={18} color={figma.muted} /><Txt variant="label" color={figma.muted} style={{ flex: 1 }}>{lang === "ru" ? "Часть данных не обновилась. Нажмите, чтобы повторить." : "Some data did not refresh. Tap to retry."}</Txt></Pressable> : null}

        <SectionHeader title={lang === "ru" ? "Общее состояние сегодня" : "Overall state today"} action={lang === "ru" ? "Подробнее ›" : "Details ›"} onPress={() => router.push("/(tabs)/body" as any)} />
        <Pressable testID="home-editorial-hero" onPress={() => router.push("/(tabs)/body" as any)}>
          <GradientPanel colors={gradients.status} style={styles.statusHero}>
            <View style={styles.spreadTop}><View><Txt variant="display" style={styles.score}>{score ?? "—"}</Txt><View style={[mobileStyles.pill, { backgroundColor: figma.lime }]}><Txt variant="label" weight="bold" color={figma.ink}>{score == null ? (lang === "ru" ? "Ждём данные" : "Need data") : score >= 75 ? (lang === "ru" ? "Хорошо" : "Good") : (lang === "ru" ? "Наблюдаем" : "Watch")}</Txt></View></View>
              <View style={styles.delta}><Txt variant="h3" color={figma.green}>{d.overall.enough ? "+6%" : "—"}</Txt><Txt variant="label" color={figma.soft}>{lang === "ru" ? "к прошлой неделе" : "vs last week"}</Txt></View>
            </View>
            <Txt variant="caption" color={figma.ink} style={styles.heroCopy}>{topSignal ? topSignal.desc : (lang === "ru" ? "Добавьте данные, чтобы Аида смогла оценить состояние." : "Add data so Aida can assess your state.")}</Txt>
          </GradientPanel>
        </Pressable>

        <SectionHeader title={lang === "ru" ? "ИИ-итог дня" : "AI day summary"} action={lang === "ru" ? "Разбор ›" : "Review ›"} onPress={() => router.push("/(tabs)/chat" as any)} />
        <Pressable testID="home-editorial-ai" onPress={() => router.push("/(tabs)/chat" as any)}><GradientPanel colors={gradients.ai} style={styles.aiCard}><View style={styles.aiLabel}><Ionicons name="sparkles" size={18} color={figma.ink} /><Txt variant="label" weight="bold" color={figma.ink}>{lang === "ru" ? "АИДА СЕГОДНЯ" : "AIDA TODAY"}</Txt></View><Txt variant="caption" color={figma.ink} style={{ marginTop: 12, lineHeight: 20 }}>{aiText}</Txt></GradientPanel></Pressable>

        <SectionHeader title={lang === "ru" ? "Требует внимания" : "Needs attention"} action={lang === "ru" ? "Все сигналы ›" : "All signals ›"} onPress={() => router.push("/(tabs)/body" as any)} />
        <FCard style={styles.attentionCard}>
          {topSignal ? <SignalRow icon="alert-circle-outline" title={topSignal.title} sub={topSignal.desc} color={figma.orange} /> : <SignalRow icon="checkmark-circle-outline" title={lang === "ru" ? "Критичных сигналов нет" : "No critical signals"} sub={lang === "ru" ? "Продолжайте добавлять данные" : "Keep adding data"} color={figma.green} />}
          <View style={mobileStyles.divider} />
          {secondSignal ? <SignalRow icon="pulse-outline" title={secondSignal.title} sub={secondSignal.desc} color={figma.orange} /> : <SignalRow icon="heart-outline" title={lang === "ru" ? "Давление без значимых изменений" : "Blood pressure is stable"} sub={latestBp ? `${latestBp.sys}/${latestBp.dia}` : (lang === "ru" ? "Пока недостаточно измерений" : "Not enough readings yet")} color={figma.green} />}
        </FCard>

        <SectionHeader title={lang === "ru" ? "Сегодня" : "Today"} action={lang === "ru" ? "Все задачи ›" : "All tasks ›"} onPress={() => router.push("/(tabs)/tasks" as any)} />
        <FCard style={styles.todayCard}>
          {todayMeds.slice(0, 2).map((med, index) => <TaskRow key={med.id} done={med.takenDates.includes(todayStr())} time={med.time || "—"} title={med.name} action={med.takenDates.includes(todayStr()) ? (lang === "ru" ? "Принято" : "Taken") : (lang === "ru" ? "Принять" : "Take")} onPress={() => health.toggleMedTaken(med.id)} showDivider={index < Math.min(todayMeds.length, 2) - 1 || openTasks.length > 0} />)}
          {openTasks.slice(0, 2).map((task, index) => <TaskRow key={task.id} done={task.done} time={task.time || "—"} title={task.title} action={lang === "ru" ? "Добавить" : "Add"} onPress={() => health.toggleTask(task.id)} showDivider={index < Math.min(openTasks.length, 2) - 1} />)}
          {!todayMeds.length && !openTasks.length ? <View style={styles.emptyToday}><Ionicons name="checkmark-circle-outline" size={28} color={figma.green} /><Txt variant="caption" color={figma.muted}>{lang === "ru" ? "На сегодня ничего обязательного." : "Nothing urgent for today."}</Txt></View> : null}
        </FCard>

        <SectionHeader title={lang === "ru" ? "Быстрый check-in" : "Quick check-in"} />
        <FCard style={styles.checkCard}>
          <View style={styles.checkGrid}>
            <CheckTile bg="#FFF6D8" icon="happy-outline" label={lang === "ru" ? "Настроение" : "Mood"} value={latestCheckin ? String(latestCheckin.mood) : "—"} />
            <CheckTile bg="#F1FAD0" icon="flash-outline" label={lang === "ru" ? "Энергия" : "Energy"} value={latestCheckin ? `${latestCheckin.energy}/5` : "—"} />
            <CheckTile bg="#FBEAE5" icon="alert-circle-outline" label={lang === "ru" ? "Стресс" : "Stress"} value={latestCheckin ? `${latestCheckin.stress}/5` : "—"} />
            <CheckTile bg="#EAF2FA" icon="heart-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={latestCheckin ? `${latestCheckin.wellbeing}/5` : "—"} />
          </View>
          <Pressable onPress={() => router.push("/(tabs)/mind" as any)} style={styles.checkButton}><Txt variant="label" color="#fff" weight="bold">{lang === "ru" ? "Заполнить check-in" : "Open check-in"}</Txt></Pressable>
        </FCard>

        <SectionHeader title={lang === "ru" ? "Системы организма" : "Body systems"} action={lang === "ru" ? "Все системы ›" : "All systems ›"} onPress={() => router.push("/(tabs)/body" as any)} />
        <FCard><View style={styles.systemHead}><RoundIcon icon="body-outline" size={38} bg={figma.bg} /><View><Txt variant="caption" weight="bold">{lang === "ru" ? "Краткая картина" : "Quick picture"}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Статусы по доступным данным" : "Status from available data"}</Txt></View></View>
          {Object.entries(d.systemStatus || {}).slice(0, 3).map(([key, value], index) => <View key={key}><View style={styles.systemRow}><Txt variant="label" weight="semibold" style={{ flex: 1 }}>{systemName(key, lang)}</Txt><View style={[styles.dot, { backgroundColor: value === "ok" ? figma.green : value === "warn" ? figma.orange : figma.muted }]} /><Txt variant="label" color={value === "ok" ? figma.green : value === "warn" ? figma.orange : figma.muted}>{value === "ok" ? (lang === "ru" ? "Стабильно" : "Stable") : value === "warn" ? (lang === "ru" ? "Есть изменения" : "Changes") : (lang === "ru" ? "Недостаточно данных" : "Not enough data")}</Txt></View>{index < 2 ? <View style={mobileStyles.divider} /> : null}</View>)}
          {!Object.keys(d.systemStatus || {}).length ? <Txt variant="label" color={figma.muted}>{lang === "ru" ? "Добавьте данные, чтобы сформировать картину систем." : "Add data to build the system picture."}</Txt> : null}
        </FCard>

        <SectionHeader title={lang === "ru" ? "Биологический возраст" : "Biological age"} action={lang === "ru" ? "Почему так? ›" : "Why? ›"} onPress={() => router.push("/biological-age" as any)} />
        <Pressable onPress={() => router.push("/biological-age" as any)}><GradientPanel colors={gradients.bio} style={styles.bioCard}><View style={styles.bioLabel}><Ionicons name="time-outline" size={20} color={figma.ink} /><Txt variant="label" color={figma.soft} weight="semibold">{lang === "ru" ? "Возраст организма" : "Body age"}</Txt></View><View style={styles.bioValues}><Txt variant="display" style={styles.bioMain}>{biologicalAge ?? "—"}</Txt><View><Txt variant="h2" color={figma.soft}>{actualAge ?? "—"}</Txt><Txt variant="label" color={figma.soft}>{lang === "ru" ? "фактический" : "actual"}</Txt></View>{biologicalAge != null && actualAge != null ? <View style={[mobileStyles.pill, { backgroundColor: figma.lime }]}><Txt variant="label" weight="bold">{biologicalAge <= actualAge ? `−${actualAge - biologicalAge}` : `+${biologicalAge - actualAge}`} {lang === "ru" ? "года" : "yrs"}</Txt></View> : null}</View></GradientPanel></Pressable>

        {state.profile.cycleEnabled ? <><SectionHeader title={lang === "ru" ? "Женское здоровье" : "Women’s health"} action={lang === "ru" ? "Календарь ›" : "Calendar ›"} onPress={() => router.push("/womens-health" as any)} /><Pressable onPress={() => router.push("/womens-health" as any)}><GradientPanel colors={gradients.women} style={styles.womenCard}><View style={styles.womenHead}><Ionicons name="heart" size={20} color={figma.ink} /><Txt variant="h3">{cycleDay ? `${cycleDay} ${lang === "ru" ? "день цикла" : "cycle day"}` : (lang === "ru" ? "Цикл" : "Cycle")}</Txt></View><View style={[mobileStyles.pill, { backgroundColor: figma.card, marginTop: 16 }]}><Txt variant="label" weight="bold">{lang === "ru" ? "Открыть календарь" : "Open calendar"}</Txt></View><Pressable style={styles.symptomButton} onPress={() => router.push("/cycle" as any)}><Txt variant="label" weight="bold">{lang === "ru" ? "Отметить симптомы" : "Log symptoms"}</Txt></Pressable></GradientPanel></Pressable></> : null}

        <SectionHeader title={lang === "ru" ? "Последние показатели" : "Latest metrics"} action={lang === "ru" ? "История ›" : "History ›"} onPress={() => router.push("/history" as any)} />
        <FCard style={{ paddingVertical: 3 }}>
          <MetricRow icon="pulse-outline" label={lang === "ru" ? "Давление" : "Pressure"} value={latestBp ? `${latestBp.sys}/${latestBp.dia}` : "—"} />
          <View style={mobileStyles.divider} /><MetricRow icon="flask-outline" label={latestLab?.name || (lang === "ru" ? "Анализы" : "Labs")} value={latestLab ? `${latestLab.value}${latestLab.unit ? ` ${latestLab.unit}` : ""}` : "—"} />
          <View style={mobileStyles.divider} /><MetricRow icon="happy-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={latestCheckin ? `${latestCheckin.wellbeing} / 5` : "—"} />
        </FCard>

        <View style={{ marginTop: 20 }}><AddCard dark title={lang === "ru" ? "Добавить данные" : "Add data"} subtitle={lang === "ru" ? "Анализ, давление, симптом, лекарство…" : "Lab, pressure, symptom, medication…"} onPress={() => open()} /></View>
      </View>
    </ScrollView>
  </View>;
}

function SignalRow({ icon, title, sub, color }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; color: string }) { return <View style={styles.signalRow}><Ionicons name={icon} size={19} color={figma.ink} /><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{title}</Txt><Txt variant="label" color={figma.muted} numberOfLines={2}>{sub}</Txt></View><View style={[styles.dot, { backgroundColor: color }]} /></View>; }
function TaskRow({ done, time, title, action, onPress, showDivider }: { done: boolean; time: string; title: string; action: string; onPress: () => void; showDivider?: boolean }) { return <><Pressable onPress={onPress} style={styles.taskRow}><View style={[styles.taskState, done && { backgroundColor: figma.lime, borderColor: figma.lime }]}>{done ? <Ionicons name="checkmark" size={13} color={figma.ink} /> : null}</View><Txt variant="label" color={figma.muted} style={{ width: 48 }}>{time}</Txt><Txt variant="caption" weight="bold" style={{ flex: 1 }} numberOfLines={2}>{title}</Txt><Txt variant="label" color={done ? figma.green : figma.ink} weight="semibold">{action}</Txt></Pressable>{showDivider ? <View style={[mobileStyles.divider, { marginLeft: 34 }]} /> : null}</>; }
function CheckTile({ bg, icon, label, value }: { bg: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={[styles.checkTile, { backgroundColor: bg }]}><Ionicons name={icon} size={22} color={figma.ink} /><Txt variant="label" color={figma.soft} style={{ fontSize: 9 }}>{label}</Txt><Txt variant="label" weight="bold">{value}</Txt></View>; }
function MetricRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={styles.metricRow}><Ionicons name={icon} size={20} color={figma.muted} /><Txt variant="label" weight="semibold" style={{ flex: 1 }}>{label}</Txt><Txt variant="label" weight="bold">{value}</Txt></View>; }
function systemName(key: string, lang: string) { const ru: Record<string, string> = { cardiovascular: "Сердечно-сосудистая", nervous: "Нервная", metabolism: "Обмен веществ", respiratory: "Дыхательная", digestive: "Пищеварительная" }; return lang === "ru" ? (ru[key] || key) : key.replace(/_/g, " "); }

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brand: { flexDirection: "row", alignItems: "center", gap: 8 }, mark: { width: 22, height: 22, borderRadius: 7, backgroundColor: figma.red, alignItems: "center", justifyContent: "center" }, brandText: { fontSize: 22 }, headerActions: { flexDirection: "row", gap: 10 }, greeting: { marginTop: 10, fontSize: 18, lineHeight: 24 }, notice: { marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: figma.divider, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: figma.card },
  statusHero: { minHeight: 190 }, spreadTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, score: { fontSize: 62, lineHeight: 66, color: figma.ink }, delta: { alignItems: "flex-end", gap: 2 }, heroCopy: { marginTop: 12, lineHeight: 20 }, aiCard: { minHeight: 118 }, aiLabel: { flexDirection: "row", alignItems: "center", gap: 8 }, attentionCard: { paddingVertical: 2 }, signalRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10 }, dot: { width: 9, height: 9, borderRadius: 5 }, todayCard: { paddingVertical: 4 }, taskRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10 }, taskState: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: figma.divider, alignItems: "center", justifyContent: "center" }, emptyToday: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: 12 },
  checkCard: { padding: 16 }, checkGrid: { flexDirection: "row", gap: 6 }, checkTile: { flex: 1, minWidth: 0, height: 94, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6 }, checkButton: { height: 40, borderRadius: 999, backgroundColor: figma.ink, alignItems: "center", justifyContent: "center", marginTop: 12 }, systemHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }, systemRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }, bioCard: { minHeight: 148 }, bioLabel: { flexDirection: "row", alignItems: "center", gap: 10 }, bioValues: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }, bioMain: { fontSize: 48, lineHeight: 52, color: figma.ink }, womenCard: { minHeight: 174 }, womenHead: { flexDirection: "row", alignItems: "center", gap: 10 }, symptomButton: { alignSelf: "flex-end", marginTop: 20, minHeight: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: figma.card, alignItems: "center", justifyContent: "center" }, metricRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
});
