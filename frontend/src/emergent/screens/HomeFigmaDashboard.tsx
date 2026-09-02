import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth, useDerived, todayStr, type StatusKind } from "@/src/emergent/health-context";
import { useAddSheet } from "@/src/emergent/AddSheet";
import { Txt } from "@/src/emergent/ui";
import { AddCard, FCard, figma, gradients, GradientPanel, mobileStyles, RoundIcon, SectionHeader } from "@/src/emergent/figma-mobile";

export default function HomeFigmaDashboard() {
  const { lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const health = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const { state } = health;
  const name = state.profile.name?.trim();
  const score = d.overall.enough ? d.overall.score : null;
  const topSignal = d.signals[0];
  const secondSignal = d.signals[1];
  const latestBp = d.latestBp;
  const latestLab = state.labs[0];
  const latestCheckin = d.latestCheckin;
  const tasks = state.tasks.filter((task) => !task.done).slice(0, 2);
  const meds = state.meds.slice(0, 2);
  const cycle = d.cycle;
  const date = dayjs().locale(lang === "ru" ? "ru" : "en").format(lang === "ru" ? "D MMMM · dddd" : "MMMM D · dddd");
  const greeting = lang === "ru" ? `Добрый вечер${name ? `, ${name}` : ""}` : `Good evening${name ? `, ${name}` : ""}`;
  const aiText = topSignal ? `${topSignal.title}. ${topSignal.desc}` : d.overall.enough
    ? (lang === "ru" ? "Картина выглядит спокойно. Аида продолжает сопоставлять показатели и искать связи." : "Your picture looks steady. Aida keeps comparing metrics and looking for connections.")
    : (lang === "ru" ? "Добавьте первые данные — Аида соберёт их в единую картину и начнёт искать связи." : "Add your first data and Aida will start connecting the picture.");

  return <View style={mobileStyles.page}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 32 }}>
      <View style={mobileStyles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brand}><View style={styles.mark}><Ionicons name="pulse" size={14} color="#fff" /></View><Txt variant="h3" style={styles.brandText}>Аида</Txt></View>
          <View style={styles.headerActions}><Pressable onPress={() => router.push("/notification-settings" as any)}><RoundIcon icon="notifications-outline" size={42} bg={figma.card} /></Pressable><Pressable onPress={() => router.push("/(tabs)/profile" as any)}><RoundIcon icon="person-outline" size={42} bg={figma.card} /></Pressable></View>
        </View>
        <Txt variant="h2" style={styles.greeting}>{greeting}</Txt><Txt variant="label" color={figma.muted}>{date}</Txt>

        {health.error ? <Pressable onPress={() => void health.reload()} style={styles.notice}><Ionicons name="cloud-offline-outline" size={18} color={figma.muted} /><Txt variant="label" color={figma.muted} style={{ flex: 1 }}>{lang === "ru" ? "Часть данных не обновилась. Нажмите, чтобы повторить." : "Some data did not refresh. Tap to retry."}</Txt></Pressable> : null}

        <SectionHeader title={lang === "ru" ? "Общее состояние сегодня" : "Overall state today"} action={lang === "ru" ? "Подробнее ›" : "Details ›"} onPress={() => router.push("/(tabs)/body" as any)} />
        <Pressable testID="home-editorial-hero" onPress={() => router.push("/(tabs)/body" as any)}><GradientPanel colors={gradients.status} style={styles.statusHero}>
          <View style={styles.spread}><View><Txt variant="display" style={styles.score}>{score ?? "—"}</Txt><View style={[mobileStyles.pill, { backgroundColor: figma.lime }]}><Txt variant="label" weight="bold">{score == null ? (lang === "ru" ? "Ждём данные" : "Need data") : score >= 75 ? (lang === "ru" ? "Хорошо" : "Good") : (lang === "ru" ? "Наблюдаем" : "Watch")}</Txt></View></View><View style={styles.readiness}><Txt variant="h3">{d.readiness.enough ? `${d.readiness.percent}%` : "—"}</Txt><Txt variant="label" color={figma.soft}>{lang === "ru" ? "готовность данных" : "data readiness"}</Txt></View></View>
          <Txt variant="caption" style={styles.heroCopy}>{topSignal?.desc || (lang === "ru" ? "Добавьте данные, чтобы Аида смогла оценить состояние." : "Add data so Aida can assess your state.")}</Txt>
        </GradientPanel></Pressable>

        <SectionHeader title={lang === "ru" ? "ИИ-итог дня" : "AI day summary"} action={lang === "ru" ? "Разбор ›" : "Review ›"} onPress={() => router.push("/(tabs)/chat" as any)} />
        <Pressable testID="home-editorial-ai" onPress={() => router.push("/(tabs)/chat" as any)}><GradientPanel colors={gradients.ai} style={styles.aiCard}><View style={styles.aiLabel}><Ionicons name="sparkles" size={18} color={figma.ink} /><Txt variant="label" weight="bold">{lang === "ru" ? "АИДА СЕГОДНЯ" : "AIDA TODAY"}</Txt></View><Txt variant="caption" style={{ marginTop: 12, lineHeight: 20 }}>{aiText}</Txt></GradientPanel></Pressable>

        <SectionHeader title={lang === "ru" ? "Требует внимания" : "Needs attention"} action={lang === "ru" ? "Все сигналы ›" : "All signals ›"} onPress={() => router.push("/(tabs)/body" as any)} />
        <FCard style={styles.attention}><Signal icon={topSignal ? "alert-circle-outline" : "checkmark-circle-outline"} title={topSignal?.title || (lang === "ru" ? "Критичных сигналов нет" : "No critical signals")} sub={topSignal?.desc || (lang === "ru" ? "Продолжайте добавлять данные" : "Keep adding data")} status={topSignal ? "attention" : "normal"} /><View style={mobileStyles.divider} /><Signal icon="heart-outline" title={secondSignal?.title || (lang === "ru" ? "Давление" : "Blood pressure")} sub={secondSignal?.desc || (latestBp ? `${latestBp.sys}/${latestBp.dia}` : (lang === "ru" ? "Пока недостаточно измерений" : "Not enough readings yet"))} status={secondSignal ? "attention" : latestBp ? "normal" : "noData"} /></FCard>

        <SectionHeader title={lang === "ru" ? "Сегодня" : "Today"} action={lang === "ru" ? "Все задачи ›" : "All tasks ›"} onPress={() => router.push("/(tabs)/tasks" as any)} />
        <FCard style={styles.today}>{meds.map((med, index) => <TaskRow key={med.id} done={med.takenDates.includes(todayStr())} time={med.time || "—"} title={med.name} action={med.takenDates.includes(todayStr()) ? (lang === "ru" ? "Принято" : "Taken") : (lang === "ru" ? "Принять" : "Take")} onPress={() => health.toggleMedTaken(med.id)} divider={index < meds.length - 1 || tasks.length > 0} />)}{tasks.map((task, index) => <TaskRow key={task.id} done={task.done} time={task.time || "—"} title={task.title} action={lang === "ru" ? "Добавить" : "Add"} onPress={() => health.toggleTask(task.id)} divider={index < tasks.length - 1} />)}{!meds.length && !tasks.length ? <View style={styles.emptyRow}><Ionicons name="checkmark-circle-outline" size={26} color={figma.green} /><Txt variant="caption" color={figma.muted}>{lang === "ru" ? "На сегодня ничего обязательного." : "Nothing urgent for today."}</Txt></View> : null}</FCard>

        <SectionHeader title={lang === "ru" ? "Быстрый check-in" : "Quick check-in"} />
        <FCard><View style={styles.checkGrid}><Check bg="#FFF6D8" icon="happy-outline" label={lang === "ru" ? "Настроение" : "Mood"} value={latestCheckin ? `${latestCheckin.mood}/5` : "—"} /><Check bg="#F1FAD0" icon="flash-outline" label={lang === "ru" ? "Энергия" : "Energy"} value={latestCheckin ? `${latestCheckin.energy}/5` : "—"} /><Check bg="#FBEAE5" icon="alert-circle-outline" label={lang === "ru" ? "Стресс" : "Stress"} value={latestCheckin ? `${latestCheckin.stress}/5` : "—"} /><Check bg="#EAF2FA" icon="heart-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={latestCheckin ? `${latestCheckin.wellbeing}/5` : "—"} /></View><Pressable onPress={() => router.push("/(tabs)/mind" as any)} style={styles.blackButton}><Txt variant="label" color="#fff" weight="bold">{lang === "ru" ? "Заполнить check-in" : "Open check-in"}</Txt></Pressable></FCard>

        <SectionHeader title={lang === "ru" ? "Системы организма" : "Body systems"} action={lang === "ru" ? "Все системы ›" : "All systems ›"} onPress={() => router.push("/(tabs)/body" as any)} />
        <FCard><View style={styles.systemHead}><RoundIcon icon="body-outline" size={38} bg={figma.bg} /><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{lang === "ru" ? "Краткая картина" : "Quick picture"}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "По доступным данным" : "From available data"}</Txt></View></View>{Object.entries(d.systemStatus).slice(0, 3).map(([key, status], index) => <View key={key}>{index ? <View style={mobileStyles.divider} /> : null}<SystemRow name={systemName(key, lang)} status={status} lang={lang} /></View>)}</FCard>

        <SectionHeader title={lang === "ru" ? "Биологический возраст" : "Biological age"} action={lang === "ru" ? "Почему так? ›" : "Why? ›"} onPress={() => router.push("/biological-age" as any)} />
        <Pressable onPress={() => router.push("/biological-age" as any)}><GradientPanel colors={gradients.bio} style={styles.bio}><View style={styles.bioLabel}><Ionicons name="time-outline" size={20} color={figma.ink} /><Txt variant="label" color={figma.soft} weight="semibold">{lang === "ru" ? "Возраст организма" : "Body age"}</Txt></View><View style={styles.bioValues}><Txt variant="display" style={styles.bioMain}>{d.bioAge ?? "—"}</Txt><View><Txt variant="h2" color={figma.soft}>{d.actualAge || "—"}</Txt><Txt variant="label" color={figma.soft}>{lang === "ru" ? "фактический" : "actual"}</Txt></View>{d.bioAge != null && d.actualAge ? <View style={[mobileStyles.pill, { backgroundColor: figma.lime }]}><Txt variant="label" weight="bold">{d.bioAge <= d.actualAge ? `−${d.actualAge - d.bioAge}` : `+${d.bioAge - d.actualAge}`} {lang === "ru" ? "г." : "y"}</Txt></View> : null}</View></GradientPanel></Pressable>

        {state.profile.cycleEnabled ? <><SectionHeader title={lang === "ru" ? "Женское здоровье" : "Women’s health"} action={lang === "ru" ? "Календарь ›" : "Calendar ›"} onPress={() => router.push("/womens-health" as any)} /><Pressable onPress={() => router.push("/womens-health" as any)}><GradientPanel colors={gradients.women} style={styles.women}><View style={styles.womenHead}><Ionicons name="heart" size={20} color={figma.ink} /><Txt variant="h3">{cycle ? `${cycle.day} ${lang === "ru" ? "день цикла" : "cycle day"}` : (lang === "ru" ? "Цикл" : "Cycle")}</Txt></View>{cycle ? <><View style={[mobileStyles.pill, { backgroundColor: figma.card, marginTop: 14 }]}><Txt variant="label" weight="bold">{phaseLabel(cycle.phase, lang)}</Txt></View><Txt variant="label" color={figma.soft} style={{ marginTop: 10 }}>{lang === "ru" ? `Следующая менструация примерно через ${cycle.nextInDays} дн.` : `Next period in about ${cycle.nextInDays} days`}</Txt></> : null}<Pressable onPress={() => router.push("/cycle" as any)} style={styles.symptomButton}><Txt variant="label" weight="bold">{lang === "ru" ? "Отметить симптомы" : "Log symptoms"}</Txt></Pressable></GradientPanel></Pressable></> : null}

        <SectionHeader title={lang === "ru" ? "Последние показатели" : "Latest metrics"} action={lang === "ru" ? "История ›" : "History ›"} onPress={() => router.push("/history" as any)} />
        <FCard style={{ paddingVertical: 3 }}><Metric icon="pulse-outline" label={lang === "ru" ? "Давление" : "Pressure"} value={latestBp ? `${latestBp.sys}/${latestBp.dia}` : "—"} /><View style={mobileStyles.divider} /><Metric icon="flask-outline" label={latestLab?.name || (lang === "ru" ? "Анализы" : "Labs")} value={latestLab ? `${latestLab.value}${latestLab.unit ? ` ${latestLab.unit}` : ""}` : "—"} /><View style={mobileStyles.divider} /><Metric icon="happy-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={latestCheckin ? `${latestCheckin.wellbeing}/5` : "—"} /></FCard>
        <View style={{ marginTop: 20 }}><AddCard dark title={lang === "ru" ? "Добавить данные" : "Add data"} subtitle={lang === "ru" ? "Анализ, давление, симптом, лекарство…" : "Lab, pressure, symptom, medication…"} onPress={() => open()} /></View>
      </View>
    </ScrollView>
  </View>;
}

