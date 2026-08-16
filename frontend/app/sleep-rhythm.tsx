import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Medication } from "@/src/api";
import { getCircadianDay, recordRhythmEvent, saveBedtimePlan, CircadianDay } from "@/src/circadianApi";
import { updateMedicationSchedule } from "@/src/medicationScheduleApi";
import { cancelNotificationIds, scheduleBedtimeReminder } from "@/src/notifications";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const localTime = () => `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;

type AdaptiveMedication = Medication & { first_dose_anchor?: "clock" | "wake"; wake_offset_minutes?: number };

export default function SleepRhythmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeId, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [day, setDay] = useState<CircadianDay | null>(null);
  const [meds, setMeds] = useState<AdaptiveMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [wakeTime, setWakeTime] = useState(localTime());
  const [bedtime, setBedtime] = useState("23:00");
  const date = localDate();

  const load = useCallback(async () => {
    if (!activeId) { setDay(null); setMeds([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [result, medications] = await Promise.all([getCircadianDay(activeId, date), api.listMeds(activeId)]);
      setDay(result);
      setMeds((medications as AdaptiveMedication[]).filter((m) => m.active !== false));
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
      bumpRefresh(); // forces medication reminders to be recalculated from wake time
    } finally { setBusy(null); }
  };

  const sleepNow = async () => {
    if (!activeId) return;
    setBusy("sleep");
    try {
      if (day?.plan?.notification_id) await cancelNotificationIds([day.plan.notification_id]);
      await recordRhythmEvent(activeId, "bedtime", date, localTime());
      await load();
      bumpRefresh();
    } finally { setBusy(null); }
  };

  const planSleep = async () => {
    if (!activeId || !TIME_RE.test(bedtime)) return;
    setBusy("plan");
    try {
      if (day?.plan?.notification_id) await cancelNotificationIds([day.plan.notification_id]);
      const notificationId = await scheduleBedtimeReminder({ date, time: bedtime });
      await saveBedtimePlan(activeId, date, bedtime, notificationId);
      await load();
      bumpRefresh();
    } finally { setBusy(null); }
  };

  const toggleWakeAnchor = async (med: AdaptiveMedication) => {
    const next = med.first_dose_anchor === "wake" ? "clock" : "wake";
    setBusy(`med-${med.id}`);
    try {
      await updateMedicationSchedule(med.id, { first_dose_anchor: next, wake_offset_minutes: 0 });
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
        <Text style={styles.heroText}>{ru ? "Если фактический подъём позже первой запланированной дозы, Аида сдвинет только дозы, отмеченные ниже как «от подъёма». Остальные часы останутся фиксированными." : "If you wake after the first planned dose, Aida shifts only doses explicitly marked as wake-anchored below. Other times stay fixed."}</Text>
        <View style={styles.row}><TextInput value={wakeTime} onChangeText={setWakeTime} style={styles.input} placeholder="12:00" placeholderTextColor={colors.onSurfaceSecondary} /><Pressable style={styles.primary} onPress={() => saveWake()}><Text style={styles.primaryText}>{busy === "wake" ? "…" : (ru ? "Я проснулась" : "I'm awake")}</Text></Pressable></View>
        <Pressable onPress={() => { const now = localTime(); setWakeTime(now); void saveWake(now); }} style={styles.textButton}><Text style={styles.textButtonText}>{ru ? "Отметить текущее время" : "Use current time"}</Text></Pressable>
      </View>

      <View style={[styles.card, { marginBottom: spacing.md }]}>
        <Ionicons name="medkit-outline" size={24} color={colors.onSurface} />
        <Text style={styles.cardTitle}>{ru ? "Какие лекарства связаны с подъёмом" : "Wake-anchored medications"}</Text>
        <Text style={styles.cardText}>{ru ? "Привязка действует только на первую дозу препарата. Например, план 10:00 → подъём 12:00 даст первую дозу в 12:00, но дневная и вечерняя дозы сами по себе не сдвигаются." : "The anchor affects only the first daily dose. Example: 10:00 plan + 12:00 wake makes the first dose 12:00; later doses do not automatically shift."}</Text>
        {meds.length === 0 ? <Text style={styles.saved}>{ru ? "Активных препаратов нет" : "No active medications"}</Text> : meds.map((med) => {
          const anchored = med.first_dose_anchor === "wake";
          return <Pressable key={med.id} onPress={() => toggleWakeAnchor(med)} style={styles.medRow} testID={`wake-anchor-${med.id}`}>
            <View style={{ flex: 1 }}><Text style={styles.medName}>{med.name}</Text><Text style={styles.medTime}>{(med.times || []).length ? (med.times || []).join(" · ") : (ru ? "Время не настроено" : "No schedule")}</Text></View>
            {busy === `med-${med.id}` ? <ActivityIndicator size="small" color={colors.onSurface} /> : <View style={[styles.anchorPill, anchored && styles.anchorPillOn]}><Text style={[styles.anchorText, anchored && styles.anchorTextOn]}>{anchored ? (ru ? "От подъёма" : "Wake") : (ru ? "По часам" : "Clock")}</Text></View>}
          </Pressable>;
        })}
      </View>

      <View style={styles.card}>
        <Ionicons name="moon-outline" size={26} color={colors.onSurface} />
        <Text style={styles.cardTitle}>{ru ? "Отход ко сну" : "Bedtime"}</Text>
        <Text style={styles.cardText}>{ru ? "Если ложитесь сейчас — нажмите кнопку. Если позже — укажите время: Аида сохранит план и поставит напоминание на это время, если системные уведомления разрешены." : "If you're going to bed now, tap the button. Otherwise set a time; Aida saves the plan and schedules a reminder if notifications are allowed."}</Text>
        <Pressable style={styles.darkButton} onPress={sleepNow}><Text style={styles.darkText}>{busy === "sleep" ? "…" : (ru ? "Я ложусь спать" : "I'm going to sleep")}</Text></Pressable>
        <Text style={styles.label}>{ru ? "Или планирую лечь в" : "Or I plan to sleep at"}</Text>
        <View style={styles.row}><TextInput value={bedtime} onChangeText={setBedtime} style={styles.input} placeholder="23:30" placeholderTextColor={colors.onSurfaceSecondary} /><Pressable style={styles.secondary} onPress={planSleep}><Text style={styles.secondaryText}>{busy === "plan" ? "…" : (ru ? "Запомнить" : "Save")}</Text></Pressable></View>
        {day?.plan?.planned_time ? <Text style={styles.saved}>{ru ? `План на сегодня: ${day.plan.planned_time}${day.plan.notification_id ? " · напоминание включено" : ""}` : `Today's plan: ${day.plan.planned_time}${day.plan.notification_id ? " · reminder on" : ""}`}</Text> : null}
      </View>

      <View style={styles.safety}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.onSurfaceSecondary} />
        <Text style={styles.safetyText}>{ru ? "Пропущенная доза не переносится автоматически поверх следующей. Когда наступило время следующей дозы, предыдущая становится «пропущена» и больше не предлагается как доступная к приёму. Исключения для конкретного препарата должны задаваться отдельно по назначению врача/инструкции." : "A missed dose is never automatically carried over into the next dose window. Once the next dose time arrives, the earlier one becomes missed and is no longer offered as takeable. Medication-specific exceptions require an explicit rule."}</Text>
      </View>
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},header:{paddingHorizontal:spacing.lg,paddingBottom:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border,flexDirection:"row",alignItems:"center",gap:spacing.md},back:{width:40,height:40,borderRadius:20,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},title:{fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:2,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},center:{flex:1,alignItems:"center",justifyContent:"center"},hero:{backgroundColor:colors.accent,borderRadius:radius.xl,padding:spacing.lg,marginBottom:spacing.md},heroTitle:{marginTop:spacing.md,fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},heroText:{marginTop:spacing.xs,fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary,fontFamily:fonts.text},card:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.xl,padding:spacing.lg,borderWidth:1,borderColor:colors.border},cardTitle:{marginTop:spacing.md,fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},cardText:{marginTop:spacing.xs,fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary,fontFamily:fonts.text},row:{marginTop:spacing.md,flexDirection:"row",gap:spacing.sm,alignItems:"center"},input:{flex:1,minHeight:48,borderRadius:radius.md,backgroundColor:colors.surface,paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,color:colors.onSurface,fontSize:fontSize.base},primary:{minHeight:48,paddingHorizontal:spacing.lg,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text},textButton:{marginTop:spacing.sm,alignSelf:"flex-start"},textButtonText:{color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text},darkButton:{marginTop:spacing.lg,minHeight:50,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},darkText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text},label:{marginTop:spacing.lg,fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,fontFamily:fonts.text},secondary:{minHeight:48,paddingHorizontal:spacing.lg,borderRadius:radius.pill,backgroundColor:colors.surfaceTertiary,alignItems:"center",justifyContent:"center"},secondaryText:{color:colors.onSurface,fontWeight:"800",fontFamily:fonts.text},saved:{marginTop:spacing.sm,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},medRow:{minHeight:62,flexDirection:"row",alignItems:"center",gap:spacing.md,borderTopWidth:1,borderTopColor:colors.divider,marginTop:spacing.sm,paddingTop:spacing.sm},medName:{fontSize:fontSize.base,fontWeight:"700",color:colors.onSurface,fontFamily:fonts.text},medTime:{marginTop:2,fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},anchorPill:{paddingHorizontal:10,paddingVertical:7,borderRadius:radius.pill,backgroundColor:colors.surface},anchorPillOn:{backgroundColor:colors.onSurface},anchorText:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary},anchorTextOn:{color:colors.onSurfaceInverse},safety:{marginTop:spacing.md,flexDirection:"row",gap:spacing.sm,padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary},safetyText:{flex:1,fontSize:fontSize.sm,lineHeight:19,color:colors.onSurfaceSecondary,fontFamily:fonts.text}
});
