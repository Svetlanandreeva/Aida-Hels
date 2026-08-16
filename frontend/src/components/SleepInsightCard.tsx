import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { getSleepInsight, SleepInsight } from "@/src/circadianApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

export function SleepInsightCard() {
  const { activeId } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [insight, setInsight] = useState<SleepInsight | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) { setInsight(null); return; }
    setLoading(true);
    try { setInsight(await getSleepInsight(activeId)); }
    catch { setInsight(null); }
    finally { setLoading(false); }
  }, [activeId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!activeId) return null;
  if (loading && !insight) return <View style={styles.card}><ActivityIndicator size="small" color={colors.onSurfaceSecondary} /></View>;
  if (!insight) return null;

  const message = ru ? insight.message_ru : insight.message_en;
  const clinical = insight.clinical_prompt ? (ru ? insight.clinical_prompt.message_ru : insight.clinical_prompt.message_en) : null;
  const personalized = insight.status === "personalized" && !!insight.suggested_window;
  const progress = Math.min(100, Math.round((insight.days_observed / Math.max(1, insight.minimum_days)) * 100));

  return <View style={styles.card} testID="sleep-insight-card">
    <View style={styles.titleRow}>
      <View style={styles.icon}><Ionicons name={personalized ? "sparkles-outline" : "analytics-outline"} size={19} color={colors.onSurface} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{ru ? "Ваш личный ритм" : "Your personal rhythm"}</Text>
        <Text style={styles.meta}>{personalized
          ? (ru ? `Уверенность: ${insight.confidence === "high" ? "высокая" : "средняя"}` : `Confidence: ${insight.confidence}`)
          : (ru ? `${insight.days_observed} из ~${insight.minimum_days} дней наблюдений` : `${insight.days_observed} of ~${insight.minimum_days} observation days`)}</Text>
      </View>
    </View>

    {personalized && insight.suggested_window ? <View style={styles.window}>
      <Text style={styles.windowLabel}>{ru ? "Окно, связанное с лучшим самочувствием" : "Window associated with better wellbeing"}</Text>
      <Text style={styles.windowTime}>{insight.suggested_window.start}–{insight.suggested_window.end}</Text>
      <Text style={styles.windowSamples}>{ru ? `${insight.suggested_window.samples} похожих ночей в выборке` : `${insight.suggested_window.samples} similar nights in the sample`}</Text>
    </View> : <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>}

    <Text style={styles.message}>{message}</Text>
    <Text style={styles.note}>{ru ? "Аида сравнивает ваш сон с вашим же самочувствием, а не подгоняет режим под среднее время для всех." : "Aida compares your sleep with your own wellbeing instead of forcing a population bedtime target."}</Text>

    {clinical ? <View style={styles.clinical}>
      <Ionicons name="medical-outline" size={19} color={colors.error} />
      <Text style={styles.clinicalText}>{clinical}</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.xl,padding:spacing.lg,borderWidth:1,borderColor:colors.border,marginBottom:spacing.md},
  titleRow:{flexDirection:"row",alignItems:"center",gap:spacing.md},icon:{width:40,height:40,borderRadius:20,backgroundColor:colors.accent,alignItems:"center",justifyContent:"center"},
  title:{fontSize:fontSize.lg,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},meta:{marginTop:2,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},
  window:{marginTop:spacing.md,padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surface},windowLabel:{fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},windowTime:{marginTop:4,fontSize:fontSize["2xl"],fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},windowSamples:{marginTop:2,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},
  progressTrack:{marginTop:spacing.md,height:7,borderRadius:4,backgroundColor:colors.surfaceTertiary,overflow:"hidden"},progressFill:{height:7,borderRadius:4,backgroundColor:colors.onSurface},
  message:{marginTop:spacing.md,fontSize:fontSize.sm,lineHeight:20,color:colors.onSurface,fontFamily:fonts.text},note:{marginTop:spacing.sm,fontSize:fontSize.sm,lineHeight:19,color:colors.onSurfaceSecondary,fontFamily:fonts.text},
  clinical:{marginTop:spacing.md,padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surface,flexDirection:"row",gap:spacing.sm,alignItems:"flex-start",borderWidth:1,borderColor:colors.border},clinicalText:{flex:1,fontSize:fontSize.sm,lineHeight:19,color:colors.onSurface,fontFamily:fonts.text},
});
