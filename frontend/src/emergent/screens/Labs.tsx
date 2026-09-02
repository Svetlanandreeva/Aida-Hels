import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import dayjs from "dayjs";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth } from "@/src/emergent/health-context";
import { useLog } from "@/src/components/LogProvider";
import { Txt } from "@/src/emergent/ui";
import { AddCard, Bars, FCard, figma, MetricMini, mobileStyles, SectionHeader } from "@/src/emergent/figma-mobile";

type Filter = "all" | "normal" | "high" | "low";

export default function Labs() {
  const { lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useHealth();
  const { openLab } = useLog();
  const [filter, setFilter] = useState<Filter>("all");
  const labs = state.labs;
  const groups = useMemo(() => {
    const map = new Map<string, typeof labs>();
    labs.forEach((lab) => { const key = dayjs(lab.ts).format("YYYY-MM-DD"); map.set(key, [...(map.get(key) || []), lab]); });
    return Array.from(map.entries());
  }, [labs]);

  return <View style={mobileStyles.page}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 36 }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color={figma.ink} /></Pressable><Txt variant="h1" style={styles.title}>{lang === "ru" ? "Анализы" : "Labs"}</Txt><Pressable onPress={() => openLab()} style={styles.round}><Ionicons name="add" size={23} color={figma.ink} /></Pressable></View>
        <Txt variant="label" color={figma.muted} style={styles.subtitle}>{lang === "ru" ? "Показатели, динамика и референсы" : "Results, trends and reference ranges"}</Txt>

        <View style={{ marginTop: 18 }}><AddCard testID="labs-add" title={lang === "ru" ? "Добавить анализ" : "Add lab result"} subtitle={lang === "ru" ? "Фото, галерея или PDF — Аида распознает показатели" : "Photo, gallery or PDF — Aida recognizes biomarkers"} icon="flask-outline" onPress={() => openLab()} /></View>

        <SectionHeader title={lang === "ru" ? "Сводка" : "Summary"} action={labs.length ? `${labs.length} ${lang === "ru" ? "записей" : "records"}` : undefined} />
        <View style={styles.metrics}><MetricMini label={lang === "ru" ? "Анализов" : "Labs"} value={String(groups.length)} /><MetricMini label={lang === "ru" ? "Показателей" : "Markers"} value={String(labs.length)} dot={figma.lime} /><MetricMini label={lang === "ru" ? "Внимание" : "Attention"} value="—" dot={figma.orange} /></View>

        {labs.length ? <Pressable onPress={() => router.push("/lab-trends" as any)} style={{ marginTop: 20 }}><FCard style={styles.trendCard}><View style={styles.trendTop}><View><Txt variant="caption" color={figma.muted}>{lang === "ru" ? "Тренды показателей" : "Biomarker trends"}</Txt><Txt variant="h2" style={{ marginTop: 4 }}>{labs[0].name}</Txt></View><Ionicons name="chevron-forward" size={20} color={figma.muted} /></View><View style={styles.trendChart}><Bars values={[34, 51, 43, 62, 58, 76]} max={100} height={72} width={18} /><View style={styles.trendRing}><Txt variant="h3">{labs.length}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "точек" : "points"}</Txt></View></View></FCard></Pressable> : null}

        <SectionHeader title={lang === "ru" ? "Показатели" : "Indicators"} action={labs.length ? `${labs.length}` : undefined} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{([ ["all", lang === "ru" ? "Все" : "All"], ["normal", lang === "ru" ? "В норме" : "Normal"], ["high", lang === "ru" ? "Выше" : "High"], ["low", lang === "ru" ? "Ниже" : "Low"] ] as [Filter,string][]).map(([key,label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filter, filter === key && styles.filterActive]}><Txt variant="label" color={filter === key ? "#fff" : figma.ink} weight="semibold">{label}</Txt></Pressable>)}</ScrollView>

        {groups.length ? <View style={styles.groupStack}>{groups.map(([date, items]) => <FCard key={date} style={styles.groupCard}><View style={styles.groupHead}><View><Txt variant="label" color={figma.muted}>{dayjs(date).format("D MMMM YYYY")}</Txt><Txt variant="h3" style={{ marginTop: 3 }}>{lang === "ru" ? "Лабораторные показатели" : "Lab results"}</Txt></View><Txt variant="label" color={figma.muted}>{items.length}</Txt></View>{items.map((lab, index) => <View key={lab.id}>{index ? <View style={mobileStyles.divider} /> : null}<Pressable onPress={() => router.push("/lab-trends" as any)} style={styles.labRow}><View style={[styles.statusDot, { backgroundColor: figma.green }]} /><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{lab.name}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Референс зависит от лаборатории" : "Reference depends on laboratory"}</Txt></View><View style={styles.value}><Txt variant="h3">{lab.value}</Txt><Txt variant="label" color={figma.muted}>{lab.unit || ""}</Txt></View></Pressable></View>)}</FCard>)}</View> : <FCard style={{ marginTop: 16 }}><View style={styles.empty}><Ionicons name="flask-outline" size={28} color={figma.muted} /><View style={{ flex: 1 }}><Txt variant="caption" weight="bold">{lang === "ru" ? "Пока нет анализов" : "No labs yet"}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Загрузите первый анализ — он появится здесь после распознавания." : "Upload your first result and it will appear here after recognition."}</Txt></View></View></FCard>}

        {groups.length > 2 ? <><SectionHeader title={lang === "ru" ? "Более ранние" : "Older results"} /><AddCard title={lang === "ru" ? "Вся история анализов" : "All lab history"} subtitle={lang === "ru" ? `${groups.length} дат с результатами` : `${groups.length} result dates`} icon="time-outline" onPress={() => router.push("/history" as any)} /></> : null}
      </View>
    </ScrollView>
    <Pressable testID="labs-fab" onPress={() => openLab()} style={[styles.fab, { bottom: Math.max(insets.bottom, 14) + 12 }]}><Ionicons name="add" size={30} color="#fff" /></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 16 }, round: { width: 40, height: 40, borderRadius: 20, backgroundColor: figma.card, alignItems: "center", justifyContent: "center" }, title: { flex: 1, fontSize: 30, lineHeight: 34 }, subtitle: { marginTop: 8, marginLeft: 56 }, metrics: { flexDirection: "row", gap: 8 }, trendCard: { minHeight: 180, overflow: "hidden" }, trendTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, trendChart: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 20 }, trendRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 8, borderColor: "#F0D5DF", alignItems: "center", justifyContent: "center" }, filters: { gap: 8, paddingRight: 16 }, filter: { minWidth: 70, height: 38, borderRadius: 999, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: figma.card }, filterActive: { backgroundColor: figma.ink }, groupStack: { marginTop: 16, gap: 14 }, groupCard: { padding: 16 }, groupHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }, labRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10 }, statusDot: { width: 9, height: 9, borderRadius: 5 }, value: { minWidth: 84, alignItems: "flex-end" }, empty: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 14 }, fab: { position: "absolute", right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: "#C93B55", alignItems: "center", justifyContent: "center" },
});
