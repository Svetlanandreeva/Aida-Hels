import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const SCALE = [1, 2, 3, 4, 5];

export default function OnboardingLifestyleScreen() {
  const { activeId, activeProfile, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = activeProfile?.lifestyle || {};

  const [sleepQuality, setSleepQuality] = useState<number | null>(current.sleep_quality ?? null);
  const [sleepHours, setSleepHours] = useState(current.sleep_hours ? String(current.sleep_hours) : "");
  const [bedtime, setBedtime] = useState(String(current.bedtime || ""));
  const [wakeTime, setWakeTime] = useState(String(current.wake_time || ""));
  const [sleepIssues, setSleepIssues] = useState<string[]>(Array.isArray(current.sleep_issues) ? current.sleep_issues : []);
  const [stress, setStress] = useState<number | null>(current.stress_level ?? null);
  const [mood, setMood] = useState<number | null>(current.mood_level ?? null);
  const [energy, setEnergy] = useState<number | null>(current.energy_level ?? null);
  const [activity, setActivity] = useState(String(current.physical_activity || ""));
  const [nicotine, setNicotine] = useState(String(current.nicotine || ""));
  const [alcohol, setAlcohol] = useState(String(current.alcohol || ""));
  const [caffeine, setCaffeine] = useState(String(current.caffeine || ""));
  const [workType, setWorkType] = useState(String(current.work_type || ""));
  const [dietType, setDietType] = useState(String(current.diet_type || ""));
  const [dietRestrictions, setDietRestrictions] = useState(String(current.diet_restrictions || ""));
  const [mentalDiagnoses, setMentalDiagnoses] = useState(String(current.mental_health?.diagnoses || ""));
  const [mentalMeds, setMentalMeds] = useState(String(current.mental_health?.medications || ""));
  const [mentalNote, setMentalNote] = useState(String(current.mental_health?.note || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => !!activeId, [activeId]);
  const numberOrNull = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;

  const toggleSleepIssue = (id: string) => {
    setSleepIssues((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const finish = async () => {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile(activeId, {
        lifestyle: {
          sleep_quality: sleepQuality,
          sleep_hours: numberOrNull(sleepHours),
          bedtime: bedtime.trim() || null,
          wake_time: wakeTime.trim() || null,
          sleep_issues: sleepIssues,
          stress_level: stress,
          mood_level: mood,
          energy_level: energy,
          physical_activity: activity || null,
          nicotine: nicotine || null,
          alcohol: alcohol || null,
          caffeine: caffeine || null,
          work_type: workType || null,
          diet_type: dietType.trim() || null,
          diet_restrictions: dietRestrictions.trim() || null,
          mental_health: {
            diagnoses: mentalDiagnoses.trim() || null,
            medications: mentalMeds.trim() || null,
            note: mentalNote.trim() || null,
          },
        },
        onboarding_completed: true,
      });
      await reload();
      router.replace("/(tabs)" as any);
    } catch {
      setError(ru ? "Не удалось завершить настройку" : "Could not finish setup");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile(activeId, { onboarding_completed: true });
      await reload();
      router.replace("/(tabs)" as any);
    } catch {
      setError(ru ? "Не удалось завершить настройку" : "Could not finish setup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={s.progressRow}><Text style={s.eyebrow}>AIDA · 3/3</Text><View style={s.progress}><View style={[s.progressFill, { width: "100%" }]} /></View></View>
      <Text style={s.title}>{ru ? "Психика и образ жизни" : "Mind & lifestyle"}</Text>
      <Text style={s.subtitle}>{ru ? "Это помогает Аиде видеть контекст, а не судить о здоровье по одной цифре. Все поля необязательные." : "This gives Aida context instead of judging health from one number. Every field is optional."}</Text>

      <Section title={ru ? "Сон" : "Sleep"}>
        <ScaleField label={ru ? "Качество сна" : "Sleep quality"} value={sleepQuality} onChange={setSleepQuality} low={ru ? "Плохо" : "Poor"} high={ru ? "Отлично" : "Great"} />
        <Field label={ru ? "Средняя продолжительность сна, часов" : "Average sleep duration, hours"} value={sleepHours} onChangeText={setSleepHours} keyboardType="decimal-pad" placeholder={ru ? "Напр. 7,5" : "e.g. 7.5"} />
        <View style={s.two}><View style={s.half}><Field label={ru ? "Обычно ложусь" : "Usual bedtime"} value={bedtime} onChangeText={setBedtime} placeholder="23:00" /></View><View style={s.half}><Field label={ru ? "Обычно просыпаюсь" : "Usual wake time"} value={wakeTime} onChangeText={setWakeTime} placeholder="07:00" /></View></View>
        <Text style={s.label}>{ru ? "Что бывает со сном" : "Sleep issues"}</Text>
        <View style={s.chips}>{[
          ["falling_asleep", ru ? "Трудно заснуть" : "Trouble falling asleep"],
          ["night_waking", ru ? "Ночные пробуждения" : "Night waking"],
          ["not_restored", ru ? "Не чувствую восстановления" : "Not restored"],
        ].map(([id,label]) => <Choice key={id} label={label} active={sleepIssues.includes(id)} onPress={() => toggleSleepIssue(id)} />)}</View>
      </Section>

      <Section title={ru ? "Самочувствие" : "Wellbeing"}>
        <ScaleField label={ru ? "Уровень стресса" : "Stress level"} value={stress} onChange={setStress} low={ru ? "Низкий" : "Low"} high={ru ? "Высокий" : "High"} />
        <ScaleField label={ru ? "Настроение" : "Mood"} value={mood} onChange={setMood} low={ru ? "Тяжёлое" : "Low"} high={ru ? "Отличное" : "Great"} />
        <ScaleField label={ru ? "Уровень энергии" : "Energy level"} value={energy} onChange={setEnergy} low={ru ? "Нет сил" : "Low"} high={ru ? "Много сил" : "High"} />
      </Section>

      <Section title={ru ? "Образ жизни" : "Lifestyle"}>
        <ChoiceField label={ru ? "Физическая активность" : "Physical activity"} value={activity} onChange={setActivity} options={[["low", ru ? "Низкая" : "Low"],["moderate", ru ? "Умеренная" : "Moderate"],["high", ru ? "Высокая" : "High"]]} />
        <ChoiceField label={ru ? "Курение / вейпы" : "Smoking / vaping"} value={nicotine} onChange={setNicotine} options={[["none", ru ? "Нет" : "No"],["sometimes", ru ? "Иногда" : "Sometimes"],["daily", ru ? "Ежедневно" : "Daily"]]} />
        <ChoiceField label={ru ? "Алкоголь" : "Alcohol"} value={alcohol} onChange={setAlcohol} options={[["none", ru ? "Не употребляю" : "None"],["rare", ru ? "Редко" : "Rarely"],["weekly", ru ? "Еженедельно" : "Weekly"]]} />
        <ChoiceField label={ru ? "Кофеин" : "Caffeine"} value={caffeine} onChange={setCaffeine} options={[["none", ru ? "Нет" : "None"],["low", ru ? "1 порция/день" : "1/day"],["medium", ru ? "2–3 порции/день" : "2–3/day"],["high", ru ? "4+ порций/день" : "4+/day"]]} />
        <ChoiceField label={ru ? "Характер работы" : "Work type"} value={workType} onChange={setWorkType} options={[["sedentary", ru ? "Сидячая" : "Sedentary"],["mixed", ru ? "Смешанная" : "Mixed"],["physical", ru ? "Физическая" : "Physical"]]} />
        <Field label={ru ? "Тип питания" : "Diet type"} value={dietType} onChangeText={setDietType} placeholder={ru ? "Напр. обычное, вегетарианское" : "e.g. mixed, vegetarian"} />
        <Field label={ru ? "Пищевые ограничения" : "Dietary restrictions"} value={dietRestrictions} onChangeText={setDietRestrictions} placeholder={ru ? "Если есть" : "If any"} />
      </Section>

      <Section title={ru ? "Психическое здоровье" : "Mental health"}>
        <Text style={s.sectionHint}>{ru ? "Можно пропустить. Эти данные не заменяют консультацию специалиста." : "Optional. These details do not replace professional care."}</Text>
        <Field label={ru ? "Диагнозы" : "Diagnoses"} value={mentalDiagnoses} onChangeText={setMentalDiagnoses} placeholder={ru ? "Необязательно" : "Optional"} />
        <Field label={ru ? "Принимаемые препараты" : "Medications"} value={mentalMeds} onChangeText={setMentalMeds} placeholder={ru ? "Необязательно" : "Optional"} />
        <Field label={ru ? "Комментарий" : "Comment"} value={mentalNote} onChangeText={setMentalNote} multiline styleOverride={s.noteInput} placeholder={ru ? "Необязательно" : "Optional"} />
      </Section>

      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={s.actions}>
        <Pressable style={s.secondary} onPress={() => router.back()} disabled={busy}><Text style={s.secondaryText}>{ru ? "Назад" : "Back"}</Text></Pressable>
        <Pressable style={[s.primary, (!canSave || busy) && { opacity: .55 }]} onPress={finish} disabled={!canSave || busy} testID="finish-lifestyle-onboarding">{busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={s.primaryText}>{ru ? "Завершить настройку" : "Finish setup"}</Text>}</Pressable>
      </View>
      <Pressable style={s.skip} onPress={skip} disabled={busy} testID="skip-lifestyle-onboarding"><Text style={s.skipText}>{ru ? "Заполнить позже" : "Complete later"}</Text></Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, styleOverride, ...props }: any) { return <View style={{ marginBottom: spacing.md }}><Text style={s.label}>{label}</Text><TextInput {...props} placeholderTextColor={colors.onSurfaceSecondary} style={[s.input, styleOverride]} /></View>; }
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}><Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text></Pressable>; }
function ChoiceField({ label, value, onChange, options }: any) { return <View style={{ marginBottom: spacing.lg }}><Text style={s.label}>{label}</Text><View style={s.chips}>{options.map(([id, text]: string[]) => <Choice key={id} label={text} active={value === id} onPress={() => onChange(value === id ? "" : id)} />)}</View></View>; }
function ScaleField({ label, value, onChange, low, high }: any) { return <View style={{ marginBottom: spacing.lg }}><Text style={s.label}>{label}</Text><View style={s.scale}>{SCALE.map((item) => <Pressable key={item} style={[s.scaleButton, value === item && s.scaleActive]} onPress={() => onChange(value === item ? null : item)}><Text style={[s.scaleText, value === item && s.scaleTextActive]}>{item}</Text></Pressable>)}</View><View style={s.scaleLabels}><Text style={s.scaleHint}>{low}</Text><Text style={s.scaleHint}>{high}</Text></View></View>; }

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:720,alignSelf:"center",paddingHorizontal:spacing.xl},progressRow:{gap:8},eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:1.5,color:colors.onSurfaceSecondary},progress:{height:4,borderRadius:2,backgroundColor:colors.surfaceSecondary,overflow:"hidden"},progressFill:{height:4,backgroundColor:colors.onSurface},title:{marginTop:spacing.lg,fontSize:34,lineHeight:40,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:spacing.sm,fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,fontFamily:fonts.text},section:{marginTop:spacing.xl,backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.lg},sectionTitle:{fontSize:fontSize.lg,fontWeight:"800",color:colors.onSurface,marginBottom:spacing.md,fontFamily:fonts.display},sectionHint:{fontSize:fontSize.sm,color:colors.onSurfaceSecondary,lineHeight:20,marginBottom:spacing.lg},label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7,fontFamily:fonts.text},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface,fontSize:fontSize.base},noteInput:{minHeight:90,paddingTop:spacing.md,textAlignVertical:"top"},two:{flexDirection:"row",gap:spacing.md,flexWrap:"wrap"},half:{flex:1,minWidth:180},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{paddingHorizontal:12,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,minHeight:42,justifyContent:"center"},chipActive:{backgroundColor:colors.onSurface},chipText:{color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text},chipTextActive:{color:colors.onSurfaceInverse},scale:{flexDirection:"row",gap:8},scaleButton:{flex:1,minWidth:44,minHeight:46,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},scaleActive:{backgroundColor:colors.onSurface},scaleText:{fontWeight:"800",color:colors.onSurface},scaleTextActive:{color:colors.onSurfaceInverse},scaleLabels:{flexDirection:"row",justifyContent:"space-between",marginTop:6},scaleHint:{fontSize:12,color:colors.onSurfaceSecondary},actions:{flexDirection:"row",gap:spacing.md,marginTop:spacing.xl},primary:{flex:1,minHeight:54,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800"},secondary:{minWidth:110,minHeight:54,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},secondaryText:{color:colors.onSurface,fontWeight:"800"},skip:{minHeight:50,alignItems:"center",justifyContent:"center"},skipText:{color:colors.onSurfaceSecondary,fontWeight:"700"},error:{color:colors.error,marginTop:spacing.lg}
});