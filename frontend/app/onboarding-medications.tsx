import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, Medication } from "@/src/api";
import { searchMedicationReferences, MedicationReferenceItem } from "@/src/medicationReferenceApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const DAY_PARTS = ["morning", "day", "evening"] as const;
type DayPart = typeof DAY_PARTS[number];
type DailyAnswer = "yes" | "no" | null;
type NormalizedMedication = Medication & {
  trade_name?: string | null;
  active_ingredient?: string | null;
  active_substance_id?: number | null;
  reference_source?: string | null;
  reference_id?: string | null;
  normalization_status?: string | null;
};

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizedText(value: string | null | undefined) {
  return String(value || "").trim().toLocaleLowerCase().replace(/ё/g, "е");
}

export default function OnboardingMedicationsScreen() {
  const { activeId, reload } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [dailyAnswer, setDailyAnswer] = useState<DailyAnswer>(null);
  const [medications, setMedications] = useState<NormalizedMedication[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [nameQuery, setNameQuery] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedReference, setSelectedReference] = useState<MedicationReferenceItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [referenceItems, setReferenceItems] = useState<MedicationReferenceItem[]>([]);
  const [referenceSearching, setReferenceSearching] = useState(false);
  const [referenceReady, setReferenceReady] = useState<boolean | null>(null);
  const [referenceAvailable, setReferenceAvailable] = useState<boolean | null>(null);
  const [referenceError, setReferenceError] = useState(false);
  const [doseAmount, setDoseAmount] = useState("");
  const [doseUnit, setDoseUnit] = useState<"mg" | "tablet">("mg");
  const [dayParts, setDayParts] = useState<DayPart[]>([]);
  const [mealRelation, setMealRelation] = useState<"any" | "before" | "with" | "after">("any");
  const [savingMed, setSavingMed] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      setLoadingMeds(false);
      return;
    }
    void api.listMeds(activeId).then((items) => {
      if (cancelled) return;
      const active = items.filter((item) => item.active) as NormalizedMedication[];
      setMedications(active);
      if (active.length) setDailyAnswer((current) => current ?? "yes");
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setLoadingMeds(false);
    });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    const query = nameQuery.trim();
    if (!pickerOpen || selectedReference || query.length < 3) {
      setReferenceItems([]);
      setReferenceSearching(false);
      setReferenceError(false);
      if (query.length < 3) {
        setReferenceReady(null);
        setReferenceAvailable(null);
      }
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setReferenceSearching(true);
      setReferenceError(false);
      void searchMedicationReferences(query, 12).then((result) => {
        if (cancelled) return;
        setReferenceItems(result.items.filter((item) => !!item.reference_id && !!item.trade_name));
        setReferenceReady(result.provider_ready);
        setReferenceAvailable(result.provider_available);
      }).catch(() => {
        if (cancelled) return;
        setReferenceItems([]);
        setReferenceError(true);
        setReferenceAvailable(false);
      }).finally(() => {
        if (!cancelled) setReferenceSearching(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nameQuery, pickerOpen, selectedReference]);

  const hasExactReference = useMemo(() => {
    const query = normalizedText(nameQuery);
    return !!query && referenceItems.some((item) => normalizedText(item.trade_name) === query);
  }, [nameQuery, referenceItems]);

  const resetForm = () => {
    setNameQuery("");
    setSelectedName("");
    setSelectedReference(null);
    setPickerOpen(false);
    setReferenceItems([]);
    setReferenceSearching(false);
    setReferenceReady(null);
    setReferenceAvailable(null);
    setReferenceError(false);
    setDoseAmount("");
    setDoseUnit("mg");
    setDayParts([]);
    setMealRelation("any");
  };

  const selectReference = (item: MedicationReferenceItem) => {
    const name = String(item.trade_name || "").trim();
    if (!name || !item.reference_id) return;
    setSelectedReference(item);
    setSelectedName(name);
    setNameQuery(name);
    setPickerOpen(false);
    setError(null);
  };

  const selectManualName = () => {
    const custom = nameQuery.trim();
    if (!custom) return;
    setSelectedReference(null);
    setSelectedName(custom);
    setNameQuery(custom);
    setPickerOpen(false);
    setError(null);
  };

  const toggleDayPart = (value: DayPart) => {
    setDayParts((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const addMedication = async () => {
    if (!activeId) return;
    const name = selectedName.trim();
    const amount = Number(doseAmount.replace(",", "."));
    if (!name) {
      setError(ru ? "Выберите препарат из справочника или подтвердите введённое название" : "Choose a medication from the catalogue or confirm the typed name");
      return;
    }
    if (!doseAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(ru ? "Укажите дозировку" : "Enter a dose");
      return;
    }
    if (!dayParts.length) {
      setError(ru ? "Выберите время приёма: утро, день или вечер" : "Choose at least one time of day: morning, daytime or evening");
      return;
    }

    setSavingMed(true);
    setError(null);
    try {
      const doseLabel = doseUnit === "mg"
        ? `${doseAmount.trim()} ${ru ? "мг" : "mg"}`
        : `${doseAmount.trim()} ${ru ? "таб." : "tablet"}`;
      const created = await api.createMed({
        profile_id: activeId,
        name,
        dose: doseLabel,
        dose_amount: amount,
        dose_unit: doseUnit,
        schedule: dayParts.join(","),
        times: [],
        day_parts: dayParts,
        meal_relation: mealRelation,
        active: true,
        start_date: localDateString(),
        source: "aida",
        reference_source: selectedReference?.reference_source || "manual",
        reference_id: selectedReference?.reference_id || null,
      }) as NormalizedMedication;
      setMedications((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setDailyAnswer("yes");
      resetForm();
    } catch {
      setError(selectedReference
        ? (ru ? "Не удалось подтвердить препарат по справочнику. Попробуйте выбрать его ещё раз." : "Could not verify the medication in the catalogue. Please select it again.")
        : (ru ? "Не удалось добавить препарат" : "Could not add medication"));
    } finally {
      setSavingMed(false);
    }
  };

  const removeMedication = async (id: string) => {
    setMedications((current) => current.filter((item) => item.id !== id));
    await api.deleteMed(id).catch(() => undefined);
  };

  const finish = async () => {
    if (!activeId) return;
    if (!dailyAnswer) {
      setError(ru ? "Ответьте, принимаете ли вы препараты ежедневно" : "Tell us whether you take daily medications");
      return;
    }
    if (dailyAnswer === "yes" && medications.length === 0) {
      setError(ru ? "Добавьте хотя бы один ежедневный препарат" : "Add at least one daily medication");
      return;
    }
    if (dailyAnswer === "no" && medications.length > 0) {
      setError(ru ? "В профиле уже есть активные препараты. Удалите их из списка или выберите «Да»." : "There are active medications in the profile. Remove them or choose Yes.");
      return;
    }

    setFinishing(true);
    setError(null);
    try {
      await api.updateProfile(activeId, { onboarding_completed: true });
      await reload();
      router.replace("/(tabs)" as any);
    } catch {
      setError(ru ? "Не удалось завершить настройку" : "Could not finish setup");
    } finally {
      setFinishing(false);
    }
  };

  const skip = async () => {
    if (!activeId) return;
    setFinishing(true);
    setError(null);
    try {
      await api.updateProfile(activeId, { onboarding_completed: true });
      await reload();
      router.replace("/(tabs)" as any);
    } catch {
      setError(ru ? "Не удалось завершить настройку" : "Could not finish setup");
    } finally {
      setFinishing(false);
    }
  };

  const dayPartLabel = (value: string) => {
    const labels: Record<string, string> = ru
      ? { morning: "Утро", day: "День", evening: "Вечер" }
      : { morning: "Morning", day: "Day", evening: "Evening" };
    return labels[value] || value;
  };

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.progressRow}>
        <Text style={s.eyebrow}>AIDA · 4/4</Text>
        <View
          style={s.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={ru ? "Прогресс настройки Аиды" : "Aida setup progress"}
          accessibilityValue={{ min: 0, max: 4, now: 4, text: ru ? "Шаг 4 из 4" : "Step 4 of 4" }}
        >
          <View style={[s.progressFill, { width: "100%" }]} />
        </View>
      </View>

      <Text style={s.title}>{ru ? "Ежедневные препараты" : "Daily medications"}</Text>
      <Text style={s.subtitle}>{ru ? "Укажите только те препараты, которые вы действительно принимаете регулярно. Дозировку и режим можно изменить позже." : "Add only medications you actually take regularly. You can edit the dose and schedule later."}</Text>

      <View style={s.section}>
        <Text style={s.question}>{ru ? "Принимаете ли вы на ежедневной основе какие-либо препараты?" : "Do you take any medications every day?"}</Text>
        <View style={s.answerRow}>
          <AnswerChoice label={ru ? "Да" : "Yes"} active={dailyAnswer === "yes"} onPress={() => { setDailyAnswer("yes"); setError(null); }} />
          <AnswerChoice label={ru ? "Нет" : "No"} active={dailyAnswer === "no"} onPress={() => { setDailyAnswer("no"); setError(null); }} />
        </View>
      </View>

      {dailyAnswer === "yes" ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{ru ? "Добавить препарат" : "Add medication"}</Text>
          <Text style={s.label}>{ru ? "Препарат или действующее вещество" : "Medication or active ingredient"}</Text>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.onSurfaceSecondary} />
            <TextInput
              value={nameQuery}
              onChangeText={(value) => {
                setNameQuery(value);
                setSelectedName("");
                setSelectedReference(null);
                setPickerOpen(true);
                setError(null);
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder={ru ? "Напр. Атаракс или гидроксизин" : "e.g. Atarax or hydroxyzine"}
              placeholderTextColor={colors.onSurfaceSecondary}
              style={s.searchInput}
              testID="onboarding-medication-name"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {referenceSearching ? <ActivityIndicator size="small" color={colors.onSurfaceSecondary} /> : null}
            {selectedName ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
          </View>
          <Text style={s.searchHelp}>{ru ? "Поиск идёт одновременно по торговому названию и МНН. Выбор из справочника нужен для будущей проверки совместимости." : "Search covers both trade names and active ingredients. Catalogue selection enables future interaction checks."}</Text>

          {pickerOpen && nameQuery.trim().length > 0 ? (
            <View style={s.dropdown} testID="medication-name-dropdown">
              {nameQuery.trim().length < 3 ? (
                <View style={s.lookupState}><Text style={s.lookupStateText}>{ru ? "Введите минимум 3 символа для поиска по справочнику" : "Type at least 3 characters to search the catalogue"}</Text></View>
              ) : null}

              {referenceItems.map((item, index) => (
                <Pressable
                  key={`${item.reference_id || item.trade_name}-${index}`}
                  style={({ pressed }) => [s.dropdownItem, pressed && s.pressed]}
                  onPress={() => selectReference(item)}
                  testID={`medication-reference-${index}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.dropdownTitle}>{item.trade_name}</Text>
                    <Text style={s.dropdownMeta}>
                      {[
                        item.active_ingredient ? `${ru ? "МНН" : "Active ingredient"}: ${item.active_ingredient}` : null,
                        item.strength,
                        item.dosage_form,
                      ].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceSecondary} />
                </Pressable>
              ))}

              {!referenceSearching && nameQuery.trim().length >= 3 && referenceReady === false ? (
                <View style={s.lookupState} testID="medication-reference-not-configured">
                  <Ionicons name="cloud-offline-outline" size={17} color={colors.warning} />
                  <Text style={s.lookupStateText}>{ru ? "Полный лекарственный справочник ещё не подключён к production. Можно добавить название вручную, но МНН не будет считаться подтверждённым." : "The full medication catalogue is not connected in production yet. You can add a name manually, but its active ingredient will remain unverified."}</Text>
                </View>
              ) : null}

              {!referenceSearching && nameQuery.trim().length >= 3 && referenceReady === true && (referenceAvailable === false || referenceError) ? (
                <View style={s.lookupState} testID="medication-reference-unavailable">
                  <Ionicons name="cloud-offline-outline" size={17} color={colors.warning} />
                  <Text style={s.lookupStateText}>{ru ? "Справочник временно недоступен. Попробуйте повторить поиск или добавьте препарат вручную." : "The catalogue is temporarily unavailable. Retry the search or add the medication manually."}</Text>
                </View>
              ) : null}

              {!referenceSearching && nameQuery.trim().length >= 3 && referenceReady === true && referenceAvailable === true && referenceItems.length === 0 ? (
                <View style={s.lookupState}><Text style={s.lookupStateText}>{ru ? "В справочнике совпадений не найдено" : "No catalogue matches found"}</Text></View>
              ) : null}

              {nameQuery.trim() && !hasExactReference ? (
                <Pressable style={({ pressed }) => [s.dropdownItem, s.customNameItem, pressed && s.pressed]} onPress={selectManualName} testID="medication-manual-name">
                  <Ionicons name="add-circle-outline" size={18} color={colors.onSurface} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.dropdownTitle}>{ru ? `Добавить «${nameQuery.trim()}» вручную` : `Add “${nameQuery.trim()}” manually`}</Text>
                    <Text style={s.dropdownMeta}>{ru ? "Без подтверждённого действующего вещества" : "Without a verified active ingredient"}</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {selectedReference ? (
            <View style={s.referenceNote} testID="selected-medication-reference">
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={s.referenceTitle}>{selectedReference.trade_name}</Text>
                <Text style={s.referenceText}>{ru ? "Действующее вещество" : "Active ingredient"}: {selectedReference.active_ingredient || (ru ? "не указано" : "not specified")}</Text>
              </View>
            </View>
          ) : selectedName ? (
            <View style={s.manualNote} testID="selected-medication-manual">
              <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
              <Text style={s.referenceText}>{ru ? "Название добавляется вручную. ИИ не должен считать действующее вещество подтверждённым, пока препарат не будет нормализован." : "This name is being added manually. AI must not treat its active ingredient as verified until the medication is normalized."}</Text>
            </View>
          ) : null}

          <Text style={[s.label, { marginTop: spacing.lg }]}>{ru ? "Дозировка" : "Dose"}</Text>
          <View style={s.doseRow}>
            <TextInput
              value={doseAmount}
              onChangeText={(value) => setDoseAmount(value.replace(/[^0-9.,]/g, "").slice(0, 8))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="1"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={[s.input, s.doseInput]}
              testID="onboarding-medication-dose"
            />
            <View style={s.unitRow}>
              <Choice label={ru ? "мг" : "mg"} active={doseUnit === "mg"} onPress={() => setDoseUnit("mg")} />
              <Choice label={ru ? "таблетка" : "tablet"} active={doseUnit === "tablet"} onPress={() => setDoseUnit("tablet")} />
            </View>
          </View>

          <Text style={s.label}>{ru ? "Когда принимаете" : "When do you take it"}</Text>
          <View style={s.chips}>
            {DAY_PARTS.map((part) => <Choice key={part} label={dayPartLabel(part)} active={dayParts.includes(part)} onPress={() => toggleDayPart(part)} />)}
          </View>

          <Text style={[s.label, { marginTop: spacing.lg }]}>{ru ? "Относительно еды" : "Around meals"}</Text>
          <View style={s.chips}>
            {[
              ["before", ru ? "До еды" : "Before food"],
              ["with", ru ? "С едой" : "With food"],
              ["after", ru ? "После еды" : "After food"],
              ["any", ru ? "Неважно" : "Any"],
            ].map(([id, label]) => <Choice key={id} label={label} active={mealRelation === id} onPress={() => setMealRelation(id as typeof mealRelation)} />)}
          </View>

          <Pressable style={[s.addButton, savingMed && { opacity: .55 }]} onPress={addMedication} disabled={savingMed} testID="add-onboarding-medication">
            {savingMed ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <><Ionicons name="add" size={19} color={colors.onSurfaceInverse} /><Text style={s.addButtonText}>{ru ? "Добавить препарат" : "Add medication"}</Text></>}
          </Pressable>
        </View>
      ) : null}

      {dailyAnswer === "yes" ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{ru ? "Добавленные препараты" : "Added medications"}</Text>
          {loadingMeds ? <ActivityIndicator color={colors.onSurface} /> : medications.length ? medications.map((med) => (
            <View key={med.id} style={s.medRow}>
              <View style={s.medIcon}><Ionicons name="medkit-outline" size={18} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.medName}>{med.name}</Text>
                {med.active_ingredient ? <Text style={s.medIngredient}>{ru ? "МНН" : "Active ingredient"}: {med.active_ingredient}</Text> : null}
                <Text style={s.medMeta}>{[med.dose, (med.day_parts || []).map(dayPartLabel).join(" · ")].filter(Boolean).join(" · ")}</Text>
              </View>
              <Pressable onPress={() => void removeMedication(med.id)} accessibilityRole="button" accessibilityLabel={ru ? `Удалить ${med.name}` : `Remove ${med.name}`} style={s.removeButton}>
                <Ionicons name="close" size={18} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
          )) : <Text style={s.emptyText}>{ru ? "Пока ничего не добавлено" : "Nothing added yet"}</Text>}
        </View>
      ) : null}

      {error ? <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}

      <View style={s.actions}>
        <Pressable style={s.secondary} onPress={() => router.back()} disabled={finishing || savingMed}><Text style={s.secondaryText}>{ru ? "Назад" : "Back"}</Text></Pressable>
        <Pressable style={[s.primary, (finishing || savingMed) && { opacity: .55 }]} onPress={finish} disabled={finishing || savingMed} testID="finish-medications-onboarding">
          {finishing ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={s.primaryText}>{ru ? "Завершить настройку" : "Finish setup"}</Text>}
        </Pressable>
      </View>
      <Pressable style={s.skip} onPress={skip} disabled={finishing || savingMed}><Text style={s.skipText}>{ru ? "Заполнить позже" : "Complete later"}</Text></Pressable>
    </ScrollView>
  );
}

function AnswerChoice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable style={({ pressed }) => [s.answerChoice, active && s.answerChoiceActive, pressed && s.pressed]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: active }}><Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={21} color={active ? colors.onSurfaceInverse : colors.onSurface} /><Text style={[s.answerText, active && s.answerTextActive]}>{label}</Text></Pressable>; }
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text></Pressable>; }

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface},content:{width:"100%",maxWidth:720,alignSelf:"center",paddingHorizontal:spacing.xl},progressRow:{gap:8},eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:1.5,color:colors.onSurfaceSecondary},progress:{height:4,borderRadius:2,backgroundColor:colors.surfaceSecondary,overflow:"hidden"},progressFill:{height:4,backgroundColor:colors.onSurface},title:{marginTop:spacing.lg,fontSize:34,lineHeight:40,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},subtitle:{marginTop:spacing.sm,fontSize:fontSize.base,lineHeight:22,color:colors.onSurfaceSecondary,fontFamily:fonts.text},section:{marginTop:spacing.xl,backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.lg},sectionTitle:{fontSize:fontSize.lg,fontWeight:"800",color:colors.onSurface,marginBottom:spacing.md,fontFamily:fonts.display},question:{fontSize:fontSize.lg,lineHeight:24,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.display},answerRow:{flexDirection:"row",gap:spacing.sm,marginTop:spacing.lg},answerChoice:{flex:1,minHeight:50,borderRadius:radius.pill,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},answerChoiceActive:{backgroundColor:colors.onSurface,borderColor:colors.onSurface},answerText:{fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},answerTextActive:{color:colors.onSurfaceInverse},label:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary,marginBottom:7,fontFamily:fonts.text},searchWrap:{minHeight:52,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:spacing.md},searchInput:{flex:1,minHeight:50,color:colors.onSurface,fontSize:fontSize.base,fontFamily:fonts.text},searchHelp:{fontSize:12,lineHeight:17,color:colors.onSurfaceSecondary,fontFamily:fonts.text,marginTop:6},dropdown:{marginTop:6,borderRadius:radius.md,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface,overflow:"hidden"},dropdownItem:{minHeight:54,paddingHorizontal:spacing.md,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:1,borderBottomColor:colors.divider},customNameItem:{backgroundColor:colors.surfaceTertiary},dropdownTitle:{fontSize:fontSize.base,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},dropdownMeta:{fontSize:12,lineHeight:17,color:colors.onSurfaceSecondary,fontFamily:fonts.text,marginTop:2},lookupState:{minHeight:48,paddingHorizontal:spacing.md,paddingVertical:10,flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:1,borderBottomColor:colors.divider},lookupStateText:{fontSize:fontSize.sm,lineHeight:18,color:colors.onSurfaceSecondary,fontFamily:fonts.text,flex:1},referenceNote:{marginTop:spacing.sm,minHeight:56,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,flexDirection:"row",gap:10,alignItems:"center",padding:spacing.md},manualNote:{marginTop:spacing.sm,minHeight:52,borderRadius:radius.md,backgroundColor:colors.surfaceTertiary,flexDirection:"row",gap:10,alignItems:"center",padding:spacing.md},referenceTitle:{fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},referenceText:{fontSize:fontSize.sm,lineHeight:18,color:colors.onSurfaceSecondary,fontFamily:fonts.text},doseRow:{flexDirection:"row",gap:spacing.sm,alignItems:"center",marginBottom:spacing.lg,flexWrap:"wrap"},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md,color:colors.onSurface,fontSize:fontSize.base},doseInput:{width:130},unitRow:{flexDirection:"row",gap:8,flex:1,flexWrap:"wrap"},chips:{flexDirection:"row",gap:8,flexWrap:"wrap"},chip:{minHeight:44,paddingHorizontal:14,paddingVertical:9,borderRadius:radius.pill,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},chipActive:{backgroundColor:colors.onSurface,borderColor:colors.onSurface},chipText:{fontWeight:"700",color:colors.onSurface,fontFamily:fonts.text},chipTextActive:{color:colors.onSurfaceInverse},addButton:{minHeight:52,borderRadius:radius.pill,backgroundColor:colors.onSurface,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,marginTop:spacing.xl},addButtonText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text},medRow:{minHeight:64,flexDirection:"row",alignItems:"center",gap:spacing.md,borderBottomWidth:1,borderBottomColor:colors.divider,paddingVertical:spacing.sm},medIcon:{width:40,height:40,borderRadius:20,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},medName:{fontWeight:"800",fontSize:fontSize.base,color:colors.onSurface,fontFamily:fonts.text},medIngredient:{fontSize:fontSize.sm,color:colors.onSurface,fontFamily:fonts.text,marginTop:2},medMeta:{fontSize:fontSize.sm,color:colors.onSurfaceSecondary,marginTop:3,fontFamily:fonts.text},removeButton:{width:40,height:40,alignItems:"center",justifyContent:"center"},emptyText:{color:colors.onSurfaceSecondary,fontFamily:fonts.text},actions:{flexDirection:"row",gap:spacing.md,marginTop:spacing.xl,flexWrap:"wrap"},primary:{flex:1,minWidth:180,minHeight:54,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md},primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",fontFamily:fonts.text,textAlign:"center"},secondary:{minWidth:110,minHeight:54,borderRadius:radius.pill,borderWidth:1,borderColor:colors.borderStrong,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md},secondaryText:{fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},skip:{minHeight:50,alignItems:"center",justifyContent:"center"},skipText:{color:colors.onSurfaceSecondary,fontWeight:"700",fontFamily:fonts.text},error:{color:colors.error,marginTop:spacing.lg,fontFamily:fonts.text},pressed:{opacity:.78}
});