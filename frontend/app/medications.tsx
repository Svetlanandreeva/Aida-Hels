import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Chip, Muted, PrimaryButton, Tag, Title } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Medication } from "@/src/api";
import {
  appleMedicationBridgeAvailable,
  listAppleHealthMedications,
  requestAppleMedicationAccess,
} from "@/src/native-health";
import {
  getMedicationDay,
  markMedicationIntake,
  MedicationSlot,
  updateMedicationSchedule,
} from "@/src/medicationScheduleApi";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

type RichMedication = Medication & {
  times?: string[];
  meal_relation?: string;
  source?: "aida" | "apple_health" | string;
  external_id?: string | null;
};

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTimes(value: string) {
  const found = value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(found)].sort();
}

function medNameKey(value?: string | null) {
  return String(value || "").trim().toLocaleLowerCase();
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();

  const [items, setItems] = useState<RichMedication[]>([]);
  const [slots, setSlots] = useState<MedicationSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [appleImporting, setAppleImporting] = useState(false);
  const [appleImportMessage, setAppleImportMessage] = useState<string | null>(null);
  const [appleImportError, setAppleImportError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [timesText, setTimesText] = useState("");
  const [meal, setMeal] = useState("any");
  const [saving, setSaving] = useState(false);

  const today = localDateString();
  const appleImportAvailable = appleMedicationBridgeAvailable();

  const load = useCallback(async () => {
    if (!activeId) {
      setItems([]);
      setSlots([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoadError(false);
    try {
      const [meds, day] = await Promise.all([
        api.listMeds(activeId),
        getMedicationDay(activeId, localDateString()),
      ]);
      setItems(meds as RichMedication[]);
      setSlots(day.slots || []);
    } catch (_) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load, refreshTick]));

  const resetEditor = () => {
    setEditingId(null);
    setName("");
    setDose("");
    setTimesText("");
    setMeal("any");
  };

  const openAdd = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const openEdit = (med: RichMedication) => {
    setEditingId(med.id);
    setName(med.name || "");
    setDose(med.dose || "");
    setTimesText((med.times || []).join(", "));
    setMeal(med.meal_relation || "any");
    setEditorOpen(true);
  };

  const importAppleHealth = async () => {
    if (!activeId) return;
    setAppleImporting(true);
    setAppleImportMessage(null);
    setAppleImportError(null);
    try {
      await requestAppleMedicationAccess();
      const healthMeds = await listAppleHealthMedications();
      const existingExternalIds = new Set(
        items.filter((item) => item.source === "apple_health" && item.external_id).map((item) => item.external_id as string)
      );
      const existingNames = new Set(items.map((item) => medNameKey(item.name)).filter(Boolean));
      let imported = 0;
      let alreadyPresent = 0;

      for (const med of healthMeds) {
        const displayName = String(med.nickname || med.display_text || "").trim();
        if (!displayName || !med.external_id) continue;
        if (existingExternalIds.has(med.external_id) || existingNames.has(medNameKey(displayName))) {
          alreadyPresent += 1;
          continue;
        }
        await api.createMed({
          profile_id: activeId,
          name: displayName,
          dose: null,
          schedule: null,
          times: [],
          meal_relation: "any",
          active: !med.is_archived,
          start_date: today,
          source: "apple_health",
          external_id: med.external_id,
          external_metadata: {
            display_text: med.display_text,
            nickname: med.nickname || null,
            has_schedule: med.has_schedule,
            general_form: med.general_form || null,
            rxnorm_code: med.rxnorm_code || null,
            codings: med.codings || [],
          },
        });
        existingExternalIds.add(med.external_id);
        existingNames.add(medNameKey(displayName));
        imported += 1;
      }

      await load();
      bumpRefresh();
      setAppleImportMessage(
        lang === "ru"
          ? `Импортировано из Apple Health: ${imported}. Уже были в Аиде: ${alreadyPresent}.`
          : `Imported from Apple Health: ${imported}. Already in Aida: ${alreadyPresent}.`
      );
    } catch (e: any) {
      const raw = String(e?.message || e || "");
      const requiresNewIos = raw.includes("iOS 26") || raw.includes("medications_api_unavailable");
      setAppleImportError(
        requiresNewIos
          ? (lang === "ru" ? "Импорт лекарств из Apple Health требует iOS 26 или новее." : "Apple Health medication import requires iOS 26 or newer.")
          : (lang === "ru" ? "Не удалось получить лекарства из Apple Health. Проверьте разрешение доступа." : "Could not read medications from Apple Health. Check Health permissions.")
      );
    } finally {
      setAppleImporting(false);
    }
  };

  const saveMedication = async () => {
    if (!activeId || !name.trim()) return;
    const times = parseTimes(timesText);
    if (times.some((time) => !TIME_RE.test(time))) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        dose: dose.trim() || null,
        times,
        meal_relation: meal,
        schedule: times.length ? times.join(", ") : null,
      };
      if (editingId) {
        await updateMedicationSchedule(editingId, payload);
      } else {
        await api.createMed({
          profile_id: activeId,
          ...payload,
          active: true,
          start_date: today,
          source: "aida",
        });
      }
      setEditorOpen(false);
      resetEditor();
      await load();
      bumpRefresh();
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSlots((prev) => prev.filter((slot) => slot.medication_id !== id));
    await api.deleteMed(id).catch(() => {});
    bumpRefresh();
  };

  const mark = async (slot: MedicationSlot, status: "taken" | "skipped") => {
    setMarking(slot.id);
    try {
      await markMedicationIntake(slot.medication_id, slot.scheduled_at, status);
      if (activeId) {
        const day = await getMedicationDay(activeId, today);
        setSlots(day.slots || []);
      }
      bumpRefresh();
    } finally {
      setMarking(null);
    }
  };

  const active = items.filter((m) => m.active);
  const past = items.filter((m) => !m.active);
  const pendingCount = slots.filter((slot) => slot.status === "pending").length;
  const takenCount = slots.filter((slot) => slot.status === "taken").length;

  const mealLabel = (value?: string) => {
    const labels: Record<string, { ru: string; en: string }> = {
      any: { ru: "Неважно относительно еды", en: "Any time around meals" },
      before: { ru: "До еды", en: "Before food" },
      with: { ru: "Во время еды", en: "With food" },
      after: { ru: "После еды", en: "After food" },
    };
    const item = labels[value || "any"] || labels.any;
    return lang === "ru" ? item.ru : item.en;
  };

  const timesValid = useMemo(() => parseTimes(timesText).every((time) => TIME_RE.test(time)), [timesText]);

  const renderMed = (m: RichMedication) => (
    <Card key={m.id} testID={`medication-${m.id}`} style={{ marginBottom: spacing.md }}>
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name="medkit" size={18} color={colors.onSurface} /></View>
        <View style={{ flex: 1 }}>
          <Title>{m.name}</Title>
          <Muted style={{ marginTop: 2 }}>{m.dose || (lang === "ru" ? "Дозировка не указана" : "No dose")}</Muted>
        </View>
        <View style={styles.tagStack}>
          {m.source === "apple_health" && <Tag label="Apple Health" />}
          {m.active && <Tag label={t("active")} />}
        </View>
      </View>

      <View style={styles.medMeta}>
        <View style={styles.metaLine}>
          <Ionicons name="time-outline" size={15} color={colors.onSurfaceSecondary} />
          <Text style={styles.metaText}>
            {(m.times || []).length ? (m.times || []).join(" · ") : (lang === "ru" ? "Расписание не настроено" : "Schedule not set")}
          </Text>
        </View>
        <View style={styles.metaLine}>
          <Ionicons name="restaurant-outline" size={15} color={colors.onSurfaceSecondary} />
          <Text style={styles.metaText}>{mealLabel(m.meal_relation)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable style={styles.textAction} onPress={() => openEdit(m)} testID={`edit-medication-${m.id}`}>
          <Ionicons name="create-outline" size={16} color={colors.onSurface} />
          <Text style={styles.textActionLabel}>{lang === "ru" ? "Расписание" : "Schedule"}</Text>
        </Pressable>
        <Pressable style={styles.textAction} onPress={() => del(m.id)} testID={`delete-medication-${m.id}`}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={[styles.textActionLabel, { color: colors.error }]}>{lang === "ru" ? "Удалить" : "Delete"}</Text>
        </Pressable>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_meds")} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : !activeId ? (
        <State title={lang === "ru" ? "Выберите профиль" : "Choose a profile"} text={lang === "ru" ? "Лекарства сохраняются отдельно для каждого профиля." : "Medications are stored separately for each profile."} icon="person-circle-outline" />
      ) : loadError ? (
        <View style={styles.center}>
          <State title={lang === "ru" ? "Не удалось загрузить лекарства" : "Could not load medications"} text={lang === "ru" ? "Попробуйте повторить загрузку." : "Please try loading again."} icon="cloud-offline-outline" />
          <Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>{lang === "ru" ? "Повторить" : "Retry"}</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.addCard} onPress={openAdd} testID="add-med-button">
            <View style={styles.addIcon}><Ionicons name="add" size={23} color={colors.onSurfaceInverse} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addTitle}>{t("add_medication")}</Text>
              <Text style={styles.addText}>{lang === "ru" ? "Название, дозировка, часы и связь с едой" : "Name, dose, times and meal relation"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.onSurfaceInverse} />
          </Pressable>

          {appleImportAvailable && (
            <View style={styles.appleCard} testID="apple-health-medications-card">
              <View style={styles.appleIcon}><Ionicons name="heart" size={20} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appleTitle}>{lang === "ru" ? "Лекарства из Apple Health" : "Medications from Apple Health"}</Text>
                <Text style={styles.appleText}>
                  {lang === "ru"
                    ? "Импортируем препараты, которыми вы разрешили поделиться. Записи, созданные в Аиде, остаются в Аиде: Apple пока даёт сторонним приложениям чтение лекарств и событий приёма, но не создание системных записей лекарств."
                    : "Import medications you choose to share. Medications created in Aida stay in Aida: Apple currently exposes medication and dose data to third-party apps for reading, not for creating Health medication records."}
                </Text>
                {appleImportMessage ? <Text style={styles.appleSuccess}>{appleImportMessage}</Text> : null}
                {appleImportError ? <Text style={styles.appleError}>{appleImportError}</Text> : null}
              </View>
              <Pressable style={styles.appleButton} onPress={importAppleHealth} disabled={appleImporting} testID="import-apple-health-medications">
                {appleImporting ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Ionicons name="download-outline" size={18} color={colors.onSurfaceInverse} />}
              </Pressable>
            </View>
          )}

          {slots.length > 0 && (
            <View style={styles.todaySection}>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>{lang === "ru" ? "Сегодня" : "Today"}</Text>
                  <Muted>{takenCount} {lang === "ru" ? "принято" : "taken"} · {pendingCount} {lang === "ru" ? "осталось" : "remaining"}</Muted>
                </View>
                <Text style={styles.dateLabel}>{today}</Text>
              </View>

              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {slots.map((slot) => (
                  <View key={slot.id} style={[styles.slot, slot.status !== "pending" && styles.slotResolved]} testID={`med-slot-${slot.id}`}>
                    <View style={styles.timeBox}><Text style={styles.timeText}>{slot.time}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotName}>{slot.name}</Text>
                      <Text style={styles.slotMeta}>{[slot.dose, mealLabel(slot.meal_relation)].filter(Boolean).join(" · ")}</Text>
                      {slot.occurred_at ? <Text style={styles.eventTime}>{lang === "ru" ? "Отмечено" : "Marked"}: {new Date(slot.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text> : null}
                    </View>
                    {marking === slot.id ? (
                      <ActivityIndicator color={colors.onSurface} />
                    ) : slot.status === "taken" ? (
                      <View style={styles.doneBadge}><Ionicons name="checkmark" size={15} color={colors.success} /><Text style={[styles.doneText, { color: colors.success }]}>{lang === "ru" ? "Принято" : "Taken"}</Text></View>
                    ) : slot.status === "skipped" ? (
                      <View style={styles.doneBadge}><Ionicons name="close" size={15} color={colors.warning} /><Text style={[styles.doneText, { color: colors.warning }]}>{lang === "ru" ? "Пропущено" : "Skipped"}</Text></View>
                    ) : (
                      <View style={styles.slotActions}>
                        <Pressable style={styles.takeButton} onPress={() => mark(slot, "taken")} testID={`take-${slot.id}`}><Ionicons name="checkmark" size={18} color={colors.onSurfaceInverse} /></Pressable>
                        <Pressable style={styles.skipButton} onPress={() => mark(slot, "skipped")} testID={`skip-${slot.id}`}><Ionicons name="close" size={18} color={colors.onSurfaceSecondary} /></Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="medkit-outline" size={56} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: spacing.md, textAlign: "center" }}>{lang === "ru" ? "Лекарств пока нет" : "No medications yet"}</Muted>
            </View>
          ) : (
            <>
              <Text style={styles.listTitle}>{lang === "ru" ? "Мои препараты" : "My medications"}</Text>
              {active.map(renderMed)}
              {active.length > 0 && slots.length === 0 && (
                <View style={styles.noSchedule}>
                  <Ionicons name="time-outline" size={19} color={colors.onSurfaceSecondary} />
                  <Text style={styles.noScheduleText}>{lang === "ru" ? "Добавьте время приёма хотя бы одному активному препарату — здесь появится дневной чек-лист." : "Add intake times to an active medication to get a daily checklist here."}</Text>
                </View>
              )}
              {past.length > 0 && <><Text style={styles.sectionLabel}>{lang === "ru" ? "Завершённые" : "Past"}</Text>{past.map(renderMed)}</>}
            </>
          )}
        </ScrollView>
      )}

      <Sheet visible={editorOpen} onClose={() => !saving && setEditorOpen(false)} testID="med-schedule-sheet" scroll>
        <Text style={styles.sheetTitle}>{editingId ? (lang === "ru" ? "Настроить препарат" : "Edit medication") : t("add_medication")}</Text>
        <Field label={lang === "ru" ? "Название" : "Name"}>
          <TextInput value={name} onChangeText={setName} style={styles.input} testID="med-editor-name" placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <Field label={lang === "ru" ? "Дозировка" : "Dose"}>
          <TextInput value={dose} onChangeText={setDose} style={styles.input} testID="med-editor-dose" placeholder={lang === "ru" ? "Напр. 5 мг" : "e.g. 5 mg"} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <Field label={lang === "ru" ? "Время приёма" : "Intake times"}>
          <TextInput value={timesText} onChangeText={setTimesText} style={[styles.input, !timesValid && styles.inputError]} testID="med-editor-times" placeholder="08:00, 20:00" autoCapitalize="none" placeholderTextColor={colors.onSurfaceSecondary} />
          <Muted style={{ marginTop: spacing.sm }}>{lang === "ru" ? "Можно несколько значений через запятую. Формат 24 часа: 08:00, 20:30." : "Use comma-separated 24-hour times, e.g. 08:00, 20:30."}</Muted>
          {!timesValid ? <Text style={styles.errorText}>{lang === "ru" ? "Проверьте формат времени" : "Check the time format"}</Text> : null}
        </Field>
        <Field label={lang === "ru" ? "Относительно еды" : "Around meals"}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {[
              ["any", lang === "ru" ? "Неважно" : "Any"],
              ["before", lang === "ru" ? "До еды" : "Before"],
              ["with", lang === "ru" ? "С едой" : "With food"],
              ["after", lang === "ru" ? "После еды" : "After"],
            ].map(([key, label]) => <Chip key={key} label={label} active={meal === key} onPress={() => setMeal(key)} testID={`meal-${key}`} />)}
          </ScrollView>
        </Field>
        <PrimaryButton label={t("save")} onPress={saveMedication} loading={saving} disabled={!name.trim() || !timesValid} testID="save-med-schedule" />
      </Sheet>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: spacing.lg }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function State({ title, text, icon }: { title: string; text: string; icon: any }) {
  return <View style={styles.stateWrap}><Ionicons name={icon} size={56} color={colors.onSurfaceSecondary} /><Text style={styles.stateTitle}>{title}</Text><Muted style={styles.stateText}>{text}</Muted></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  stateWrap: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text, textAlign: "center" },
  stateText: { marginTop: spacing.sm, textAlign: "center" },
  retryBtn: { marginTop: spacing.lg, backgroundColor: colors.onSurface, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText: { color: colors.surfaceSecondary, fontWeight: "700", fontFamily: fonts.text },
  addCard: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.onSurface, marginBottom: spacing.md },
  addIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  addTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  addText: { marginTop: 2, fontSize: fontSize.sm, color: "rgba(255,255,255,0.65)", fontFamily: fonts.text },
  appleCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  appleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  appleTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  appleText: { marginTop: 4, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  appleSuccess: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.success, fontFamily: fonts.text },
  appleError: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.error, fontFamily: fonts.text },
  appleButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.onSurface },
  todaySection: { marginBottom: spacing.xl },
  sectionHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  dateLabel: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  slot: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 78, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder },
  slotResolved: { opacity: 0.72 },
  timeBox: { minWidth: 54, paddingVertical: 7, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center" },
  timeText: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  slotName: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  slotMeta: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  eventTime: { marginTop: 3, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  slotActions: { flexDirection: "row", gap: 7 },
  takeButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.onSurface },
  skipButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  doneText: { fontSize: fontSize.sm, fontWeight: "700", fontFamily: fonts.text },
  listTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tagStack: { alignItems: "flex-end", gap: 5 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  medMeta: { gap: 7, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  metaText: { flex: 1, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  cardActions: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  textAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  textActionLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  noSchedule: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.lg },
  noScheduleText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginVertical: spacing.md, fontFamily: fonts.text },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  input: { minHeight: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.text },
  inputError: { borderColor: colors.error },
  errorText: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.error, fontFamily: fonts.text },
});