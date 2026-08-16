import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { getCircadianDay, recordRhythmEvent, saveBedtimePlan, CircadianDay } from "@/src/circadianApi";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const localDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const localTime = () => `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

export default function SleepRhythmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeId, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [day, setDay] = useState<CircadianDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [wakeTime, setWakeTime] = useState(localTime());
  const [bedtime, setBedtime] = useState("23:00");
  const date = localDate();

  const load = useCallback(async () => {
    if (!activeId) { setDay(null); setLoading(false); return; }
    setLoading(true);
    try {
      const result = await getCircadianDay(activeId, date);
      setDay(result);
      if (result.wake?.local_time) setWakeTime(result.wake.local_time);
      if (result.plan?.planned_time) setBedtime(result.plan.planned_time);
    } finally { setLoading(false); }
  }, [activeId, date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveWake = async (time = wakeTime) => {
    if (!activeId || !TIME_RE.test(time)) return;
    setBusy("wake");
    try {
      await recordRhythmEvent(activeId, "wake", date, time);
      await load();
      bumpRefresh();
    } finally { setBusy(null); }
  };

  const sleepNow = async () => {
    if (!activeId) return;
    setBusy("sleep");
    try {
      await recordRhythmEvent(activeId, "bedtime", date, localTime());
      await load();
      bumpRefresh();
    } finally { setBusy(null); }
  };

  const planSleep = async () => {
    if (!activeId || !TIME_RE.test(bedtime)) return;
    setBusy("plan");
    try {
      await saveBedtimePlan(activeId, date, bedtime);
      await load();
      bumpRefresh();
    } finally { setBusy(null); }
  };

  const status = useMemo(() => {
    if (!day?.wake) return ru ? "Подъём сегодня ещё не отмечен" : "Wake-up has not been logged today";
    if (!day?.bedtime) return ru ? `Подъём: ${day.wake.local_time}` : `Wake-up: ${day.wake.local_time}`;
    return ru ? `Подъём ${day.wake.local_time} · сон ${day.bedtime.local_time}` : `Wake ${day.wake.local_time} · bed ${day.bedtime.local_time}`;
  }, [day, ru]);

  return <View style={styles.page}>
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.title}>{ru ? "Сон и режим" : "Sleep & rhythm"}</Text><Text style={styles.subtitle}>{status}</Text></View>
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator color={colors.onSurface} /></View> : <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
      <View style={styles.hero}>
        <Ionicons name="sunny-outline" size={26} color={colors.onSurface} />
        <Text style={styles.heroTitle}>{ru ? "Подъём" : "Wake up"}</Text>
        <Text style={styles.heroText}>{ru ? "Отметка подъёма может сдвинуть только те дозы, для которых вы отдельно разрешили привязку к пробуждению." : "Wake-up can shift only doses explicitly configured to follow waking time."}</Text>
        <View style={styles.row}><TextInput value={wakeTime} onChangeText={setWakeTime} style={styles.input} placeholder="12:00" placeholderTextColor={colors.onSurfaceSecondary} /><Pressable style={styles.primary} onPress={() => saveWake()}><Text style={styles.primaryText}>{busy === "wake" ? "…" : (ru ? "Я проснулась" : "I'm awake")}</Text></Pressable></View>
        <Pressable onPress={() => { const now = localTime(); setWakeTime(now); saveWake(now); }} style={styles.textButton}><Text style={styles.textButtonText}>{ru ? "Отметить текущее время" : "Use current time"}</Text></Pressable>
      </View>

      <View style={styles.card}>
        <Ionicons name="moon-outline" size={26} color={colors.onSurface} />
        <Text style={styles.cardTitle}>{ru ? "Отход ко сну" : "Bedtime"}</Text>
        <Text style={styles.cardText}>{ru ? "Если ложитесь сейчас — нажмите кнопку. Если позже — укажите время, и Аида будет считать его планом на сегодня." : "If you're going to bed now, tap the button. Otherwise set today's planned bedtime."}</Text>
        <Pressable style={styles.darkButton} onPress={sleepNow}><Text style={styles.darkText}>{busy === "sleep" ? "…" : (ru ? "Я ложусь спать" : "I'm going to sleep")}</Text></Pressable>
        <Text style={styles.label}>{ru ? "Или планирую лечь в" : "Or I plan to sleep at"}</Text>
        <View style={styles.row}><TextInput value={bedtime} onChangeText={setBedtime} style={styles.input} placeholder="23:30" placeholderTextColor={colors.onSurfaceSecondary} /><Pressable style={styles.secondary} onPress={planSleep}><Text style={styles.secondaryText}>{busy === "plan" ? "…" : (ru ? "Запомнить" : "Save")}</Text></Pressable></View>
        {day?.plan?.planned_time ? <Text style={styles.saved}>{ru ? `План на сегодня: ${day.plan.planned_time}` : `Today's plan: ${day.plan.planned_time}`}</Text> : null}
      </View>

      <View style={styles.safety}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.onSurfaceSecondary} />
        <Text style={styles.safetyText}>{ru ? "Аида не будет автоматически советовать принять пропущенную дозу. Когда наступило окно следующей дозы, предыдущая помечается как пропущенная и кнопка «Принять» блокируется. Правила догоняющей дозы зависят от конкретного препарата и должны задаваться отдельно." : "Aida will not automatically advise taking a missed dose. Once the next dose window begins, the earlier one is marked missed and cannot be taken from the checklist. Catch-up rules are medication-specific."}</Text>
      </View>
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},header:{paddingHorizontal:spacing.lg,paddingBottom:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border,flexDirection:"row",alignItems:"center",gap:spacing.md},back:{width:40,height:40,borderRadius:20,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},title:{fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:2,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},center:{flex:1,alignItems:"center",justifyContent:"center"},hero:{backgroundColor:colors.accent,borderRadius:radius.xl,padding:spacing.lg,marginBottom:spacing.md},heroTitle:{marginTop:spacing.md,fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},heroText:{marginTop:spacing.xs,fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary,fontFamily:fonts.text},card:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.xl,padding:spacing.lg,borderWidth:1,borderColor:colors.border},cardTitle:{marginTop:spacing.md,fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},cardText:{marginTop:spacing.xs,fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary,fontFamily:fonts.text},row:{marginTop:spacing.md,flexDirection:"row",gap:spacing.sm,alignItems:"center"},input:{flex:1,minHeight:48,borderRadius:radius.md,backgroundColor:colors.surface,paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,color:colors.onSurface,fontSize:fontSize.base},primary:{minHeight:48,paddingHorizontal:spacing.lg,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text},textButton:{marginTop:spacing.sm,alignSelf:"flex-start"},textButtonText:{color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text},darkButton:{marginTop:spacing.lg,minHeight:50,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},darkText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text},label:{marginTop:spacing.lg,fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,fontFamily:fonts.text},secondary:{minHeight:48,paddingHorizontal:spacing.lg,borderRadius:radius.pill,backgroundColor:colors.surfaceTertiary,alignItems:"center",justifyContent:"center"},secondaryText:{color:colors.onSurface,fontWeight:"800",fontFamily:fonts.text},saved:{marginTop:spacing.sm,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},safety:{marginTop:spacing.md,flexDirection:"row",gap:spacing.sm,padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary},safetyText:{flex:1,fontSize:fontSize.sm,lineHeight:19,color:colors.onSurfaceSecondary,fontFamily:fonts.text}
});
