import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { api, type Checkin as ApiCheckin, type LabTest, type Medication, type Symptom as ApiSymptom, type Task as ApiTask, type Vital } from "@/src/api";
import { markMedicationIntake, type MedicationSlot } from "@/src/medicationScheduleApi";
import { getHome } from "@/src/homeApi";
import { useI18n } from "@/src/i18n";
import { useApp as useStore } from "@/src/store";

export const todayStr = () => dayjs().format("YYYY-MM-DD");

export type BpReading = { id: string; sys: number; dia: number; pulse: number; ts: string };
export type Lab = { id: string; name: string; value: number; unit: string; ts: string };
export type WeightEntry = { id: string; kg: number; ts: string };
export type Checkin = { id: string; mood: number; energy: number; stress: number; wellbeing: number; ts: string };
export type Med = { id: string; medicationId: string; scheduledAt?: string; name: string; time: string; takenDates: string[] };
export type Task = { id: string; title: string; time: string; done: boolean };
export type Symptom = { id: string; text: string; ts: string };
export type Profile = { name: string; birthYear: number; cycleEnabled: boolean; cycleStart: string; cycleLength: number; periodLength: number };
export type HealthState = { profile: Profile; bp: BpReading[]; labs: Lab[]; weight: WeightEntry[]; checkins: Checkin[]; meds: Med[]; tasks: Task[]; symptoms: Symptom[]; sectionStates: Record<string, string> };

const emptyProfile: Profile = { name: "", birthYear: dayjs().year(), cycleEnabled: false, cycleStart: todayStr(), cycleLength: 28, periodLength: 5 };
const emptyState: HealthState = { profile: emptyProfile, bp: [], labs: [], weight: [], checkins: [], meds: [], tasks: [], symptoms: [], sectionStates: {} };

type Ctx = {
  state: HealthState;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addBp: (v: { sys: number; dia: number; pulse: number }) => void;
  addLab: (v: { name: string; value: number; unit: string }) => void;
  addWeight: (v: { kg: number }) => void;
  addCheckin: (v: { mood: number; energy: number; stress: number; wellbeing: number }) => void;
  addMed: (v: { name: string; time: string }) => void;
  toggleMedTaken: (id: string) => void;
  addTask: (v: { title: string; time: string }) => void;
  toggleTask: (id: string) => void;
  addSymptom: (v: { text: string }) => void;
};

const HealthContext = createContext<Ctx | undefined>(undefined);

function birthYear(dob?: string | null) {
  const parsed = dob ? dayjs(dob) : null;
  return parsed?.isValid() ? parsed.year() : dayjs().year();
}

function flattenLabs(items: LabTest[]): Lab[] {
  return items.flatMap((test) => test.biomarkers.map((item, index) => ({
    id: `${test.id}-${index}`,
    name: item.name,
    value: Number.parseFloat(String(item.value).replace(",", ".")) || 0,
    unit: item.unit || "",
    ts: test.date,
  })));
}

