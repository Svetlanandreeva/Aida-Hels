import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { pregnancyApi } from "@/src/pregnancyApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type Mode = "cycle" | "planning" | "pregnancy" | "off";

function today() { return new Date().toISOString().slice(0, 10); }

export default function WomensHealthScreen() {
  const { activeId, activeProfile, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const current = activeProfile?.women_health || {};
  const [mode, setMode] = useState<Mode>((current.mode as Mode) || "off");
  const [dueDate, setDueDate] = useState(current.due_date || "");
  const [lmpDate, setLmpDate] = useState(current.lmp_date || "");
  const [confirmedAt, setConfirmedAt] = useState(current.confirmed_at || "");
  const [planningSince, setPlanningSince] = useState(current.planning_since || "");
  const [derived, setDerived] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClinicalContext = useCallback(async () => {
    if (!activeId) return;
    setLoadingContext(true);
    setError(null);
    try {
      const response = await pregnancyApi.get(activeId);
      const record = response?.record;
      if (record?.status === "planning") setMode("planning");
      if (record?.status === "pregnant") setMode("pregnancy");
      if (record?.lmp_date) setLmpDate(String(record.lmp_date).slice(0, 10));
      if (record?.estimated_due_date) setDueDate(String(record.estimated_due_date).slice(0, 10));
      if (record?.confirmed_at) setConfirmedAt(String(record.confirmed_at).slice(0, 10));
      setDerived(response?.derived || null);
    } catch (e: any) {
      setError(e?.message || "error");
    } finally {
      setLoadingContext(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { loadClinicalContext(); }, [loadClinicalContext]));

  const save = async () => {
    if (!activeId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const profilePayload: Record<string, any> = { mode };
    if (mode === "planning") Object.assign(profilePayload, { planning_since: planningSince || null });
    if (mode === "pregnancy") Object.assign(profilePayload, { due_date: dueDate || null, lmp_date: lmpDate || null, confirmed_at: confirmedAt || null });
    try {
      if (mode === "planning") {
        const response = await pregnancyApi.save(activeId, {
          profile_id: activeId,
          status: "planning",
          notes: planningSince ? `planning_since:${planningSince}` : null,
        });
        setDerived(response?.derived || null);
      } else if (mode === "pregnancy") {
        const response = await pregnancyApi.save(activeId, {
          profile_id: activeId,
          status: "pregnant",
          lmp_date: lmpDate || null,
          estimated_due_date: dueDate || null,
          confirmed_at: confirmedAt || null,
        });
        setDerived(response?.derived || null);
      } else if (mode === "off" || mode === "cycle") {
        const existing = await pregnancyApi.get(activeId).catch(() => null);
        if (existing?.record) await pregnancyApi.complete(activeId);
        setDerived(null);
      }
      await api.updateProfile(activeId, { women_health: profilePayload });
      await reload();
      setMessage(ru ? "Сохранено" : "Saved");
    } catch (e: any) {
      setError(e?.message || "error");
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={s.page} contentContainerStyle={[s.content,{paddingTop:insets.top+20,paddingBottom:insets.bottom+36}]} keyboardShouldPersistTaps="handled">
    <Pressable style={s.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.onSurface}/></Pressable>
    <Text style={s.title}>{ru ? "Женское здоровье" : "Women's health"}</Text>
    <Text style={s.sub}>{ru ? "Цикл, планирование и подтверждённая беременность — разные контексты. Аида не выводит беременность из цикла или намерения планировать." : "Cycle, planning and confirmed pregnancy are separate contexts. Aida never infers pregnancy from cycle data or planning intent."}</Text>
    <View style={s.modes}>{(["cycle","planning","pregnancy","off"] as Mode[]).map((m)=><Pressable key={m} style={[s.mode,mode===m&&s.modeOn]} onPress={()=>setMode(m)}><Text style={[s.modeText,mode===m&&s.modeTextOn]}>{m==="cycle"?(ru?"Цикл":"Cycle"):m==="planning"?(ru?"Планирование":"Planning"):m==="pregnancy"?(ru?"Беременность":"Pregnancy"):(ru?"Выключено":"Off")}</Text></Pressable>)}</View>

    {loadingContext ? <ActivityIndicator style={{marginTop: spacing.lg}} color={colors.onSurface}/> : null}

    {mode==="cycle"&&<Card title={ru?"Менструальный цикл":"Menstrual cycle"}>
      <Text style={s.note}>{ru ? "Длина цикла, прогноз и текущий день рассчитываются только по вашим подтверждённым событиям или явно заданным настройкам. Аида не подставляет стандартные 28/5 дней." : "Cycle length, forecast and current day use only your confirmed events or explicit settings. Aida does not assume a 28/5-day default."}</Text>
      <Pressable style={s.secondaryAction} onPress={()=>router.push("/cycle" as any)} testID="open-cycle-tracker"><Ionicons name="calendar-outline" size={19} color={colors.onSurface}/><Text style={s.secondaryActionText}>{ru ? "Открыть дневник цикла" : "Open cycle tracker"}</Text><Ionicons name="chevron-forward" size={17} color={colors.onSurfaceSecondary}/></Pressable>
    </Card>}
    {mode==="planning"&&<Card title={ru?"Планирование беременности":"Pregnancy planning"}>
      <Field label={ru?"Планируем с (необязательно)":"Planning since (optional)"} value={planningSince} onChangeText={setPlanningSince} placeholder="YYYY-MM-DD"/>
      <Text style={s.note}>{ru?"Планирование хранится отдельно и не считается подтверждением беременности. Данные цикла могут использоваться только для выбранного вами трекинга цикла, а не для постановки диагноза.":"Planning is stored separately and is not treated as confirmed pregnancy. Cycle data may support the cycle tracker you chose, not a diagnosis."}</Text>
    </Card>}
    {mode==="pregnancy"&&<Card title={ru?"Подтверждённая беременность":"Confirmed pregnancy"}>
      <Field label={ru?"Дата подтверждения (необязательно)":"Confirmation date (optional)"} value={confirmedAt} onChangeText={setConfirmedAt} placeholder={today()}/>
      <Field label={ru?"Первый день последней менструации (если известен)":"First day of last menstrual period (if known)"} value={lmpDate} onChangeText={setLmpDate} placeholder="YYYY-MM-DD"/>
      <Field label={ru?"Предполагаемая дата родов (если известна)":"Estimated due date (if known)"} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD"/>
      {derived?.state === "data" ? <View style={s.derivedBox}>
        <Text style={s.derivedTitle}>{ru ? `Расчётный срок: ${derived.gestational_week} нед. ${derived.gestational_day_in_week} дн.` : `Estimated gestation: ${derived.gestational_week}w ${derived.gestational_day_in_week}d`}</Text>
        <Text style={s.note}>{ru ? `Основание: ${derived.basis === "lmp_date" ? "указанная дата последней менструации" : "указанная предполагаемая дата родов"}.` : `Basis: ${derived.basis}.`}</Text>
        <Text style={s.disclaimer}>{derived.disclaimer}</Text>
      </View> : <Text style={s.note}>{ru?"Если известна хотя бы дата последней менструации или предполагаемая дата родов, Аида покажет календарную оценку срока. Без них будет честное «недостаточно данных».":"If either LMP or an estimated due date is known, Aida can show a calendar estimate. Otherwise it stays insufficient-data."}</Text>}
    </Card>}
    {mode==="off"&&<Card title={ru?"Модуль выключен":"Module off"}><Text style={s.note}>{ru ? "Активный контекст женского здоровья будет закрыт. Исторические записи не превращаются в текущий статус." : "The active women's-health context will be closed. Historical records do not become a current status."}</Text></Card>}

    {error?<Text style={s.error}>{ru ? "Не удалось сохранить или загрузить контекст. Проверьте даты и повторите." : "Could not load or save context. Check dates and retry."}</Text>:null}
    {message?<Text style={s.ok}>{message}</Text>:null}
    <Pressable style={s.save} onPress={save} disabled={busy}>{busy?<ActivityIndicator color={colors.onSurfaceInverse}/>:<Text style={s.saveText}>{ru?"Сохранить":"Save"}</Text>}</Pressable>
  </ScrollView>;
}
function Card({title,children}:{title:string;children:React.ReactNode}){return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>}
function Field({label,...props}:any){return <View style={{marginBottom:spacing.md}}><Text style={s.label}>{label}</Text><TextInput {...props} autoCapitalize="none" style={s.input} placeholderTextColor={colors.onSurfaceSecondary}/></View>}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:760,alignSelf:"center",paddingHorizontal:spacing.xl},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},title:{fontSize:32,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.display,marginTop:spacing.lg},sub:{fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,marginTop:spacing.sm},modes:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:spacing.lg},mode:{paddingHorizontal:15,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},modeOn:{backgroundColor:colors.onSurface},modeText:{color:colors.onSurface,fontWeight:"700"},modeTextOn:{color:colors.onSurfaceInverse},card:{marginTop:spacing.lg,padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},cardTitle:{fontSize:fontSize.lg,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface,marginBottom:spacing.lg},label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface},note:{fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary},disclaimer:{fontSize:12,lineHeight:17,color:colors.onSurfaceSecondary,marginTop:spacing.sm},derivedBox:{marginTop:spacing.sm,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surface},derivedTitle:{fontSize:fontSize.base,fontWeight:"800",color:colors.onSurface,marginBottom:spacing.sm},secondaryAction:{minHeight:50,marginTop:spacing.lg,borderRadius:radius.md,backgroundColor:colors.surface,flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.md},secondaryActionText:{flex:1,fontSize:fontSize.base,fontWeight:"700",color:colors.onSurface},ok:{marginTop:spacing.lg,color:colors.success,fontWeight:"700"},error:{marginTop:spacing.lg,color:colors.error,fontWeight:"700"},save:{marginTop:spacing.xl,minHeight:52,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},saveText:{color:colors.onSurfaceInverse,fontWeight:"800"}});