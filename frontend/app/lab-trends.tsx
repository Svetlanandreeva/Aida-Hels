import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { getLabTrends, LabTrendSeries } from "@/src/labTrendsApi";
import { Txt } from "@/src/emergent/ui";
import { FCard, figma, mobileStyles } from "@/src/emergent/figma-mobile";

const ranges = ["7д", "30д", "3м", "6м", "1г", "Все"];

export default function LabTrendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const [series, setSeries] = useState<LabTrendSeries[]>([]);
  const [labCount, setLabCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(0);
  const [range, setRange] = useState(2);

  const load = useCallback(async () => {
    if (!activeId) { setSeries([]); setLabCount(0); setLoading(false); return; }
    setLoadError(false);
    try {
      const data = await getLabTrends(activeId);
      setSeries(data.series || []);
      setLabCount(data.lab_count || 0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  const item = series[Math.min(selected, Math.max(0, series.length - 1))];
  const values = item?.points.map((p) => p.value) || [];
  const max = values.length ? Math.max(...values, 1) : 1;
  const recent = item?.points.slice(-4) || [];
  const deltaPct = useMemo(() => {
    if (!item || item.points.length < 2) return null;
    const first = item.points[0].value;
    const last = item.points[item.points.length - 1].value;
    return first === 0 ? null : Math.round(((last - first) / Math.abs(first)) * 100);
  }, [item]);

  const freq = useMemo(() => {
    if (!item?.points?.length) return [] as { label: string; count: number }[];
    const groups = new Map<string, number>();
    item.points.forEach((p) => {
      const key = String(p.date || "").slice(0, 7);
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return Array.from(groups.entries()).slice(-4).map(([label, count]) => ({ label: label.slice(5), count }));
  }, [item]);

  return <View style={mobileStyles.page}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 36 + insets.bottom }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color={figma.ink}/></Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="h1" style={styles.title}>{lang === "ru" ? "Тренды показателей" : "Biomarker trends"}</Txt>
            <Txt variant="label" color={figma.muted}>{lang === "ru" ? "Графики изменений по времени" : "Changes over time"}</Txt>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/labs" as any)} style={styles.addRound}><Ionicons name="add" size={22} color="#fff"/></Pressable>
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator color={figma.ink}/></View> : loadError ? <State icon="cloud-offline-outline" title={lang === "ru" ? "Не удалось загрузить тренды" : "Could not load trends"} text={lang === "ru" ? "Попробуйте ещё раз" : "Please try again"} action={load}/> : !activeId ? <State icon="person-circle-outline" title={lang === "ru" ? "Выберите профиль" : "Choose a profile"} text={lang === "ru" ? "Тренды строятся отдельно для каждого профиля" : "Trends are profile-specific"}/> : !series.length ? <State icon="analytics-outline" title={lang === "ru" ? "Пока нечего сравнивать" : "Nothing to compare yet"} text={labCount < 2 ? (lang === "ru" ? "Нужно минимум два анализа с повторяющимся показателем" : "At least two reports with a repeated biomarker are needed") : (lang === "ru" ? "Повторяющихся совместимых показателей пока нет" : "No compatible repeated biomarkers yet")}/> : <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {series.map((s, i) => <Pressable key={s.key} onPress={() => setSelected(i)} style={[styles.chip, i === selected && styles.chipActive]}><Txt variant="label" color={i === selected ? "#fff" : figma.muted} weight="semibold">{s.name}</Txt></Pressable>)}
          </ScrollView>

          <LinearGradient colors={["#3F3748", "#865A79", "#E17B91"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.hero}>
            <View style={styles.heroGlowA}/><View style={styles.heroGlowB}/>
            <Txt variant="h3" color="#fff">{item.name}</Txt>
            <View style={styles.heroValue}><Txt variant="display" style={styles.number}>{item.latest.raw_value ?? item.latest.value}</Txt><Txt variant="caption" color="#F4EEF3">{item.unit || ""}</Txt></View>
            <Txt variant="caption" color={item.latest.status === "normal" ? "#D9EFE2" : "#FF9E4A"} weight="bold">{item.latest.status === "low" ? (lang === "ru" ? "Ниже нормы" : "Below range") : item.latest.status === "high" ? (lang === "ru" ? "Выше нормы" : "Above range") : (lang === "ru" ? "В норме" : "In range")}</Txt>
            {deltaPct !== null ? <View style={styles.deltaPill}><Ionicons name={deltaPct <= 0 ? "trending-down" : "trending-up"} size={14} color={deltaPct <= 0 ? "#FF5D77" : "#D9EFE2"}/><Txt variant="label" color="#fff" weight="bold">{deltaPct > 0 ? "+" : ""}{deltaPct}% {lang === "ru" ? "за период" : "period"}</Txt></View> : null}
            <View style={styles.heroBars}>{recent.map((p, i) => <View key={`${p.date}-${i}`} style={[styles.heroBar, { height: 34 + Math.round((p.value / max) * 44), backgroundColor: i === recent.length - 1 && p.status !== "normal" ? "#FF9E4A" : `rgba(255,255,255,${0.28 + i * 0.05})` }]}/>)}</View>
            {deltaPct !== null ? <View style={styles.deltaRing}><Txt variant="h3" color="#fff">{deltaPct > 0 ? "+" : ""}{deltaPct}%</Txt><Txt variant="label" color="#fff">{lang === "ru" ? "за 3 мес" : "3 mo"}</Txt></View> : null}
          </LinearGradient>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ranges}>{ranges.map((r, i) => <Pressable key={r} onPress={() => setRange(i)} style={[styles.range, i === range && styles.rangeActive]}><Txt variant="label" color={i === range ? "#fff" : figma.muted} weight="semibold">{r}</Txt></Pressable>)}</ScrollView>

          <FCard style={styles.chartCard}>
            <Txt variant="h2" style={styles.sectionTitle}>{lang === "ru" ? "Динамика" : "Dynamics"}</Txt>
            <View style={styles.chartHead}><Txt variant="label" color={figma.muted}>{item.unit || ""}</Txt>{item.latest.reference ? <View style={styles.refLegend}><View style={styles.refDot}/><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Референс" : "Reference"}: {item.latest.reference}</Txt></View> : null}</View>
            <View style={styles.referenceBand}/>
            <View style={styles.gridLines}>{[0,1,2,3].map(i => <View key={i} style={styles.gridLine}/>)}</View>
            <View style={styles.chartBars}>{(values.length > 8 ? values.slice(-8) : values).map((v, i, arr) => <View key={i} style={styles.chartCol}><Txt variant="label" weight="bold" color={i === arr.length - 1 && item.latest.status !== "normal" ? "#FF7A1A" : figma.ink}>{Math.round(v * 100) / 100}</Txt><View style={[styles.chartBar, { height: 28 + Math.round((v / max) * 92), backgroundColor: i === arr.length - 1 && item.latest.status !== "normal" ? "#FF7A1A" : i % 2 ? "#C44A91" : "#D93683" }]}/></View>)}</View>
            <View style={styles.axis}>{(item.points.length > 4 ? item.points.filter((_, i) => i === 0 || i === item.points.length - 1) : item.points).map((p, i) => <Txt key={`${p.date}-${i}`} variant="label" color={figma.muted}>{p.date}</Txt>)}</View>
          </FCard>

          <FCard style={styles.compactCard}>
            <Txt variant="h3">{lang === "ru" ? "Сравнение периодов" : "Period comparison"}</Txt>
            <Txt variant="label" color={figma.muted} style={{ marginTop: 6 }}>{item.unit || ""}</Txt>
            <View style={styles.compare}>{recent.length ? recent.map((p, i) => <View key={`${p.date}-${i}`} style={styles.compareCol}><Txt variant="caption" weight="bold">{p.value}</Txt><View style={[styles.compareBar, { height: 28 + Math.round((p.value / max) * 42), backgroundColor: i === 1 ? "#D93683" : "#DDD6E8" }]}/><Txt variant="label" color={figma.muted}>{["30д","3м","6м","1г"][i] || p.date.slice(5)}</Txt></View>) : null}</View>
          </FCard>

          <FCard style={styles.frequencyCard}>
            <Txt variant="h3">{lang === "ru" ? "Частота измерений" : "Measurement frequency"}</Txt>
            <Txt variant="label" color={figma.muted} style={{ marginTop: 6 }}>{labCount} {lang === "ru" ? "анализов" : "reports"}</Txt>
            <View style={styles.frequency}>{freq.length ? freq.map((p, i) => { const fmax = Math.max(...freq.map(x => x.count), 1); return <View key={`${p.label}-${i}`} style={styles.frequencyCol}><Txt variant="label" weight="bold">{p.count}</Txt><View style={[styles.frequencyBar, { height: 18 + Math.round((p.count / fmax) * 36), backgroundColor: ["#D93683", "#C44A91", "#9B6AA6", "#8A67A2"][i % 4] }]}/><Txt variant="label" color={figma.muted}>{p.label || "—"}</Txt></View>; }) : <Txt variant="label" color={figma.muted}>{lang === "ru" ? "Появится после нескольких анализов" : "Appears after several reports"}</Txt>}</View>
          </FCard>

          <FCard style={styles.latestCard}>
            <View style={styles.latestHead}><Txt variant="h3">{lang === "ru" ? "Последние измерения" : "Latest measurements"}</Txt><Txt variant="label" color={figma.muted}>{Math.min(item.count, 3)} {lang === "ru" ? "записи" : "records"}</Txt></View>
            {item.points.slice().reverse().slice(0, 3).map((p, i) => <View key={`${p.date}-${i}`}>{i ? <View style={mobileStyles.divider}/> : null}<View style={styles.row}><View style={[styles.dot, { backgroundColor: p.status === "normal" ? figma.green : "#FF7A1A" }]}/><Txt variant="label" color={figma.muted} style={{ flex: 1 }}>{p.date}</Txt><Txt variant="h3">{p.raw_value ?? p.value}</Txt><Txt variant="label" color={figma.muted}>{item.unit || ""}</Txt><Txt variant="label" color={p.status === "normal" ? figma.green : "#FF7A1A"}>{p.status === "normal" ? (lang === "ru" ? "В норме" : "Normal") : (lang === "ru" ? "Внимание" : "Attention")}</Txt></View></View>)}
          </FCard>
        </>}
      </View>
    </ScrollView>
  </View>;
}

function State({ icon, title, text, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action?: () => void }) {
  return <View style={styles.state}><Ionicons name={icon} size={34} color={figma.muted}/><Txt variant="h2">{title}</Txt><Txt variant="label" color={figma.muted} style={{ textAlign: "center" }}>{text}</Txt>{action ? <Pressable onPress={action} style={styles.retry}><Txt variant="caption" color="#fff" weight="bold">Повторить</Txt></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: figma.card, borderWidth: 1, borderColor: "#E1E1DE", alignItems: "center", justifyContent: "center" },
  addRound: { width: 40, height: 40, borderRadius: 20, backgroundColor: figma.ink, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, lineHeight: 27 },
  chips: { gap: 8, paddingVertical: 18, paddingRight: 16 }, chip: { minHeight: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: figma.card, borderWidth: 1, borderColor: "#D9D9D6", alignItems: "center", justifyContent: "center" }, chipActive: { backgroundColor: figma.ink, borderColor: figma.ink },
  hero: { minHeight: 220, borderRadius: 30, padding: 22, overflow: "hidden" }, heroGlowA: { position: "absolute", right: -10, bottom: 22, width: 150, height: 120, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)" }, heroGlowB: { position: "absolute", left: -10, bottom: -14, width: 130, height: 85, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.06)" }, heroValue: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 }, number: { fontSize: 52, lineHeight: 58, color: "#fff" }, deltaPill: { marginTop: 14, height: 38, alignSelf: "flex-start", borderRadius: 19, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,.72)", backgroundColor: "rgba(255,255,255,.08)", flexDirection: "row", alignItems: "center", gap: 6 }, heroBars: { position: "absolute", right: 44, bottom: 30, height: 82, flexDirection: "row", alignItems: "flex-end", gap: 22 }, heroBar: { width: 20, borderRadius: 10 }, deltaRing: { position: "absolute", right: 20, top: 20, width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  ranges: { gap: 6, paddingVertical: 16 }, range: { minWidth: 50, height: 40, borderRadius: 20, backgroundColor: figma.card, borderWidth: 1, borderColor: "#D9D9D6", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }, rangeActive: { backgroundColor: figma.ink, borderColor: figma.ink },
  chartCard: { minHeight: 420, overflow: "hidden" }, sectionTitle: { fontSize: 24, lineHeight: 29 }, chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }, refLegend: { flexDirection: "row", alignItems: "center", gap: 6 }, refDot: { width: 12, height: 12, borderRadius: 4, backgroundColor: "#D9EFE2" }, referenceBand: { position: "absolute", left: 52, right: 30, top: 134, height: 164, backgroundColor: "#E9F6EE" }, gridLines: { position: "absolute", left: 52, right: 30, top: 106, height: 232, justifyContent: "space-between" }, gridLine: { height: 1, backgroundColor: "#E1E1DE" }, chartBars: { height: 250, marginTop: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingHorizontal: 30 }, chartCol: { alignItems: "center", gap: 8 }, chartBar: { width: 28, borderRadius: 9 }, axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  compactCard: { minHeight: 176 }, compare: { height: 102, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", marginTop: 6 }, compareCol: { alignItems: "center", gap: 5 }, compareBar: { width: 28, borderRadius: 9 },
  frequencyCard: { minHeight: 156 }, frequency: { minHeight: 86, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", marginTop: 4 }, frequencyCol: { alignItems: "center", gap: 4 }, frequencyBar: { width: 26, borderRadius: 9 },
  latestCard: { minHeight: 250, paddingTop: 18 }, latestHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10 }, dot: { width: 10, height: 10, borderRadius: 5 },
  state: { minHeight: 460, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, retry: { height: 44, paddingHorizontal: 20, borderRadius: 999, backgroundColor: figma.ink, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