function mapMeds(items: Medication[], slots: MedicationSlot[]): Med[] {
  if (slots.length) return slots.map((slot) => ({
    id: slot.id,
    medicationId: slot.medication_id,
    scheduledAt: slot.scheduled_at,
    name: slot.name,
    time: slot.time,
    takenDates: slot.status === "taken" ? [todayStr()] : [],
  }));
  return items.filter((item) => item.active).map((item) => ({
    id: item.id,
    medicationId: item.id,
    name: item.name,
    time: item.times?.[0] || "—",
    takenDates: [],
  }));
}

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { activeId, activeProfile, refreshTick, bumpRefresh } = useStore();
  const { lang } = useI18n();
  const [state, setState] = useState<HealthState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeId) { setState(emptyState); setLoading(false); return; }
    setError(null);
    try {
      const today = todayStr();
      const [home, vitals, checkins] = await Promise.all([
        getHome(activeId, today, lang), api.listVitals(activeId), api.listCheckins(activeId),
      ]);
      const bp = vitals.filter((item: Vital) => item.kind === "bp").map((item) => ({ id: item.id, sys: Number(item.systolic || 0), dia: Number(item.diastolic || 0), pulse: Number(item.pulse || 0), ts: item.date }));
      const weight = vitals.filter((item: Vital) => item.kind === "weight").map((item) => ({ id: item.id, kg: Number(item.value || 0), ts: item.date }));
      const cycle = activeProfile?.women_health || {};
      setState({
        profile: { name: activeProfile?.name || "", birthYear: birthYear(activeProfile?.dob), cycleEnabled: Boolean(cycle.enabled), cycleStart: String(cycle.cycle_start || cycle.last_period_start || todayStr()), cycleLength: Number(cycle.cycle_length || 28), periodLength: Number(cycle.period_length || 5) },
        bp,
        labs: flattenLabs(home.labs.items || []),
        weight,
        checkins: checkins.map((item: ApiCheckin) => ({ id: item.id, mood: item.mood, energy: item.energy, stress: item.stress, wellbeing: Math.max(1, Math.min(5, 6 - item.anxiety)), ts: item.date })),
        meds: mapMeds(home.medications.items || [], home.medication_day.slots || []),
        tasks: (home.tasks.items || []).filter((item: ApiTask) => item.status !== "cancelled").map((item) => ({ id: item.id, title: item.title, time: item.due?.slice(11, 16) || item.reminder_at?.slice(11, 16) || "—", done: item.done })),
        symptoms: (home.symptoms.items || []).map((item: ApiSymptom) => ({ id: item.id, text: item.name, ts: item.date })),
        sectionStates: { medications: home.medications.state, symptoms: home.symptoms.state, labs: home.labs.state, tasks: home.tasks.state, medication_day: home.medication_day.state, readiness: home.readiness.state, overview: home.overview.state },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load health data");
    } finally { setLoading(false); }
  }, [activeId, activeProfile, lang]);

  useEffect(() => { setLoading(true); void reload(); }, [reload, refreshTick]);
  const run = useCallback((operation: () => Promise<unknown>) => { void operation().then(() => { bumpRefresh(); return reload(); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save")); }, [bumpRefresh, reload]);

  const value = useMemo<Ctx>(() => ({
    state, loading, error, reload,
    addBp: (v) => activeId && run(() => api.createVital({ profile_id: activeId, kind: "bp", systolic: v.sys, diastolic: v.dia, pulse: v.pulse })),
    addLab: (v) => activeId && run(() => api.createLab({ profile_id: activeId, title: v.name, date: todayStr(), biomarkers: [{ name: v.name, value: String(v.value), unit: v.unit }] })),
    addWeight: (v) => activeId && run(() => api.createVital({ profile_id: activeId, kind: "weight", value: v.kg, unit: "kg" })),
    addCheckin: (v) => activeId && run(() => api.createCheckin({ profile_id: activeId, mood: v.mood, energy: v.energy, stress: v.stress, anxiety: Math.max(1, Math.min(5, 6 - v.wellbeing)), sleep: v.wellbeing })),
    addMed: (v) => activeId && run(() => api.createMed({ profile_id: activeId, name: v.name, times: [v.time], active: true })),
    toggleMedTaken: (id) => { const med = state.meds.find((item) => item.id === id); if (med?.scheduledAt) run(() => markMedicationIntake(med.medicationId, med.scheduledAt!, med.takenDates.includes(todayStr()) ? "skipped" : "taken")); },
    addTask: (v) => activeId && run(() => api.createTask({ profile_id: activeId, title: v.title, kind: "custom", due: `${todayStr()}T${v.time}:00`, status: "pending", done: false })),
    toggleTask: (id) => run(() => api.toggleTask(id)),
    addSymptom: (v) => activeId && run(() => api.createSymptom({ profile_id: activeId, name: v.text, severity: 3, date: todayStr() })),
  }), [activeId, error, loading, reload, run, state]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() { const value = useContext(HealthContext); if (!value) throw new Error("useHealth must be used within HealthProvider"); return value; }
export type StatusKind = "normal" | "attention" | "noData";
export function bpStatus(reading?: BpReading): StatusKind { if (!reading) return "noData"; return reading.sys >= 140 || reading.dia >= 90 || reading.sys < 90 ? "attention" : "normal"; }

export function useDerived() {
  const { state } = useHealth();
  return useMemo(() => {
    const actualAge = dayjs().year() - state.profile.birthYear;
    const latestBp = state.bp[0], latestWeight = state.weight[0], latestCheckin = state.checkins[0];
    const present = [state.bp.length, state.labs.length, state.checkins.length, state.weight.length].filter(Boolean).length;
    const readinessEnough = present >= 2;
    const signals: { icon: string; title: string; desc: string }[] = [];
    if (latestBp && bpStatus(latestBp) === "attention") signals.push({ icon: "pulse-outline", title: "Давление вне нормы", desc: `${latestBp.sys}/${latestBp.dia} — стоит перепроверить` });
    if (latestCheckin?.stress >= 4) signals.push({ icon: "flash-outline", title: "Высокий стресс", desc: "Последний check-in показал повышенный стресс" });
    const overallStatus: StatusKind = readinessEnough ? (signals.length ? "attention" : "normal") : "noData";
    const systemStatus: Record<string, StatusKind> = { cardio: bpStatus(latestBp), nervous: latestCheckin ? (latestCheckin.stress >= 4 ? "attention" : "normal") : "noData", respiratory: "noData", digestive: "noData", endocrine: state.labs.length ? "normal" : "noData", urinary: "noData", reproductive: state.profile.cycleEnabled ? "normal" : "noData", musculoskeletal: state.weight.length ? "normal" : "noData", immune: "noData" };
    const bioAge = latestBp && latestCheckin ? Math.max(18, Math.round(actualAge + (latestCheckin.stress - 3) * 1.5 + (bpStatus(latestBp) === "attention" ? 3 : -1))) : null;
    let cycle: { day: number; phase: "menstrual" | "follicular" | "ovulation" | "luteal"; nextInDays: number } | null = null;
    if (state.profile.cycleEnabled) {
      const length = state.profile.cycleLength;
      const daysSince = dayjs().diff(dayjs(state.profile.cycleStart), "day");
      const day = ((daysSince % length) + length) % length + 1;
      const phase = day <= state.profile.periodLength ? "menstrual" : day >= 13 && day <= 15 ? "ovulation" : day > 15 ? "luteal" : "follicular";
      cycle = { day, phase, nextInDays: length - day + 1 };
    }
    return { actualAge, bioAge, latestBp, latestWeight, latestCheckin, readiness: { enough: readinessEnough, percent: Math.round((present / 4) * 100) }, overall: { enough: readinessEnough, status: overallStatus, score: readinessEnough ? Math.max(40, 90 - signals.length * 12) : null }, signals, systemStatus, cycle };
  }, [state]);
}
