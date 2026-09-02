import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import dayjs from "dayjs";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth, useDerived, bpStatus } from "@/src/emergent/health-context";
import { useAddSheet } from "@/src/emergent/AddSheet";
import { Txt } from "@/src/emergent/ui";
import { AddCard, FCard, figma, gradients, GradientPanel, MetricMini, mobileStyles, SectionHeader } from "@/src/emergent/figma-mobile";

export default function Pressure() {
  const { lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useHealth();
  const d = useDerived();
  const { open } = useAddSheet();
  const latest = d.latestBp;
  const readings = state.bp;
  const stats = useMemo(() => {
    if (!readings.length) return null;
    const sys = readings.map((r) => r.sys);
    const dia = readings.map((r) => r.dia);
    return { avgSys: Math.round(sys.reduce((a,b)=>a+b,0)/sys.length), avgDia: Math.round(dia.reduce((a,b)=>a+b,0)/dia.length), min: Math.min(...sys), max: Math.max(...sys) };
  }, [readings]);
  const chart = readings.slice(0, 7).reverse();

  return <View style={mobileStyles.page}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 36 }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color={figma.ink} /></Pressable><View style={{ flex: 1 }}><Txt variant="h1" style={styles.title}>{lang === "ru" ? "Давление" : "Blood pressure"}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Дневник давления и пульса" : "Blood pressure and pulse journal"}</Txt></View><Pressable onPress={() => open("bp")} style={styles.round}><Ionicons name="add" size={23} color={figma.ink} /></Pressable></View>
        <View style={{ marginTop: 18 }}><AddCard testID="pressure-add" title={lang === "ru" ? "Добавить измерение" : "Add measurement"} subtitle={lang === "ru" ? "Систолическое, диастолическое и пульс" : "Systolic, diastolic and pulse"} icon="pulse-outline" onPress={() => open("bp")} /></View>

        <View style={{ marginTop: 18 }}><GradientPanel colors={gradients.pressure} style={styles.hero}>
          <Txt variant="label" color={figma.soft} weight="semibold">{lang === "ru" ? "ПОСЛЕДНЕЕ ИЗМЕРЕНИЕ" : "LATEST READING"}</Txt>
          {latest ? <><View style={styles.heroNumbers}><Txt variant="display" style={styles.bp}>{latest.sys}</Txt><Txt variant="h1" color={figma.soft}>/</Txt><Txt variant="display" style={styles.bp}>{latest.dia}</Txt></View><Txt variant="label" color={figma.soft}>мм рт. ст.</Txt><View style={styles.heroBottom}><View style={[mobileStyles.pill, { backgroundColor: figma.card }]}><Txt variant="label" weight="bold">{bpStatus(latest) === "attention" ? (lang === "ru" ? "Требует внимания" : "Attention") : (lang === "ru" ? "В норме" : "In range")}</Txt></View><Txt variant="label" color={figma.soft}>{dayjs(latest.ts).format("D MMM, HH:mm")}</Txt></View>{latest.pulse ? <View style={styles.pulseRing}><Txt variant="h2">{latest.pulse}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "пульс" : "bpm"}</Txt></View> : null}</> : <View style={styles.emptyHero}><Txt variant="h2">— / —</Txt><Txt variant="label" color={figma.soft}>{lang === "ru" ? "Добавьте первое измерение" : "Add your first measurement"}</Txt></View>}
        </GradientPanel></View>

        <SectionHeader title={lang === "ru" ? "Сводка" : "Summary"} action={readings.length ? `${readings.length} ${lang === "ru" ? "измерений" : "readings"}` : undefined} />
        <View style={styles.metrics}><MetricMini label={lang === "ru" ? "Среднее" : "Average"} value={stats ? `${stats.avgSys}/${stats.avgDia}` : "—"} /><MetricMini label={lang === "ru" ? "Мин SYS" : "Min SYS"} value={stats ? String(stats.min) : "—"} dot={figma.lime} /><MetricMini label={lang === "ru" ? "Макс SYS" : "Max SYS"} value={stats ? String(stats.max) : "—"} dot={figma.orange} /></View>

        <SectionHeader title={lang === "ru" ? "Динамика давления" : "Pressure dynamics"} action={lang === "ru" ? "Последние 7" : "Last 7"} />
        <FCard style={styles.chartCard}>
          <View style={styles.legend}><Legend color={figma.ink} label={lang === "ru" ? "Систолическое" : "Systolic"} /><Legend color="#D8A0B6" label={lang === "ru" ? "Диастолическое" : "Diastolic"} /></View>
          {chart.length ? <View style={styles.chart}>{chart.map((r) => <View key={r.id} style={styles.chartCol}><View style={styles.pair}><View style={[styles.sysBar, { height: Math.max(30, Math.min(128, r.sys - 20)) }]} /><View style={[styles.diaBar, { height: Math.max(22, Math.min(95, r.dia - 15)) }]} /></View><Txt variant="label" color={figma.muted} style={styles.dateLabel}>{dayjs(r.ts).format("D")}</Txt></View>)}</View> : <View style={styles.noChart}><Ionicons name="analytics-outline" size={30} color={figma.muted} /><Txt variant="label" color={figma.muted}>{lang === "ru" ? "График появится после нескольких измерений" : "The chart will appear after a few readings"}</Txt></View>}
        </FCard>

        <SectionHeader title={lang === "ru" ? "История" : "History"} action={readings.length ? `${readings.length}` : undefined} />
        <FCard style={{ paddingVertical: 4 }}>{readings.length ? readings.slice(0, 6).map((r, index) => <View key={r.id}>{index ? <View style={mobileStyles.divider} /> : null}<View style={styles.historyRow}><View style={[styles.statusDot, { backgroundColor: bpStatus(r) === "attention" ? figma.orange : figma.green }]} /><Txt variant="label" color={figma.muted} style={{ flex: 1 }}>{dayjs(r.ts).format("D MMM, HH:mm")}</Txt><Txt variant="h3">{r.sys}/{r.dia}</Txt>{r.pulse ? <Txt variant="label" color={figma.muted}>{r.pulse} ♥</Txt> : null}</View></View>) : <View style={styles.noHistory}><Ionicons name="pulse-outline" size={26} color={figma.muted} /><Txt variant="caption" weight="bold">{lang === "ru" ? "Пока нет измерений" : "No readings yet"}</Txt></View>}</FCard>
      </View>
    </ScrollView>
  </View>;
}

