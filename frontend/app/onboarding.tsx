import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ["general", "Общее состояние здоровья", "General health"],
  ["labs", "Анализы и биомаркеры", "Labs and biomarkers"],
  ["symptoms", "Симптомы и самочувствие", "Symptoms and wellbeing"],
  ["pressure", "Давление и пульс", "Blood pressure and pulse"],
  ["sleep", "Сон и восстановление", "Sleep and recovery"],
  ["mental", "Психическое и эмоциональное состояние", "Mental and emotional wellbeing"],
  ["chronic", "Хроническое состояние", "Chronic condition"],
  ["meds", "Лекарства", "Medications"],
  ["women", "Женское здоровье", "Women's health"],
  ["weight", "Вес / образ жизни", "Weight / lifestyle"],
  ["other", "Другое", "Other"],
];

const WOMEN_BRANCH = [
  ["cycle", "Менструальный цикл", "Menstrual cycle"],
  ["pregnancy_planning", "Планирование беременности", "Pregnancy planning"],
  ["pregnancy", "Беременность", "Pregnancy"],
];

const DRAFT_SAVE_DEBOUNCE_MS = 900;

const splitStoredDob = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { day: match[3], month: match[2], year: match[1] } : { day: "", month: "", year: "" };
};

export default function OnboardingScreen() {
  const { activeId, activeProfile, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const initialDob = splitStoredDob(activeProfile?.dob);

  const [name, setName] = useState(activeProfile?.name === "Мой профиль" ? "" : activeProfile?.name || "");
  const [dobDay, setDobDay] = useState(initialDob.day);
  const [dobMonth, setDobMonth] = useState(initialDob.month);
  const [dobYear, setDobYear] = useState(initialDob.year);
  const [sex, setSex] = useState(activeProfile?.sex || "");
  const [height, setHeight] = useState(activeProfile?.height_cm ? String(activeProfile.height_cm) : "");
  const [weight, setWeight] = useState(activeProfile?.weight_kg ? String(activeProfile.weight_kg) : "");
  const [goals, setGoals] = useState<string[]>(activeProfile?.goals || []);
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  }, []);

  const canSave = useMemo(() => !!activeId && !!name.trim(), [activeId, name]);
  const womenRelevant = sex === "female" && goals.includes("women");

  const numericOrNull = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;
  const normalizedDob = () => {
    const day = dobDay.trim();
    const month = dobMonth.trim();
    const year = dobYear.trim();
    if (!day && !month && !year) return null;
    if (!day || !month || !year) return "";
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const currentPayload = (overrides: Record<string, any> = {}) => ({
    name: name.trim() || activeProfile?.name || "",
    dob: normalizedDob() || null,
    sex: sex || null,
    height_cm: numericOrNull(height),
    weight_kg: numericOrNull(weight),
    goals,
    preferred_locale: lang,
    ...overrides,
  });

  const validateOptionalFields = () => {
    const day = Number(dobDay);
    const month = Number(dobMonth);
    const year = Number(dobYear);
    const hasAnyDob = !!(dobDay.trim() || dobMonth.trim() || dobYear.trim());
    const hasFullDob = !!(dobDay.trim() && dobMonth.trim() && dobYear.trim());
    if (hasAnyDob && !hasFullDob) return ru ? "Заполните дату рождения полностью: день, месяц и год" : "Complete the full date of birth: day, month and year";
    if (hasFullDob) {
      const candidate = new Date(Date.UTC(year, month - 1, day));
      const valid = Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)
        && year >= 1900 && year <= new Date().getUTCFullYear()
        && month >= 1 && month <= 12 && day >= 1 && day <= 31
        && candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
      if (!valid) return ru ? "Проверьте дату рождения" : "Check the date of birth";
    }
    const h = numericOrNull(height);
    const w = numericOrNull(weight);
    if (h !== null && (!Number.isFinite(h) || h <= 0)) return ru ? "Проверьте рост" : "Check height";
    if (w !== null && (!Number.isFinite(w) || w <= 0)) return ru ? "Проверьте вес" : "Check weight";
    return null;
  };

  const saveDraft = (overrides: Record<string, any> = {}) => {
    if (!activeId) return Promise.resolve();
    const validationError = validateOptionalFields();
    if (validationError) return Promise.resolve();

    const previous = draftRequestRef.current ?? Promise.resolve();
    const request = previous.catch(() => {}).then(async () => {
      setDraftBusy(true);
      setDraftSaved(false);
      try {
        await api.updateProfile(activeId, {
          ...currentPayload(overrides),
          onboarding_completed: false,
        });
        setDraftSaved(true);
      } catch {
        // Draft persistence is best-effort; final save still shows an explicit error.
      } finally {
        setDraftBusy(false);
      }
    });
    draftRequestRef.current = request;
    void request.finally(() => {
      if (draftRequestRef.current === request) draftRequestRef.current = null;
    });
    return request;
  };

  const scheduleDraft = (overrides: Record<string, any> = {}) => {
    if (!activeId) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    setDraftSaved(false);
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null;
      void saveDraft(overrides);
    }, DRAFT_SAVE_DEBOUNCE_MS);
  };

  const setSexAndPersist = (value: string) => {
    setSex(value);
    const nextGoals = value === "female" ? goals : goals.filter((goal) => !["women", "cycle", "pregnancy_planning", "pregnancy"].includes(goal));
    if (value !== "female") setGoals(nextGoals);
    scheduleDraft({ sex: value || null, goals: nextGoals });
  };

  const toggleGoal = (goal: string) => {
    let next = goals.includes(goal) ? goals.filter((g) => g !== goal) : [...goals, goal];
    if (goal === "women" && goals.includes("women")) {
      next = next.filter((g) => !["cycle", "pregnancy_planning", "pregnancy"].includes(g));
    }
    setGoals(next);
    scheduleDraft({ goals: next });
  };

  const continueFlow = async (skipDetails = false) => {
    if (!activeId || !name.trim()) return setError(ru ? "Укажите имя" : "Enter your name");
    const validationError = validateOptionalFields();
    if (!skipDetails && validationError) return setError(validationError);

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    setBusy(true);
    setError(null);
    try {
      if (draftRequestRef.current) await draftRequestRef.current;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      await api.updateProfile(activeId, {
        name: name.trim(),
        dob: skipDetails ? activeProfile?.dob : normalizedDob(),
        sex: skipDetails ? activeProfile?.sex : (sex || null),
        height_cm: skipDetails ? activeProfile?.height_cm : numericOrNull(height),
        weight_kg: skipDetails ? activeProfile?.weight_kg : numericOrNull(weight),
        goals: skipDetails ? (activeProfile?.goals || goals) : goals,
        onboarding_completed: skipDetails,
        preferred_locale: lang,
        timezone: tz,
      });
      await reload();
      if (skipDetails) router.replace("/(tabs)" as any);
      else router.push("/onboarding-medical" as any);
    } catch {
      setError(ru ? "Не удалось сохранить профиль" : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView
    style={styles.page}
    contentContainerStyle={[
      styles.content,
      {
        paddingHorizontal: responsive.contentPadding,
        paddingTop: insets.top + 28,
        paddingBottom: insets.bottom + 36,
      },
    ]}
    keyboardShouldPersistTaps="handled"
  >
    <View style={styles.progressWrap}>
      <Text style={styles.eyebrow}>AIDA · 1/4</Text>
      <View
        style={styles.progress}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={ru ? "Прогресс настройки" : "Setup progress"}
        accessibilityValue={{ min: 0, max: 4, now: 1, text: ru ? "Шаг 1 из 4" : "Step 1 of 4" }}
      >
        <View style={styles.progressFill} />
      </View>
    </View>
    <View style={styles.brand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Ionicons name="sparkles" size={20} color={colors.onSurfaceInverse} /></View>
    <Text style={styles.title}>{ru ? "Настроим Аиду под вас" : "Set up Aida for you"}</Text>
    <Text style={styles.subtitle}>{ru ? "Медицинские поля можно пропустить и заполнить позже. Никаких выдуманных значений Аида не подставит." : "Medical fields are optional and can be completed later. Aida never invents missing values."}</Text>
    <View style={styles.draftState} accessibilityLiveRegion="polite">
      <Ionicons name={draftSaved ? "checkmark-circle-outline" : "cloud-outline"} size={15} color={colors.onSurfaceSecondary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={styles.draftText}>{draftBusy ? (ru ? "Сохраняем прогресс…" : "Saving progress…") : draftSaved ? (ru ? "Прогресс сохранён" : "Progress saved") : (ru ? "Прогресс сохраняется при изменениях" : "Progress is saved as you go")}</Text>
    </View>

    <Section title={ru ? "Основное" : "Basics"}>
      <Input label={ru ? "Имя *" : "Name *"} value={name} onChangeText={setName} onBlur={() => scheduleDraft()} placeholder={ru ? "Как к вам обращаться" : "Your name"} autoCapitalize="words" textContentType="name" />
      <Text style={styles.label}>{ru ? "Дата рождения" : "Date of birth"}</Text>
      <View style={styles.dateRow}>
        <View style={styles.datePart}>
          <Text style={styles.datePartLabel}>{ru ? "День" : "Day"}</Text>
          <TextInput accessibilityLabel={ru ? "День рождения" : "Birth day"} value={dobDay} onChangeText={(value) => setDobDay(value.replace(/\D/g, "").slice(0, 2))} onBlur={() => scheduleDraft()} placeholder="ДД" placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input, styles.dateInput]} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={styles.datePart}>
          <Text style={styles.datePartLabel}>{ru ? "Месяц" : "Month"}</Text>
          <TextInput accessibilityLabel={ru ? "Месяц рождения" : "Birth month"} value={dobMonth} onChangeText={(value) => setDobMonth(value.replace(/\D/g, "").slice(0, 2))} onBlur={() => scheduleDraft()} placeholder="ММ" placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input, styles.dateInput]} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={[styles.datePart, styles.dateYear]}>
          <Text style={styles.datePartLabel}>{ru ? "Год" : "Year"}</Text>
          <TextInput accessibilityLabel={ru ? "Год рождения" : "Birth year"} value={dobYear} onChangeText={(value) => setDobYear(value.replace(/\D/g, "").slice(0, 4))} onBlur={() => scheduleDraft()} placeholder="ГГГГ" placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input, styles.dateInput]} keyboardType="number-pad" maxLength={4} />
        </View>
      </View>
      <Text style={styles.dateHint}>{ru ? "День · месяц · год" : "Day · month · year"}</Text>
      <Text style={styles.label}>{ru ? "Пол / медицинский контекст" : "Sex / medical context"}</Text>
      <View style={styles.row}>{[["female", ru ? "Женский" : "Female"], ["male", ru ? "Мужской" : "Male"], ["", ru ? "Не указывать" : "Prefer not to say"]].map(([v,l]) => <Pressable
        key={l}
        style={({ pressed }) => [styles.chip, sex === v && styles.chipActive, pressed && styles.pressed]}
        onPress={() => setSexAndPersist(v)}
        accessibilityRole="radio"
        accessibilityState={{ selected: sex === v }}
        accessibilityLabel={l}
      ><Text style={[styles.chipText, sex === v && styles.chipTextActive]}>{l}</Text></Pressable>)}</View>
      <View style={styles.two}><View style={styles.half}><Input label={ru ? "Рост, см" : "Height, cm"} value={height} onChangeText={setHeight} onBlur={() => scheduleDraft()} placeholder="168" keyboardType="decimal-pad" /></View><View style={styles.half}><Input label={ru ? "Вес, кг" : "Weight, kg"} value={weight} onChangeText={setWeight} onBlur={() => scheduleDraft()} placeholder="65" keyboardType="decimal-pad" /></View></View>
    </Section>

    <Section title={ru ? "Что важно отслеживать" : "What matters to you"}>
      <View style={styles.goals}>{GOALS.filter((g) => g[0] !== "women" || sex === "female").map(([id, r, e]) => {
        const selected = goals.includes(id);
        const label = ru ? r : e;
        return <Pressable
          key={id}
          onPress={() => toggleGoal(id)}
          style={({ pressed }) => [styles.goal, selected && styles.goalActive, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={label}
        ><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={colors.onSurface} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /><Text style={styles.goalText}>{label}</Text></Pressable>;
      })}</View>

      {womenRelevant ? <View style={styles.branch}>
        <Text style={styles.branchTitle}>{ru ? "Уточните сценарий женского здоровья" : "Choose the women's health scenario"}</Text>
        <View style={styles.goals}>{WOMEN_BRANCH.map(([id, r, e]) => {
          const selected = goals.includes(id);
          const label = ru ? r : e;
          return <Pressable
            key={id}
            onPress={() => toggleGoal(id)}
            style={({ pressed }) => [styles.goal, selected && styles.goalActive, pressed && styles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
          ><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={colors.onSurface} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /><Text style={styles.goalText}>{label}</Text></Pressable>;
        })}</View>
      </View> : null}
    </Section>

    {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}
    <Pressable
      disabled={!canSave || busy}
      style={({ pressed }) => [styles.primary, (!canSave || busy) && styles.disabled, pressed && canSave && !busy && styles.pressed]}
      onPress={() => continueFlow(false)}
      accessibilityRole="button"
      accessibilityLabel={ru ? "Продолжить" : "Continue"}
      accessibilityState={{ disabled: !canSave || busy, busy }}
    >{busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.primaryText}>{ru ? "Продолжить" : "Continue"}</Text>}</Pressable>
    <Pressable
      disabled={busy}
      style={({ pressed }) => [styles.skip, pressed && !busy && styles.pressed]}
      onPress={() => continueFlow(true)}
      accessibilityRole="button"
      accessibilityLabel={ru ? "Заполнить остальное позже" : "Complete the rest later"}
      accessibilityState={{ disabled: busy, busy }}
    ><Text style={styles.skipText}>{ru ? "Заполнить остальное позже" : "Complete the rest later"}</Text></Pressable>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Input(props: any) { const { label, ...rest } = props; return <View style={{ marginBottom: spacing.md }}><Text style={styles.label}>{label}</Text><TextInput {...rest} accessibilityLabel={rest.accessibilityLabel || label} placeholderTextColor={colors.onSurfaceSecondary} style={styles.input} /></View>; }

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface}, content:{width:"100%",maxWidth:720,alignSelf:"center"},
  progressWrap:{gap:8},progress:{height:4,borderRadius:2,backgroundColor:colors.surfaceSecondary,overflow:"hidden"},progressFill:{height:4,width:"25%",backgroundColor:colors.onSurface},
  brand:{marginTop:spacing.lg,width:44,height:44,borderRadius:22,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"}, eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:2,color:colors.onSurfaceSecondary},
  title:{marginTop:spacing.lg,fontSize:34,lineHeight:40,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface}, subtitle:{marginTop:spacing.sm,fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,fontFamily:fonts.text},
  draftState:{marginTop:spacing.sm,flexDirection:"row",alignItems:"center",gap:6},draftText:{fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text,flexShrink:1},
  section:{marginTop:spacing.xl,backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.lg}, sectionTitle:{fontSize:fontSize.lg,fontWeight:"800",color:colors.onSurface,marginBottom:spacing.lg,fontFamily:fonts.display},
  label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7,fontFamily:fonts.text}, input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface,fontSize:fontSize.base},
  dateRow:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,alignItems:"flex-end"},datePart:{flex:1,minWidth:80},dateYear:{flex:1.25,minWidth:112},datePartLabel:{fontSize:12,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:6,fontFamily:fonts.text},dateInput:{textAlign:"center",paddingHorizontal:10},dateHint:{fontSize:12,color:colors.onSurfaceSecondary,marginTop:6,marginBottom:spacing.md,fontFamily:fonts.text},
  row:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:spacing.md}, chip:{minHeight:44,paddingHorizontal:14,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},chipActive:{backgroundColor:colors.onSurface},chipText:{color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text,textAlign:"center"},chipTextActive:{color:colors.onSurfaceInverse},
  two:{flexDirection:"row",gap:spacing.md,flexWrap:"wrap"},half:{flex:1,minWidth:180},goals:{gap:8},goal:{flexDirection:"row",alignItems:"center",gap:10,minHeight:46,paddingHorizontal:spacing.md,paddingVertical:10,borderRadius:radius.md,backgroundColor:colors.surface},goalActive:{borderWidth:1,borderColor:colors.onSurface},goalText:{fontSize:fontSize.base,color:colors.onSurface,fontFamily:fonts.text,flex:1},
  branch:{marginTop:spacing.lg,paddingTop:spacing.lg,borderTopWidth:1,borderTopColor:colors.divider},branchTitle:{fontSize:fontSize.sm,fontWeight:"800",color:colors.onSurfaceSecondary,marginBottom:spacing.sm,fontFamily:fonts.text},
  error:{color:colors.error,marginTop:spacing.lg,fontFamily:fonts.text},primary:{marginTop:spacing.xl,minHeight:56,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.lg,paddingVertical:spacing.sm},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text,textAlign:"center",flexShrink:1},skip:{minHeight:50,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md},skipText:{color:colors.onSurfaceSecondary,fontWeight:"700",fontFamily:fonts.text,textAlign:"center",flexShrink:1},
  pressed:{opacity:.72},disabled:{opacity:.55}
});