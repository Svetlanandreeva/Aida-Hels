import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BodySystemInsight, getBodySystem } from "@/src/bodyApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const kindLabel = (kind: string, ru: boolean) => {
  const labels: Record<string, [string, string]> = {
    measurement: ["Измерение", "Measurement"],
    profile_measurement: ["Профиль", "Profile"],
    lab: ["Анализ", "Lab"],
    symptom: ["Симптом", "Symptom"],
    checkin: ["Check-in", "Check-in"],
    circadian: ["Режим сна", "Sleep rhythm"],
  };
  return (labels[kind] || [kind, kind])[ru ? 0 : 1];
};

export default function BodySystemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const params = useLocalSearchParams<{ systemId?: string }>();
  const systemId = String(params.systemId || "");
  const [data, setData] = useState<BodySystemInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!activeId || !systemId) { setLoading(false); return; }
    setLoading(true); setError(false);
    try { setData(await getBodySystem(activeId, systemId)); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, [activeId, systemId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = useMemo(() => data?.evidence?.[0]?.observed_at || null, [data]);

  return <ScrollView style={st.page} contentContainerStyle={[st.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 40 }]}>
    <View style={st.header}>
      <Pressable style={st.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>{data ? (ru ? data.label_ru : data.label_en) : (ru ? "Система организма" : "Body system")}</Text>
        <Text style={st.subtitle}>{ru ? "Данные и источники" : "Data and sources"}</Text>
      </View>
    </View>

    {loading ? <View style={st.center}><ActivityIndicator color={colors.onSurface} /></View> : error ? <State text={ru ? "Не удалось загрузить данные системы" : "Could not load system data"} /> : !data || data.state !== "data" ? <View style={st.card}><State text={ru ? "Для этой системы пока недостаточно данных. Аида не будет выставлять оценку здоровья без источников." : "There is not enough data for this system yet. Aida will not assign a health score without evidence."} /></View> : <>
      <View style={st.summaryCard}>
        <Text style={st.kicker}>{ru ? "ДОСТУПНЫЕ НАБЛЮДЕНИЯ" : "AVAILABLE OBSERVATIONS"}</Text>
        <Text style={st.big}>{data.evidence_count}</Text>
        <Text style={st.summary}>{ru ? "записей с источником относятся к этой системе" : "sourced records relate to this system"}</Text>
        {latest ? <Text style={st.meta}>{ru ? `Последнее наблюдение: ${String(latest).slice(0, 16).replace("T", " ")}` : `Latest observation: ${String(latest).slice(0, 16).replace("T", " ")}`}</Text> : null}
      </View>

      <Text style={st.section}>{ru ? "Evidence" : "Evidence"}</Text>
      <View style={st.list}>
        {(data.evidence || []).map((item, index) => <View key={`${item.id || item.title}-${index}`} style={st.evidenceCard}>
          <View style={st.evidenceTop}>
            <View style={st.kindPill}><Text style={st.kindText}>{kindLabel(item.kind, ru)}</Text></View>
            <Text style={st.source}>{item.source || (ru ? "Источник неизвестен" : "Unknown source")}</Text>
          </View>
          <Text style={st.evidenceTitle}>{item.title}</Text>
          {item.value !== null && item.value !== undefined && String(item.value) !== "" ? <Text style={st.value}>{String(item.value)}{item.unit ? ` ${item.unit}` : ""}</Text> : null}
          <View style={st.evidenceBottom}>
            <Text style={st.date}>{item.observed_at ? String(item.observed_at).slice(0, 16).replace("T", " ") : (ru ? "Дата не указана" : "No date")}</Text>
            <Text style={st.verification}>{item.verification_status || "recorded"}</Text>
          </View>
        </View>)}
      </View>

      <View style={st.safety}>
        <Ionicons name="shield-checkmark-outline" size={19} color={colors.onSurfaceSecondary} />
        <Text style={st.safetyText}>{ru ? "Наличие записей не означает, что система «здоровая» или «нездоровая». Этот экран показывает только факты, которые есть в профиле, и их происхождение. Медицинские выводы требуют отдельных правил и достаточных данных." : "Having records does not mean the system is healthy or unhealthy. This screen shows only facts present in the profile and their provenance. Medical conclusions require separate rules and sufficient evidence."}</Text>
      </View>
    </>}
  </ScrollView>;
}

function State({ text }: { text: string }) { return <View style={st.state}><Ionicons name="information-circle-outline" size={20} color={colors.onSurfaceSecondary} /><Text style={st.stateText}>{text}</Text></View>; }

const st = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:900,alignSelf:"center",paddingHorizontal:spacing.xl},header:{flexDirection:"row",alignItems:"center",gap:spacing.md,paddingBottom:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},title:{fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:2,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},center:{minHeight:280,alignItems:"center",justifyContent:"center"},card:{marginTop:spacing.lg,padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},summaryCard:{marginTop:spacing.lg,padding:spacing.xl,borderRadius:radius.xl,backgroundColor:colors.accent},kicker:{fontSize:11,fontWeight:"800",letterSpacing:.8,color:colors.onSurfaceSecondary,fontFamily:fonts.text},big:{fontSize:54,lineHeight:60,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface,marginTop:spacing.xs},summary:{fontSize:fontSize.base,color:colors.onSurface,fontFamily:fonts.text},meta:{marginTop:spacing.sm,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},section:{marginTop:spacing.xl,marginBottom:spacing.sm,fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},list:{gap:spacing.md},evidenceCard:{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},evidenceTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:spacing.sm},kindPill:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill,backgroundColor:colors.surface},kindText:{fontSize:11,fontWeight:"700",color:colors.onSurfaceSecondary},source:{flexShrink:1,textAlign:"right",fontSize:11,color:colors.onSurfaceSecondary},evidenceTitle:{marginTop:spacing.md,fontSize:fontSize.base,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},value:{marginTop:4,fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},evidenceBottom:{marginTop:spacing.md,flexDirection:"row",justifyContent:"space-between",gap:spacing.sm},date:{fontSize:11,color:colors.onSurfaceSecondary},verification:{fontSize:11,color:colors.onSurfaceSecondary},safety:{marginTop:spacing.lg,flexDirection:"row",gap:spacing.sm,padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary},safetyText:{flex:1,fontSize:fontSize.sm,lineHeight:19,color:colors.onSurfaceSecondary,fontFamily:fonts.text},state:{flexDirection:"row",gap:8,alignItems:"flex-start"},stateText:{flex:1,color:colors.onSurfaceSecondary,lineHeight:20,fontFamily:fonts.text}
});