function Legend({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Txt variant="label" color={figma.muted}>{label}</Txt></View>; }

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 }, round: { width: 40, height: 40, borderRadius: 20, backgroundColor: figma.card, alignItems: "center", justifyContent: "center" }, title: { fontSize: 27, lineHeight: 31 }, hero: { minHeight: 194, position: "relative" }, heroNumbers: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }, bp: { fontSize: 52, lineHeight: 58, color: figma.ink }, heroBottom: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }, pulseRing: { position: "absolute", top: 24, right: 18, width: 70, height: 70, borderRadius: 35, borderWidth: 6, borderColor: "rgba(255,255,255,.72)", backgroundColor: "rgba(255,255,255,.5)", alignItems: "center", justifyContent: "center" }, emptyHero: { flex: 1, minHeight: 135, justifyContent: "center", gap: 8 }, metrics: { flexDirection: "row", gap: 8 }, chartCard: { minHeight: 280 }, legend: { flexDirection: "row", gap: 20 }, legendItem: { flexDirection: "row", alignItems: "center", gap: 7 }, legendDot: { width: 9, height: 9, borderRadius: 5 }, chart: { height: 205, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 20 }, chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" }, pair: { height: 160, flexDirection: "row", alignItems: "flex-end", gap: 3 }, sysBar: { width: 12, borderRadius: 8, backgroundColor: figma.ink }, diaBar: { width: 12, borderRadius: 8, backgroundColor: "#D8A0B6" }, dateLabel: { marginTop: 8 }, noChart: { minHeight: 200, alignItems: "center", justifyContent: "center", gap: 10 }, historyRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10 }, statusDot: { width: 10, height: 10, borderRadius: 5 }, noHistory: { minHeight: 100, alignItems: "center", justifyContent: "center", gap: 8 },
});
