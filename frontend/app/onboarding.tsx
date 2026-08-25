import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const GOALS = [
  ["general", "Общее состояние здоровья", "General health"], ["labs", "Анализы и биомаркеры", "Labs and biomarkers"],
  ["symptoms", "Симптомы и самочувствие", "Symptoms and wellbeing"], ["pressure", "Давление и пульс", "Blood pressure and pulse"],
  ["sleep", "Сон и восстановление", "Sleep and recovery"], ["mental", "Психическое и эмоциональное состояние", "Mental and emotional wellbeing"],
  ["chronic", "Хроническое состояние", "Chronic condition"], ["meds", "Лекарства", "Medications"],
  ["women", "Женское здоровье", "Women's health"], ["weight", "Вес / образ жизни", "Weight / lifestyle"], ["other", "Другое", "Other"],
];
const WOMEN_BRANCH = [["cycle", "Менструальный цикл", "Menstrual cycle"], ["pregnancy_planning", "Планирование беременности", "Pregnancy planning"], ["pregnancy", "Беременность", "Pregnancy"]];
type Step = "name" | "dob" | "sex" | "height" | "weight" | "goals" | "women";
const splitDob = (value?: string | null) => { const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? { day:m[3], month:m[2], year:m[1] } : { day:"", month:"", year:"" }; };