function statusColor(status: StatusKind) { return status === "normal" ? figma.green : status === "attention" ? figma.orange : figma.muted; }
function statusLabel(status: StatusKind, lang: string) { if (status === "normal") return lang === "ru" ? "Стабильно" : "Stable"; if (status === "attention") return lang === "ru" ? "Есть изменения" : "Changes"; return lang === "ru" ? "Недостаточно данных" : "Not enough data"; }
function Signal({ icon, title, sub, status }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; status: StatusKind }) { return <View style={styles.signal}><Ionicons name={icon} size={19} color={figma.ink} /><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{title}</Txt><Txt variant="label" color={figma.muted} numberOfLines={2}>{sub}</Txt></View><View style={[styles.dot, { backgroundColor: statusColor(status) }]} /></View>; }
function TaskRow({ done, time, title, action, onPress, divider }: { done: boolean; time: string; title: string; action: string; onPress: () => void; divider: boolean }) { return <><Pressable onPress={onPress} style={styles.task}><View style={[styles.taskState, done && { backgroundColor: figma.lime, borderColor: figma.lime }]}>{done ? <Ionicons name="checkmark" size={13} color={figma.ink} /> : null}</View><Txt variant="label" color={figma.muted} style={{ width: 45 }}>{time}</Txt><Txt variant="caption" weight="bold" style={{ flex: 1 }} numberOfLines={2}>{title}</Txt><Txt variant="label" color={done ? figma.green : figma.ink} weight="semibold">{action}</Txt></Pressable>{divider ? <View style={[mobileStyles.divider, { marginLeft: 34 }]} /> : null}</>; }
function Check({ bg, icon, label, value }: { bg: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={[styles.check, { backgroundColor: bg }]}><Ionicons name={icon} size={22} color={figma.ink} /><Txt variant="label" color={figma.soft} style={{ fontSize: 9 }}>{label}</Txt><Txt variant="label" weight="bold">{value}</Txt></View>; }
function SystemRow({ name, status, lang }: { name: string; status: StatusKind; lang: string }) { return <View style={styles.systemRow}><Txt variant="label" weight="semibold" style={{ flex: 1 }}>{name}</Txt><View style={[styles.dot, { backgroundColor: statusColor(status) }]} /><Txt variant="label" color={statusColor(status)}>{statusLabel(status, lang)}</Txt></View>; }
function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={styles.metric}><Ionicons name={icon} size={20} color={figma.muted} /><Txt variant="label" weight="semibold" style={{ flex: 1 }}>{label}</Txt><Txt variant="label" weight="bold">{value}</Txt></View>; }
function systemName(key: string, lang: string) { const ru: Record<string, string> = { cardio: "Сердечно-сосудистая", nervous: "Нервная", respiratory: "Дыхательная", digestive: "Пищеварительная", endocrine: "Эндокринная", urinary: "Мочевыделительная", reproductive: "Репродуктивная", musculoskeletal: "Опорно-двигательная", immune: "Иммунная" }; return lang === "ru" ? (ru[key] || key) : key.replace(/_/g, " "); }
function phaseLabel(phase: "menstrual" | "follicular" | "ovulation" | "luteal", lang: string) { const ru = { menstrual: "Менструальная фаза", follicular: "Фолликулярная фаза", ovulation: "Овуляция", luteal: "Лютеиновая фаза" }; const en = { menstrual: "Menstrual phase", follicular: "Follicular phase", ovulation: "Ovulation", luteal: "Luteal phase" }; return (lang === "ru" ? ru : en)[phase]; }

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brand: { flexDirection: "row", alignItems: "center", gap: 8 }, mark: { width: 22, height: 22, borderRadius: 7, backgroundColor: figma.red, alignItems: "center", justifyContent: "center" }, brandText: { fontSize: 22 }, headerActions: { flexDirection: "row", gap: 10 }, greeting: { marginTop: 10, fontSize: 18, lineHeight: 24 }, notice: { marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: figma.divider, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: figma.card },
  statusHero: { minHeight: 190 }, spread: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, score: { fontSize: 62, lineHeight: 66, color: figma.ink }, readiness: { alignItems: "flex-end", maxWidth: 130 }, heroCopy: { marginTop: 14, lineHeight: 20 }, aiCard: { minHeight: 118 }, aiLabel: { flexDirection: "row", alignItems: "center", gap: 8 }, attention: { paddingVertical: 2 }, signal: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10 }, dot: { width: 9, height: 9, borderRadius: 5 }, today: { paddingVertical: 4 }, task: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 9 }, taskState: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: figma.divider, alignItems: "center", justifyContent: "center" }, emptyRow: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: 12 }, checkGrid: { flexDirection: "row", gap: 6 }, check: { flex: 1, height: 94, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6 }, blackButton: { height: 40, borderRadius: 999, backgroundColor: figma.ink, alignItems: "center", justifyContent: "center", marginTop: 12 }, systemHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }, systemRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }, bio: { minHeight: 148 }, bioLabel: { flexDirection: "row", alignItems: "center", gap: 10 }, bioValues: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }, bioMain: { fontSize: 48, lineHeight: 52, color: figma.ink }, women: { minHeight: 174 }, womenHead: { flexDirection: "row", alignItems: "center", gap: 10 }, symptomButton: { alignSelf: "flex-end", marginTop: 16, minHeight: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: figma.card, alignItems: "center", justifyContent: "center" }, metric: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
});
