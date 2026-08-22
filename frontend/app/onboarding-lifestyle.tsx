import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const SCALE = [0, 1, 2, 3, 4, 5];
const SCALE_COLORS = [colors.error, "#F47E4C", colors.warning, "#D8C84C", "#8DBB58", colors.success];

const formatTimeInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const normalizeTime = (value: string) => {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const initialScale = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(5, number)) : null;
};

export default function OnboardingLifestyleScreen() {
  const { activeId, activeProfile, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = activeProfile?.lifestyle || {};

  const [sleepQuality, setSleepQuality] = useState<number | null>(initialScale(current.sleep_quality));
  const [sleepHours, setSleepHours] = useState(current.sleep_hours ? String(current.sleep_hours) : "");
  const [noRegularSleepTime, setNoRegularSleepTime] = useState(current.sleep_schedule_mode === "range");
  const [bedtime, setBedtime] = useState(formatTimeInput(String(current.bedtime || "")));
  const [wakeTime, setWakeTime] = useState(formatTimeInput(String(current.wake_time || "")));
  const [bedtimeFrom, setBedtimeFrom] = useState(formatTimeInput(String(current.bedtime_range_start || "")));
  const [bedtimeTo, setBedtimeTo] = useState(formatTimeInput(String(current.bedtime_range_end || "")));
  const [wakeFrom, setWakeFrom] = useState(formatTimeInput(String(current.wake_time_range_start || "")));
  const [wakeTo, setWakeTo] = useState(formatTimeInput(String(current.wake_time_range_end || "")));
  const [sleepIssues, setSleepIssues] = useState<string[]>(Array.isArray(current.sleep_issues) ? current.sleep_issues : []);
  const storedStress = initialScale(current.stress_level);
  const [stressWellbeing, setStressWellbeing] = useState<number | null>(storedStress === null ? null : 5 - storedStress);
  const [mood, setMood] = useState<number | null>(initialScale(current.mood_level));
  const [energy, setEnergy] = useState<number | null>(initialScale(current.energy_level));
  const [activity, setActivity] = useState(String(current.physical_activity || ""));
  const [nicotine, setNicotine] = useState(String(current.nicotine || ""));
  const [alcohol, setAlcohol] = useState(String(current.alcohol || ""));
  const [caffeine, setCaffeine] = useState(String(current.caffeine || ""));
  const [workType, setWorkType] = useState(String(current.work_type || ""));
  const [dietType, setDietType] = useState(String(current.diet_type || ""));
  const [dietRestrictions, setDietRestrictions] = useState(String(current.diet_restrictions || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => !!activeId, [activeId]);
  const numberOrNull = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;

  const toggleSleepIssue = (id: string) => {
    setSleepIssues((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const validateTimeValue = (value: string, label: string) => {
    if (!value.trim()) return null;
    if (normalizeTime(value)) return null;
    return ru ? `Проверьте время «${label}». Используйте формат ЧЧ:ММ` : `Check “${label}”. Use HH:MM format`;
  };

  const validateSleepTimes = () => {
    if (!noRegularSleepTime) {
      return validateTimeValue(bedtime, ru ? "Обычно ложусь" : "Usual bedtime")
        || validateTimeValue(wakeTime, ru ? "Обычно просыпаюсь" : "Usual wake time");
    }
    const pairs = [
      [bedtimeFrom, bedtimeTo, ru ? "интервал отхода ко сну" : "bedtime range"],
      [wakeFrom, wakeTo, ru ? "интервал пробуждения" : "wake-up range"],
    ];
    for (const [from, to, label] of pairs) {
      if (!!from.trim() !== !!to.trim()) {
        return ru ? `Для «${label}» укажите обе границы: от и до` : `Enter both start and end for the ${label}`;
      }
      const invalid = validateTimeValue(from, `${label}: ${ru ? "от" : "from"}`) || validateTimeValue(to, `${label}: ${ru ? "до" : "to"}`);
      if (invalid) return invalid;
    }
    return null;
  };

  const continueToMedications = async () => {
    if (!activeId) return;
    const timeError = validateSleepTimes();
    if (timeError) {
      setError(timeError);
      return;
    }
    const sleepHoursValue = numberOrNull(sleepHours);
    if (sleepHoursValue !== null && (!Number.isFinite(sleepHoursValue) || sleepHoursValue < 0 || sleepHoursValue > 24)) {
      setError(ru ? "Проверьте среднюю продолжительность сна" : "Check average sleep duration");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.updateProfile(activeId, {
        lifestyle: {
          ...current,
          sleep_quality: sleepQuality,
          sleep_hours: sleepHoursValue,
          sleep_schedule_mode: noRegularSleepTime ? "range" : "regular",
          bedtime: noRegularSleepTime ? null : (normalizeTime(bedtime) || null),
          wake_time: noRegularSleepTime ? null : (normalizeTime(wakeTime) || null),
          bedtime_range_start: noRegularSleepTime ? (normalizeTime(bedtimeFrom) || null) : null,
          bedtime_range_end: noRegularSleepTime ? (normalizeTime(bedtimeTo) || null) : null,
          wake_time_range_start: noRegularSleepTime ? (normalizeTime(wakeFrom) || null) : null,
          wake_time_range_end: noRegularSleepTime ? (normalizeTime(wakeTo) || null) : null,
          sleep_issues: sleepIssues,
          // Existing storage uses “higher = more stress”. The UI is intentionally
          // “0 = bad / 5 = good”, so invert only at the storage boundary.
          stress_level: stressWellbeing === null ? null : 5 - stressWellbeing,
          mood_level: mood,
          energy_level: energy,
          physical_activity: activity || null,
          nicotine: nicotine || null,
          alcohol: alcohol || null,
          caffeine: caffeine || null,
          work_type: workType || null,
          diet_type: dietType.trim() || null,
          diet_restrictions: dietRestrictions.trim() || null,
        },
        onboarding_completed: false,
      });
      await reload();
      router.push("/onboarding-medications" as any);
    } catch {
      setError(ru ? "Не удалось сохранить образ жизни" : "Could not save lifestyle data");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile(activeId, { onboarding_completed: false });
      await reload();
      router.push("/onboarding-medications" as any);
    } catch {
      setError(ru ? "Не удалось продолжить настройку" : "Could not continue setup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={s.progressRow}>
        <Text style={s.eyebrow}>AIDA · 3/4</Text>
        <View
          style={s.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={ru ? "Прогресс настройки Аиды" : "Aida setup progress"}
          accessibilityValue={{ min: 0, max: 4, now: 3, text: ru ? "Шаг 3 из 4" : "Step 3 of 4" }}
        >
          <View accessible={false} style={[s.progressFill, { width: "75%" }]} />
        </View>
      </View>
      <Text style={s.title}>{ru ? "Сон и образ жизни" : "Sleep & lifestyle"}</Text>
      <Text style={s.subtitle}>{ru ? "Это помогает Аиде учитывать ваш обычный ритм. Все поля необязательные." : "This helps Aida understand your usual rhythm. Every field is optional."}</Text>

      <Section title={ru ? "Сон" : "Sleep"}>
        <ScaleField label={ru ? "Качество сна" : "Sleep quality"} value={sleepQuality} onChange={setSleepQuality} low={ru ? "Плохо" : "Poor"} high={ru ? "Отлично" : "Great"} />
        <Field label={ru ? "Средняя продолжительность сна, часов" : "Average sleep duration, hours"} value={sleepHours} onChangeText={setSleepHours} keyboardType="decimal-pad" placeholder={ru ? "Напр. 7,5" : "e.g. 7.5"} />

        <CheckQuestion
          label={ru ? "Нет регулярного времени сна" : "I do not have a regular sleep time"}
          checked={noRegularSleepTime}
          onPress={() => setNoRegularSleepTime((value) => !value)}
        />

        {!noRegularSleepTime ? (
          <View style={s.two}>
            <View style={s.half}><TimeField label={ru ? "Обычно ложусь" : "Usual bedtime"} value={bedtime} onChange={setBedtime} placeholder="23:00" /></View>
            <View style={s.half}><TimeField label={ru ? "Обычно просыпаюсь" : "Usual wake time"} value={wakeTime} onChange={setWakeTime} placeholder="07:00" /></View>
          </View>
        ) : (
          <View style={s.rangeBlock}>
            <Text style={s.help}>{ru ? "Укажите примерный диапазон. Например: ложусь с 22:30 до 01:00." : "Enter an approximate range, e.g. bedtime from 22:30 to 01:00."}</Text>
            <Text style={s.rangeTitle}>{ru ? "Обычно ложусь в интервале" : "Usual bedtime range"}</Text>
            <View style={s.two}>
              <View style={s.half}><TimeField label={ru ? "От" : "From"} value={bedtimeFrom} onChange={setBedtimeFrom} placeholder="22:30" /></View>
              <View style={s.half}><TimeField label={ru ? "До" : "To"} value={bedtimeTo} onChange={setBedtimeTo} placeholder="01:00" /></View>
            </View>
            <Text style={s.rangeTitle}>{ru ? "Обычно просыпаюсь в интервале" : "Usual wake-up range"}</Text>
            <View style={s.two}>
              <View style={s.half}><TimeField label={ru ? "От" : "From"} value={wakeFrom} onChange={setWakeFrom} placeholder="06:30" /></View>
              <View style={s.half}><TimeField label={ru ? "До" : "To"} value={wakeTo} onChange={setWakeTo} placeholder="09:00" /></View>
            </View>
          </View>
        )}

        <Text style={s.label}>{ru ? "Что бывает со сном" : "Sleep issues"}</Text>
        <View style={s.chips}>{[
          ["falling_asleep", ru ? "Трудно заснуть" : "Trouble falling asleep"],
          ["night_waking", ru ? "Ночные пробуждения" : "Night waking"],
          ["not_restored", ru ? "Не чувствую восстановления" : "Not restored"],
        ].map(([id,label]) => <Choice key={id} label={label} active={sleepIssues.includes(id)} onPress={() => toggleSleepIssue(id)} />)}</View>
      </Section>

      <Section title={ru ? "Самочувствие" : "Wellbeing"}>
        <ScaleField label={ru ? "Стресс / внутреннее спокойствие" : "Stress / calmness"} value={stressWellbeing} onChange={setStressWellbeing} low={ru ? "Очень высокий стресс" : "Very stressed"} high={ru ? "Спокойно" : "Calm"} />
        <ScaleField label={ru ? "Настроение" : "Mood"} value={mood} onChange={setMood} low={ru ? "Очень плохо" : "Very low"} high={ru ? "Отлично" : "Great"} />
        <ScaleField label={ru ? "Уровень энергии" : "Energy level"} value={energy} onChange={setEnergy} low={ru ? "Нет сил" : "No energy"} high={ru ? "Много сил" : "High energy"} />
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

      {error ? <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={s.actions}>
        <Pressable style={s.secondary} onPress={() => router.back()} disabled={busy} accessibilityRole="button" accessibilityLabel={ru ? "Назад" : "Back"} accessibilityState={{ disabled: busy }}><Text style={s.secondaryText}>{ru ? "Назад" : "Back"}</Text></Pressable>
        <Pressable style={[s.primary, (!canSave || busy) && { opacity: .55 }]} onPress={continueToMedications} disabled={!canSave || busy} testID="continue-lifestyle-onboarding" accessibilityRole="button" accessibilityLabel={ru ? "Продолжить" : "Continue"} accessibilityState={{ disabled: !canSave || busy, busy }}>{busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={s.primaryText}>{ru ? "Продолжить" : "Continue"}</Text>}</Pressable>
      </View>
      <Pressable style={s.skip} onPress={skip} disabled={busy} testID="skip-lifestyle-onboarding" accessibilityRole="button" accessibilityLabel={ru ? "Заполнить позже" : "Complete later"} accessibilityState={{ disabled: busy }}><Text style={s.skipText}>{ru ? "Заполнить позже" : "Complete later"}</Text></Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, styleOverride, ...props }: any) { return <View style={{ marginBottom: spacing.md }}><Text style={s.label}>{label}</Text><TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} placeholderTextColor={colors.onSurfaceSecondary} style={[s.input, styleOverride]} /></View>; }
function TimeField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <Field label={label} value={value} onChangeText={(text: string) => onChange(formatTimeInput(text))} placeholder={placeholder} keyboardType="number-pad" inputMode="numeric" maxLength={5} autoComplete="off" />; }
function CheckQuestion({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) { return <Pressable style={({ pressed }) => [s.checkRow, pressed && s.pressed]} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}><Ionicons name={checked ? "checkbox" : "square-outline"} size={23} color={colors.onSurface} /><Text style={s.checkText}>{label}</Text></Pressable>; }
function Choice({ label, active, onPress, accessibilityLabel }: { label: string; active: boolean; onPress: () => void; accessibilityLabel?: string }) { return <Pressable style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ selected: active }}><Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text></Pressable>; }
function ChoiceField({ label, value, onChange, options }: any) { return <View style={{ marginBottom: spacing.lg }}><Text style={s.label}>{label}</Text><View style={s.chips}>{options.map(([id, text]: string[]) => <Choice key={id} label={text} accessibilityLabel={`${label}: ${text}`} active={value === id} onPress={() => onChange(value === id ? "" : id)} />)}</View></View>; }
function ScaleField({ label, value, onChange, low, high }: any) { return <View style={{ marginBottom: spacing.lg }}><Text style={s.label}>{label}</Text><View style={s.scaleTrack}>{SCALE.map((item) => <Pressable key={item} style={({ pressed }) => [s.scaleSegment, { backgroundColor: SCALE_COLORS[item] }, value === item && s.scaleSelected, pressed && s.pressed]} onPress={() => onChange(value === item ? null : item)} accessibilityRole="button" accessibilityLabel={`${label}: ${item} / 5`} accessibilityState={{ selected: value === item }}><Text style={s.scaleText}>{item}</Text></Pressable>)}</View><View style={s.scaleLabels}><Text style={s.scaleHint}>{`0 · ${low}`}</Text><Text style={s.scaleHint}>{`5 · ${high}`}</Text></View></View>; }

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:720,alignSelf:"center",paddingHorizontal:spacing.xl},progressRow:{gap:8},eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:1.5,color:colors.onSurfaceSecondary},progress:{height:4,borderRadius:2,backgroundColor:colors.surfaceSecondary,overflow:"hidden"},progressFill:{height:4,backgroundColor:colors.onSurface},title:{marginTop:spacing.lg,fontSize:34,lineHeight:40,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:spacing.sm,fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,fontFamily:fonts.text},section:{marginTop:spacing.xl,backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.lg},sectionTitle:{fontSize:fontSize.lg,fontWeight:"800",color:colors.onSurface,marginBottom:spacing.md,fontFamily:fonts.display},label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7,fontFamily:fonts.text},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface,fontSize:fontSize.base},two:{flexDirection:"row",gap:spacing.md,flexWrap:"wrap"},half:{flex:1,minWidth:180},rangeBlock:{marginTop:spacing.sm},rangeTitle:{fontSize:fontSize.sm,fontWeight:"800",color:colors.onSurface,marginTop:spacing.sm,marginBottom:spacing.sm,fontFamily:fonts.text},help:{fontSize:fontSize.sm,lineHeight:19,color:colors.onSurfaceSecondary,fontFamily:fonts.text,marginBottom:spacing.sm},checkRow:{minHeight:52,flexDirection:"row",alignItems:"center",gap:10,borderRadius:radius.md,backgroundColor:colors.surface,paddingHorizontal:spacing.md,paddingVertical:10,marginBottom:spacing.md},checkText:{flex:1,color:colors.onSurface,fontWeight:"800",fontFamily:fonts.text},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{paddingHorizontal:12,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,minHeight:44,justifyContent:"center"},chipActive:{backgroundColor:colors.onSurface},chipText:{color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text},chipTextActive:{color:colors.onSurfaceInverse},scaleTrack:{flexDirection:"row",height:48,borderRadius:radius.pill,overflow:"hidden",borderWidth:1,borderColor:colors.borderStrong},scaleSegment:{flex:1,alignItems:"center",justifyContent:"center"},scaleSelected:{borderWidth:3,borderColor:colors.onSurface},scaleText:{fontWeight:"900",fontSize:fontSize.base,color:colors.onSurface,fontFamily:fonts.text},scaleLabels:{flexDirection:"row",justifyContent:"space-between",marginTop:7,gap:spacing.sm},scaleHint:{fontSize:12,color:colors.onSurfaceSecondary,flexShrink:1},pressed:{opacity:.82},actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.md,marginTop:spacing.xl},primary:{flex:1,minWidth:150,minHeight:54,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md,paddingVertical:10},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",textAlign:"center",flexShrink:1},secondary:{minWidth:110,minHeight:54,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md},secondaryText:{color:colors.onSurface,fontWeight:"800",textAlign:"center"},skip:{minHeight:50,alignItems:"center",justifyContent:"center"},skipText:{color:colors.onSurfaceSecondary,fontWeight:"700"},error:{color:colors.error,marginTop:spacing.lg}
});