export default function OnboardingScreen() {
  const { activeId, activeProfile, reload } = useApp(); const { lang } = useI18n(); const ru = lang === "ru"; const router = useRouter();
  const insets = useSafeAreaInsets(); const responsive = useResponsiveLayout(); const initialDob = splitDob(activeProfile?.dob);
  const [step,setStep] = useState<Step>("name"); const [name,setName] = useState(activeProfile?.name === "Мой профиль" ? "" : activeProfile?.name || "");
  const [dobDay,setDobDay]=useState(initialDob.day), [dobMonth,setDobMonth]=useState(initialDob.month), [dobYear,setDobYear]=useState(initialDob.year);
  const [sex,setSex]=useState(activeProfile?.sex || ""), [height,setHeight]=useState(activeProfile?.height_cm ? String(activeProfile.height_cm) : ""), [weight,setWeight]=useState(activeProfile?.weight_kg ? String(activeProfile.weight_kg) : "");
  const [goals,setGoals]=useState<string[]>(activeProfile?.goals || []); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  const steps = useMemo<Step[]>(() => ["name","dob","sex","height","weight","goals", ...(sex === "female" && goals.includes("women") ? ["women" as Step] : [])], [sex,goals]);
  const index = Math.max(0, steps.indexOf(step)); const numeric = (v:string) => v.trim() ? Number(v.replace(",",".")) : null;
  const dob = () => dobDay && dobMonth && dobYear ? `${dobYear.padStart(4,"0")}-${dobMonth.padStart(2,"0")}-${dobDay.padStart(2,"0")}` : null;
  const toggleGoal=(id:string)=>setGoals((old)=>old.includes(id)?old.filter((g)=>g!==id):[...old,id]);
  const persistDraft = async () => { if (!activeId) return; try { await api.updateProfile(activeId,{name:name.trim()||activeProfile?.name||"Мой профиль",dob:dob(),sex:sex||null,height_cm:numeric(height),weight_kg:numeric(weight),goals,onboarding_completed:false,preferred_locale:lang}); } catch {} };
  const next = async () => {
    setError(null); if (step === "name" && !name.trim()) return setError(ru?"Укажите имя":"Enter your name");
    if (step === "dob" && (dobDay||dobMonth||dobYear) && !dob()) return setError(ru?"Укажите дату полностью или пропустите":"Complete the date or skip it");
    if (step === "height" && numeric(height)!==null && (!Number.isFinite(numeric(height)) || Number(height)<=0)) return setError(ru?"Проверьте рост":"Check height");
    if (step === "weight" && numeric(weight)!==null && (!Number.isFinite(numeric(weight)) || Number(weight)<=0)) return setError(ru?"Проверьте вес":"Check weight");
    await persistDraft(); const nextStep=steps[index+1]; if(nextStep) setStep(nextStep); else await finish();
  };
  const finish=async()=>{ if(!activeId||!name.trim()) return; setBusy(true); setError(null); try { const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||null; await api.updateProfile(activeId,{name:name.trim(),dob:dob(),sex:sex||null,height_cm:numeric(height),weight_kg:numeric(weight),goals,onboarding_completed:false,preferred_locale:lang,timezone:tz}); await reload(); router.push("/onboarding-medical" as any); } catch { setError(ru?"Не удалось сохранить профиль":"Could not save profile"); } finally { setBusy(false); } };
  const skipAll=async()=>{ if(!activeId||!name.trim()) return setError(ru?"Сначала укажите имя":"Enter your name first"); setBusy(true); try { await api.updateProfile(activeId,{name:name.trim(),onboarding_completed:true,preferred_locale:lang,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||null}); await reload(); router.replace("/(tabs)" as any); } catch { setError(ru?"Не удалось сохранить профиль":"Could not save profile"); } finally { setBusy(false); } };
  const back=()=>{ if(index>0) setStep(steps[index-1]); else router.back(); };

  const question = step === "name" ? (ru?"Как к вам обращаться?":"What should we call you?") : step === "dob" ? (ru?"Когда вы родились?":"When were you born?") : step === "sex" ? (ru?"Укажите пол / медицинский контекст":"Sex / medical context") : step === "height" ? (ru?"Какой у вас рост?":"What is your height?") : step === "weight" ? (ru?"Какой у вас вес?":"What is your weight?") : step === "goals" ? (ru?"Что для вас важно отслеживать?":"What matters to you?") : (ru?"Что именно в женском здоровье важно?":"What matters in women's health?");
  return <ScrollView style={styles.page} contentContainerStyle={[styles.content,{paddingHorizontal:responsive.contentPadding,paddingTop:insets.top+18,paddingBottom:insets.bottom+28}]} keyboardShouldPersistTaps="handled">
    <View style={styles.top}><Pressable onPress={back} style={styles.back} accessibilityRole="button"><Ionicons name="chevron-back" size={22} color={colors.onSurface}/></Pressable><Text style={styles.eyebrow}>AIDA · {index+1}/{steps.length}</Text></View>
    <View style={styles.progress}><View style={[styles.progressFill,{width:`${((index+1)/steps.length)*100}%` as any}]}/></View>
    <View style={styles.card} testID={`onboarding-step-${step}`}><Text style={styles.title}>{question}</Text><Text style={styles.subtitle}>{ru?"Один вопрос за раз. Ответ можно изменить позже в профиле.":"One question at a time. You can change it later in Profile."}</Text>
      {step==="name"&&<Input value={name} onChangeText={setName} placeholder={ru?"Ваше имя":"Your name"} autoFocus autoCapitalize="words"/>}
      {step==="dob"&&<><View style={styles.dateRow}><Input value={dobDay} onChangeText={(v:string)=>setDobDay(v.replace(/\D/g,"").slice(0,2))} placeholder={ru?"ДД":"DD"} keyboardType="number-pad" maxLength={2}/><Input value={dobMonth} onChangeText={(v:string)=>setDobMonth(v.replace(/\D/g,"").slice(0,2))} placeholder={ru?"ММ":"MM"} keyboardType="number-pad" maxLength={2}/><Input value={dobYear} onChangeText={(v:string)=>setDobYear(v.replace(/\D/g,"").slice(0,4))} placeholder={ru?"ГГГГ":"YYYY"} keyboardType="number-pad" maxLength={4}/></View><Skip onPress={next} text={ru?"Пропустить дату рождения":"Skip date of birth"}/></>}
      {step==="sex"&&<View style={styles.options}>{[["female",ru?"Женский":"Female"],["male",ru?"Мужской":"Male"],["",ru?"Не указывать":"Prefer not to say"]].map(([v,l])=><Choice key={l} label={l} selected={sex===v} onPress={()=>setSex(v)}/>)}</View>}
      {step==="height"&&<><Input value={height} onChangeText={setHeight} placeholder={ru?"Например, 168 см":"For example, 168 cm"} keyboardType="decimal-pad"/><Skip onPress={next} text={ru?"Пропустить рост":"Skip height"}/></>}
      {step==="weight"&&<><Input value={weight} onChangeText={setWeight} placeholder={ru?"Например, 65 кг":"For example, 65 kg"} keyboardType="decimal-pad"/><Skip onPress={next} text={ru?"Пропустить вес":"Skip weight"}/></>}
      {step==="goals"&&<View style={styles.options}>{GOALS.filter((g)=>g[0]!=="women"||sex==="female").map(([id,r,e])=><Choice key={id} label={ru?r:e} selected={goals.includes(id)} onPress={()=>toggleGoal(id)}/>)}</View>}
      {step==="women"&&<View style={styles.options}>{WOMEN_BRANCH.map(([id,r,e])=><Choice key={id} label={ru?r:e} selected={goals.includes(id)} onPress={()=>toggleGoal(id)}/>)}</View>}
      {error?<Text style={styles.error} accessibilityRole="alert">{error}</Text>:null}
      <Pressable disabled={busy} onPress={next} style={[styles.primary,busy&&styles.disabled]} accessibilityRole="button">{busy?<ActivityIndicator color={colors.onSurfaceInverse}/>:<Text style={styles.primaryText}>{index===steps.length-1?(ru?"Продолжить":"Continue"):(ru?"Далее":"Next")}</Text>}</Pressable>
    </View>
    <Pressable disabled={busy} onPress={skipAll} style={styles.skipAll}><Text style={styles.skipText}>{ru?"Заполнить остальное позже":"Complete the rest later"}</Text></Pressable>
  </ScrollView>;
}
function Input(props:any){return <TextInput {...props} placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input,props.style]}/>}
function Choice({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.choice,selected&&styles.choiceActive]} accessibilityRole="checkbox" accessibilityState={{checked:selected}}><Ionicons name={selected?"checkmark-circle":"ellipse-outline"} size={20} color={selected?colors.onSurfaceInverse:colors.onSurface}/><Text style={[styles.choiceText,selected&&styles.choiceTextActive]}>{label}</Text></Pressable>}
function Skip({onPress,text}:{onPress:()=>void;text:string}){return <Pressable onPress={onPress} style={styles.inlineSkip}><Text style={styles.skipText}>{text}</Text></Pressable>}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:620,alignSelf:"center",flexGrow:1},top:{flexDirection:"row",alignItems:"center",gap:12},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:1.5,color:colors.onSurfaceSecondary,fontFamily:fonts.text},progress:{height:4,borderRadius:2,backgroundColor:colors.surfaceSecondary,overflow:"hidden",marginTop:14},progressFill:{height:4,backgroundColor:colors.onSurface},card:{marginTop:spacing.xl},title:{fontSize:32,lineHeight:38,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:8,marginBottom:spacing.xl,fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,fontFamily:fonts.text},input:{minHeight:54,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceSecondary,paddingHorizontal:spacing.lg,color:colors.onSurface,fontSize:fontSize.lg,marginBottom:spacing.md,flex:1},dateRow:{flexDirection:"row",gap:8},options:{gap:10},choice:{minHeight:52,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceSecondary,paddingHorizontal:spacing.md,paddingVertical:12,flexDirection:"row",alignItems:"center",gap:10},choiceActive:{backgroundColor:colors.onSurface,borderColor:colors.onSurface},choiceText:{fontSize:fontSize.base,color:colors.onSurface,fontFamily:fonts.text,flex:1},choiceTextActive:{color:colors.onSurfaceInverse},primary:{marginTop:spacing.xl,minHeight:54,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text,fontSize:fontSize.base},inlineSkip:{alignItems:"center",paddingVertical:8},skipAll:{alignItems:"center",paddingVertical:18},skipText:{color:colors.onSurfaceSecondary,fontWeight:"700",fontFamily:fonts.text},error:{color:colors.error,marginTop:spacing.md,fontFamily:fonts.text},disabled:{opacity:.55}});