import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type Mode = "cycle" | "planning" | "pregnancy" | "off";

export default function WomensHealthScreen() {
  const { activeId, activeProfile, reload } = useApp(); const { lang } = useI18n(); const ru = lang === "ru";
  const insets = useSafeAreaInsets(); const router = useRouter();
  const current = activeProfile?.women_health || {};
  const [mode, setMode] = useState<Mode>((current.mode as Mode) || "off");
  const [lastPeriod, setLastPeriod] = useState(current.last_period_start || "");
  const [cycleLength, setCycleLength] = useState(String(current.cycle_length || 28));
  const [periodLength, setPeriodLength] = useState(String(current.period_length || 5));
  const [regularity, setRegularity] = useState(current.regularity || "unknown");
  const [dueDate, setDueDate] = useState(current.due_date || "");
  const [planningSince, setPlanningSince] = useState(current.planning_since || "");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    if (!activeId) return; setBusy(true); setMessage(null);
    const payload: Record<string, any> = { mode };
    if (mode === "cycle") Object.assign(payload, { last_period_start: lastPeriod || null, cycle_length: Number(cycleLength) || 28, period_length: Number(periodLength) || 5, regularity });
    if (mode === "planning") Object.assign(payload, { planning_since: planningSince || null });
    if (mode === "pregnancy") Object.assign(payload, { due_date: dueDate || null });
    try { await api.updateProfile(activeId, { women_health: payload }); await reload(); setMessage(ru ? "Сохранено" : "Saved"); }
    finally { setBusy(false); }
  };

  return <ScrollView style={s.page} contentContainerStyle={[s.content,{paddingTop:insets.top+20,paddingBottom:insets.bottom+36}]}>
    <Pressable style={s.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.onSurface}/></Pressable>
    <Text style={s.title}>{ru ? "Женское здоровье" : "Women's health"}</Text>
    <Text style={s.sub}>{ru ? "Режимы не смешиваются: цикл, планирование и беременность хранятся как отдельный текущий контекст." : "Cycle, planning and pregnancy are mutually exclusive current contexts."}</Text>
    <View style={s.modes}>{(["cycle","planning","pregnancy","off"] as Mode[]).map((m)=><Pressable key={m} style={[s.mode,mode===m&&s.modeOn]} onPress={()=>setMode(m)}><Text style={[s.modeText,mode===m&&s.modeTextOn]}>{m==="cycle"?(ru?"Цикл":"Cycle"):m==="planning"?(ru?"Планирование":"Planning"):m==="pregnancy"?(ru?"Беременность":"Pregnancy"):(ru?"Выключено":"Off")}</Text></Pressable>)}</View>
    {mode==="cycle"&&<Card title={ru?"Цикл":"Cycle"}><Field label={ru?"Первый день последней менструации":"Last period start"} value={lastPeriod} onChangeText={setLastPeriod} placeholder="YYYY-MM-DD"/><View style={s.row}><View style={s.half}><Field label={ru?"Длина цикла":"Cycle length"} value={cycleLength} onChangeText={setCycleLength} keyboardType="number-pad"/></View><View style={s.half}><Field label={ru?"Дней менструации":"Period days"} value={periodLength} onChangeText={setPeriodLength} keyboardType="number-pad"/></View></View><Text style={s.label}>{ru?"Регулярность":"Regularity"}</Text><View style={s.modes}>{["regular","irregular","unknown"].map((v)=><Pressable key={v} style={[s.small,regularity===v&&s.smallOn]} onPress={()=>setRegularity(v)}><Text>{v==="regular"?(ru?"Регулярный":"Regular"):v==="irregular"?(ru?"Нерегулярный":"Irregular"):(ru?"Не знаю":"Unknown")}</Text></Pressable>)}</View></Card>}
    {mode==="planning"&&<Card title={ru?"Планирование беременности":"Pregnancy planning"}><Field label={ru?"Планируем с":"Planning since"} value={planningSince} onChangeText={setPlanningSince} placeholder="YYYY-MM-DD"/><Text style={s.note}>{ru?"Аида будет использовать этот контекст только там, где он релевантен, и не будет трактовать его как беременность.":"Aida will use this context only where relevant and will not treat it as pregnancy."}</Text></Card>}
    {mode==="pregnancy"&&<Card title={ru?"Беременность":"Pregnancy"}><Field label={ru?"Предполагаемая дата родов":"Estimated due date"} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD"/><Text style={s.note}>{ru?"Срок рассчитывается из указанной даты. Медицинские решения приложение по этому расчёту не принимает.":"Gestational timing is derived from this date and is not used for medical decisions."}</Text></Card>}
    {message?<Text style={s.ok}>{message}</Text>:null}<Pressable style={s.save} onPress={save} disabled={busy}>{busy?<ActivityIndicator color={colors.onSurfaceInverse}/>:<Text style={s.saveText}>{ru?"Сохранить":"Save"}</Text>}</Pressable>
  </ScrollView>;
}
function Card({title,children}:{title:string;children:React.ReactNode}){return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>}
function Field({label,...props}:any){return <View style={{marginBottom:spacing.md}}><Text style={s.label}>{label}</Text><TextInput {...props} style={s.input} placeholderTextColor={colors.onSurfaceSecondary}/></View>}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:760,alignSelf:"center",paddingHorizontal:spacing.xl},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},title:{fontSize:32,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.display,marginTop:spacing.lg},sub:{fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,marginTop:spacing.sm},modes:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:spacing.lg},mode:{paddingHorizontal:15,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},modeOn:{backgroundColor:colors.onSurface},modeText:{color:colors.onSurface,fontWeight:"700"},modeTextOn:{color:colors.onSurfaceInverse},card:{marginTop:spacing.lg,padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},cardTitle:{fontSize:fontSize.lg,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface,marginBottom:spacing.lg},label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface},row:{flexDirection:"row",gap:spacing.md,flexWrap:"wrap"},half:{flex:1,minWidth:170},small:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface},smallOn:{borderWidth:1,borderColor:colors.onSurface},note:{fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary},ok:{marginTop:spacing.lg,color:colors.success,fontWeight:"700"},save:{marginTop:spacing.xl,minHeight:52,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},saveText:{color:colors.onSurfaceInverse,fontWeight:"800"}});
