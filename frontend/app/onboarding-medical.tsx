import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, Surgery } from "@/src/api";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function OnboardingMedicalScreen() {
  const { activeId, activeProfile, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const women = activeProfile?.sex === "female";
  const currentWomen = activeProfile?.women_health || {};

  const [blood, setBlood] = useState(activeProfile?.blood_type || "");
  const [allergies, setAllergies] = useState((activeProfile?.allergies || []).join(", "));
  const [chronic, setChronic] = useState((activeProfile?.chronic_conditions || []).join(", "));
  const [diagnoses, setDiagnoses] = useState((activeProfile?.diagnoses || []).join(", "));
  const [surgeries, setSurgeries] = useState((activeProfile?.surgeries || []).map((x) => x.title).join(", "));
  const [trackCycle, setTrackCycle] = useState(currentWomen.track_cycle === true);
  const [lastPeriod, setLastPeriod] = useState(String(currentWomen.last_period_start || ""));
  const [cycleLength, setCycleLength] = useState(currentWomen.cycle_length ? String(currentWomen.cycle_length) : "");
  const [periodLength, setPeriodLength] = useState(currentWomen.period_length ? String(currentWomen.period_length) : "");
  const [irregular, setIrregular] = useState(currentWomen.irregular === true);
  const [children, setChildren] = useState(currentWomen.children_count ? String(currentWomen.children_count) : "");
  const [planning, setPlanning] = useState(String(currentWomen.pregnancy_plan || ""));
  const [pregnant, setPregnant] = useState(currentWomen.pregnant === true);
  const [weeks, setWeeks] = useState(currentWomen.gestational_weeks ? String(currentWomen.gestational_weeks) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => !!activeId, [activeId]);
  const numberOrNull = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;

  const continueToLifestyle = async () => {
    if (!activeId || !activeProfile) return;
    setBusy(true);
    setError(null);
    try {
      const surgeryItems: Surgery[] = splitList(surgeries).map((title, index) => ({
        id: activeProfile.surgeries?.[index]?.id || `onboarding-${Date.now()}-${index}`,
        title,
      }));
      await api.updateProfile(activeId, {
        blood_type: blood.trim() || null,
        allergies: splitList(allergies),
        chronic_conditions: splitList(chronic),
        diagnoses: splitList(diagnoses),
        surgeries: surgeryItems,
        women_health: women ? {
          ...currentWomen,
          track_cycle: trackCycle,
          last_period_start: lastPeriod.trim() || null,
          cycle_length: numberOrNull(cycleLength),
          period_length: numberOrNull(periodLength),
          irregular,
          children_count: numberOrNull(children),
          pregnancy_plan: planning || null,
          pregnant,
          gestational_weeks: pregnant ? numberOrNull(weeks) : null,
        } : currentWomen,
        onboarding_completed: false,
      });
      await reload();
      router.push("/onboarding-lifestyle" as any);
    } catch {
      setError(ru ? "Не удалось сохранить медицинскую карту" : "Could not save medical card");
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
      router.push("/onboarding-lifestyle" as any);
    } catch {
      setError(ru ? "Не удалось продолжить настройку" : "Could not continue setup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={[
        s.content,
        {
          paddingHorizontal: responsive.contentPadding,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 36,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.progressRow}>
        <Text style={s.eyebrow}>AIDA · 2/3</Text>
        <View
          style={s.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={ru ? "Прогресс настройки" : "Setup progress"}
          accessibilityValue={{ min: 0, max: 3, now: 2, text: ru ? "Шаг 2 из 3" : "Step 2 of 3" }}
        >
          <View style={[s.progressFill, { width: "66%" }]} />
        </View>
      </View>
      <Text style={s.title}>{ru ? "Медицинская карта" : "Medical card"}</Text>
      <Text style={s.subtitle}>{ru ? "Заполняйте только то, что знаете. Всё необязательное можно добавить позже." : "Only enter what you know. Optional details can be added later."}</Text>

      <Section title={ru ? "Основные медицинские данные" : "Core medical data"}>
        <Field label={ru ? "Группа крови и резус" : "Blood type and Rh"} value={blood} onChangeText={setBlood} placeholder={ru ? "Напр. A(II) Rh+" : "e.g. A+"} />
        <Field label={ru ? "Аллергии" : "Allergies"} value={allergies} onChangeText={setAllergies} placeholder={ru ? "Через запятую" : "Comma separated"} />
        <Field label={ru ? "Хронические заболевания" : "Chronic conditions"} value={chronic} onChangeText={setChronic} placeholder={ru ? "Через запятую" : "Comma separated"} />
        <Field label={ru ? "Диагнозы" : "Diagnoses"} value={diagnoses} onChangeText={setDiagnoses} placeholder={ru ? "Через запятую" : "Comma separated"} />
        <Field label={ru ? "Операции / вмешательства" : "Surgeries / procedures"} value={surgeries} onChangeText={setSurgeries} placeholder={ru ? "Через запятую" : "Comma separated"} />
        <Pressable
          style={({ pressed }) => [s.linkRow, pressed && s.pressed]}
          onPress={() => router.push("/medications" as any)}
          testID="onboarding-medications-link"
          accessibilityRole="button"
          accessibilityLabel={ru ? "Постоянные препараты" : "Regular medications"}
          accessibilityHint={ru ? "Открывает список препаратов и расписание" : "Opens medications and schedule"}
        >
          <View style={s.icon} accessible={false}><Ionicons name="medkit-outline" size={20} color={colors.onSurface} /></View>
          <View style={{ flex: 1 }}><Text style={s.linkTitle}>{ru ? "Постоянные препараты" : "Regular medications"}</Text><Text style={s.linkHint}>{ru ? "Добавить препараты и расписание" : "Add medications and schedule"}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} accessible={false} />
        </Pressable>
      </Section>

      {women ? <Section title={ru ? "Женское здоровье" : "Women's health"}>
        <Toggle label={ru ? "Отслеживать цикл" : "Track cycle"} value={trackCycle} onValueChange={setTrackCycle} />
        {trackCycle ? <>
          <Field label={ru ? "Начало последней менструации" : "Last period start"} value={lastPeriod} onChangeText={setLastPeriod} placeholder="YYYY-MM-DD" />
          <View style={s.two}><View style={s.half}><Field label={ru ? "Цикл, дней" : "Cycle, days"} value={cycleLength} onChangeText={setCycleLength} keyboardType="number-pad" /></View><View style={s.half}><Field label={ru ? "Менструация, дней" : "Period, days"} value={periodLength} onChangeText={setPeriodLength} keyboardType="number-pad" /></View></View>
          <Toggle label={ru ? "Нерегулярный цикл" : "Irregular cycle"} value={irregular} onValueChange={setIrregular} />
        </> : null}
        <Field label={ru ? "Количество детей" : "Number of children"} value={children} onChangeText={setChildren} keyboardType="number-pad" />
        <Text style={s.label}>{ru ? "Планирование беременности" : "Pregnancy planning"}</Text>
        <View style={s.chips}>{[["now", ru ? "Да, сейчас" : "Now"],["soon", ru ? "В ближайшее время" : "Soon"],["future", ru ? "В будущем" : "Future"],["no", ru ? "Нет" : "No"],["prefer_not", ru ? "Не отвечать" : "Prefer not to say"]].map(([id,label]) => <Pressable
          key={id}
          style={({ pressed }) => [s.chip, planning === id && s.chipActive, pressed && s.pressed]}
          onPress={() => setPlanning(id)}
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ selected: planning === id }}
        ><Text style={[s.chipText, planning === id && s.chipTextActive]}>{label}</Text></Pressable>)}</View>
        <Toggle label={ru ? "Я беременна" : "I am pregnant"} value={pregnant} onValueChange={setPregnant} />
        {pregnant ? <Field label={ru ? "Срок, недель" : "Gestational age, weeks"} value={weeks} onChangeText={setWeeks} keyboardType="number-pad" /> : null}
      </Section> : null}

      {error ? <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={[s.actions, responsive.isCompactPhone && s.actionsCompact]}>
        <Pressable
          style={({ pressed }) => [s.secondary, responsive.isCompactPhone && s.actionCompact, pressed && !busy && s.pressed]}
          onPress={() => router.back()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={ru ? "Назад" : "Back"}
          accessibilityState={{ disabled: busy }}
        ><Text style={s.secondaryText}>{ru ? "Назад" : "Back"}</Text></Pressable>
        <Pressable
          style={({ pressed }) => [s.primary, responsive.isCompactPhone && s.actionCompact, (!canSave || busy) && { opacity: .55 }, pressed && canSave && !busy && s.pressed]}
          onPress={continueToLifestyle}
          disabled={!canSave || busy}
          testID="continue-medical-onboarding"
          accessibilityRole="button"
          accessibilityLabel={ru ? "Продолжить" : "Continue"}
          accessibilityState={{ disabled: !canSave || busy, busy }}
        >{busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={s.primaryText}>{ru ? "Продолжить" : "Continue"}</Text>}</Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [s.skip, pressed && !busy && s.pressed]}
        onPress={skip}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={ru ? "Заполнить позже" : "Complete later"}
        accessibilityHint={ru ? "Пропускает необязательные медицинские данные" : "Skips optional medical details"}
        accessibilityState={{ disabled: busy }}
      ><Text style={s.skipText}>{ru ? "Заполнить позже" : "Complete later"}</Text></Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, ...props }: any) { return <View style={{ marginBottom: spacing.md }}><Text style={s.label}>{label}</Text><TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} placeholderTextColor={colors.onSurfaceSecondary} style={s.input} /></View>; }
function Toggle({ label, value, onValueChange }: any) { return <View style={s.toggle}><Text style={s.toggleText}>{label}</Text><Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} accessibilityRole="switch" accessibilityState={{ checked: value }} /></View>; }

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:720,alignSelf:"center"},progressRow:{gap:8},eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:1.5,color:colors.onSurfaceSecondary},progress:{height:4,borderRadius:2,backgroundColor:colors.surfaceSecondary,overflow:"hidden"},progressFill:{height:4,backgroundColor:colors.onSurface},title:{marginTop:spacing.lg,fontSize:34,lineHeight:40,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:spacing.sm,fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,fontFamily:fonts.text},section:{marginTop:spacing.xl,backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.lg},sectionTitle:{fontSize:fontSize.lg,fontWeight:"800",color:colors.onSurface,marginBottom:spacing.lg,fontFamily:fonts.display},label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7,fontFamily:fonts.text},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface,fontSize:fontSize.base,fontFamily:fonts.text},two:{flexDirection:"row",gap:spacing.md,flexWrap:"wrap"},half:{flex:1,minWidth:180},toggle:{minHeight:54,flexDirection:"row",alignItems:"center",gap:spacing.md,borderBottomWidth:1,borderBottomColor:colors.divider},toggleText:{flex:1,color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text},chips:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:spacing.md},chip:{minHeight:44,paddingHorizontal:12,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},chipActive:{backgroundColor:colors.onSurface},chipText:{color:colors.onSurface,fontWeight:"700",fontFamily:fonts.text},chipTextActive:{color:colors.onSurfaceInverse},linkRow:{minHeight:68,flexDirection:"row",alignItems:"center",gap:spacing.md,paddingTop:spacing.sm,borderRadius:radius.md},icon:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},linkTitle:{fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},linkHint:{fontSize:fontSize.sm,color:colors.onSurfaceSecondary,marginTop:2,fontFamily:fonts.text},actions:{flexDirection:"row",gap:spacing.md,marginTop:spacing.xl},actionsCompact:{flexDirection:"column"},actionCompact:{width:"100%",flex:0},primary:{flex:1,minHeight:54,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.lg},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text,textAlign:"center"},secondary:{minWidth:110,minHeight:54,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.lg},secondaryText:{color:colors.onSurface,fontWeight:"800",fontFamily:fonts.text,textAlign:"center"},skip:{minHeight:50,alignItems:"center",justifyContent:"center",borderRadius:radius.pill},skipText:{color:colors.onSurfaceSecondary,fontWeight:"700",fontFamily:fonts.text,textAlign:"center"},error:{color:colors.error,marginTop:spacing.lg,fontFamily:fonts.text},pressed:{opacity:.72}
});