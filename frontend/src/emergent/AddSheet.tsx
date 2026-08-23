import React, { createContext, useContext, useMemo, useState } from "react";
import { StyleSheet, View, Pressable, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth } from "@/src/emergent/health-context";
import { font, fontSize, radius, spacing, FORM_MAX } from "@/src/emergent/tokens";
import { Txt, PillButton } from "@/src/emergent/ui";
import { ScaleRow } from "@/src/emergent/health";

export type AddType = "bp" | "lab" | "wellbeing" | "med" | "weight" | "symptom" | "task";

const AddCtx = createContext<{ open: (t?: AddType) => void } | undefined>(undefined);

export function useAddSheet() {
  const c = useContext(AddCtx);
  if (!c) throw new Error("useAddSheet must be used within AddSheetProvider");
  return c;
}

export function AddSheetProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<AddType>("bp");
  const api = useMemo(() => ({ open: (t?: AddType) => { setType(t ?? "bp"); setVisible(true); } }), []);

  return (
    <AddCtx.Provider value={api}>
      {children}
      {visible ? <AddSheet type={type} setType={setType} onClose={() => setVisible(false)} /> : null}
    </AddCtx.Provider>
  );
}

function AddSheet({ type, setType, onClose }: { type: AddType; setType: (t: AddType) => void; onClose: () => void }) {
  const { colors, t } = useApp();
  const insets = useSafeAreaInsets();
  const health = useHealth();
  const m = t.mod;

  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labUnit, setLabUnit] = useState("");
  const [kg, setKg] = useState("");
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState("09:00");
  const [symptom, setSymptom] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("12:00");
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [wellbeing, setWellbeing] = useState(3);

  const types: { key: AddType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "bp", label: m.typeBp, icon: "pulse-outline" },
    { key: "lab", label: m.typeLab, icon: "flask-outline" },
    { key: "wellbeing", label: m.typeWellbeing, icon: "happy-outline" },
    { key: "med", label: m.typeMed, icon: "medkit-outline" },
    { key: "weight", label: m.typeWeight, icon: "barbell-outline" },
    { key: "symptom", label: m.typeSymptom, icon: "thermometer-outline" },
    { key: "task", label: m.typeTask, icon: "checkbox-outline" },
  ];

  const canSave = (() => {
    switch (type) {
      case "bp": return !!sys && !!dia;
      case "lab": return !!labName && !!labValue;
      case "weight": return !!kg;
      case "med": return !!medName;
      case "symptom": return !!symptom;
      case "task": return !!taskTitle;
      case "wellbeing": return true;
    }
  })();

  const save = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    switch (type) {
      case "bp": health.addBp({ sys: +sys, dia: +dia, pulse: +pulse || 0 }); break;
      case "lab": health.addLab({ name: labName, value: +labValue, unit: labUnit }); break;
      case "weight": health.addWeight({ kg: +kg }); break;
      case "med": health.addMed({ name: medName, time: medTime }); break;
      case "symptom": health.addSymptom({ text: symptom }); break;
      case "task": health.addTask({ title: taskTitle, time: taskTime }); break;
      case "wellbeing": health.addCheckin({ mood, energy, stress, wellbeing }); break;
    }
    onClose();
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }];

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.md }}>
      <Txt variant="label" weight="semibold" color={colors.muted} style={{ marginBottom: 8 }}>{label}</Txt>
      {children}
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill} testID="add-sheet">
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable testID="add-sheet-backdrop" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        style={[styles.sheet, { backgroundColor: colors.surfaceSecondary, paddingBottom: insets.bottom + spacing.lg }]}
      >
        <View style={styles.handle} />
        <View style={styles.sheetHead}>
          <Txt variant="h3">{m.add}</Txt>
          <Pressable testID="add-sheet-close" onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typesRow}>
          {types.map((tp) => {
            const active = tp.key === type;
            return (
              <Pressable
                key={tp.key}
                testID={`add-type-${tp.key}`}
                onPress={() => setType(tp.key)}
                style={[styles.typeChip, { backgroundColor: active ? colors.brand : colors.surfaceTertiary, borderColor: active ? colors.brand : colors.border }]}
              >
                <Ionicons name={tp.icon} size={16} color={active ? colors.onBrandPrimary : colors.muted} />
                <Txt variant="label" weight="bold" color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} style={{ marginLeft: 6 }}>{tp.label}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>

        <KeyboardAwareScrollView bottomOffset={16} keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }} contentContainerStyle={styles.form}>
          {type === "bp" ? (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field label={m.systolic}><TextInput testID="add-bp-sys" value={sys} onChangeText={setSys} keyboardType="number-pad" placeholder="120" placeholderTextColor={colors.muted} style={inputStyle} /></Field></View>
              <View style={{ flex: 1 }}><Field label={m.diastolic}><TextInput testID="add-bp-dia" value={dia} onChangeText={setDia} keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.muted} style={inputStyle} /></Field></View>
              <View style={{ flex: 1 }}><Field label={m.pulse}><TextInput testID="add-bp-pulse" value={pulse} onChangeText={setPulse} keyboardType="number-pad" placeholder="66" placeholderTextColor={colors.muted} style={inputStyle} /></Field></View>
            </View>
          ) : null}

          {type === "lab" ? (
            <>
              <Field label={m.labName}><TextInput testID="add-lab-name" value={labName} onChangeText={setLabName} placeholder="Витамин D" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 2 }}><Field label={m.labValue}><TextInput testID="add-lab-value" value={labValue} onChangeText={setLabValue} keyboardType="numeric" placeholder="32" placeholderTextColor={colors.muted} style={inputStyle} /></Field></View>
                <View style={{ flex: 1 }}><Field label={m.labUnit}><TextInput testID="add-lab-unit" value={labUnit} onChangeText={setLabUnit} placeholder="ng/ml" placeholderTextColor={colors.muted} style={inputStyle} /></Field></View>
              </View>
            </>
          ) : null}

          {type === "weight" ? (
            <Field label={m.weightTitle + ", кг"}><TextInput testID="add-weight" value={kg} onChangeText={setKg} keyboardType="numeric" placeholder="70" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
          ) : null}

          {type === "med" ? (
            <>
              <Field label={m.name}><TextInput testID="add-med-name" value={medName} onChangeText={setMedName} placeholder="Магний" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
              <Field label={m.today}><TextInput testID="add-med-time" value={medTime} onChangeText={setMedTime} placeholder="09:00" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
            </>
          ) : null}

          {type === "symptom" ? (
            <Field label={m.symptomText}><TextInput testID="add-symptom" value={symptom} onChangeText={setSymptom} placeholder="Головная боль" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
          ) : null}

          {type === "task" ? (
            <>
              <Field label={m.taskTitle}><TextInput testID="add-task-title" value={taskTitle} onChangeText={setTaskTitle} placeholder="Выпить воды" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
              <Field label={m.today}><TextInput testID="add-task-time" value={taskTime} onChangeText={setTaskTime} placeholder="12:00" placeholderTextColor={colors.muted} style={inputStyle} /></Field>
            </>
          ) : null}

          {type === "wellbeing" ? (
            <View>
              <ScaleRow testID="add-mood" label={m.mood} value={mood} onChange={setMood} />
              <ScaleRow testID="add-energy" label={m.energy} value={energy} onChange={setEnergy} />
              <ScaleRow testID="add-stress" label={m.stress} value={stress} onChange={setStress} invert />
              <ScaleRow testID="add-wellbeing" label={m.wellbeing} value={wellbeing} onChange={setWellbeing} />
            </View>
          ) : null}
        </KeyboardAwareScrollView>

        <View style={{ marginTop: spacing.sm }}>
          <PillButton testID="add-save-button" label={m.save} onPress={() => { if (canSave) save(); }} size="lg" icon="checkmark" full />
          {!canSave ? <View style={[StyleSheet.absoluteFill, styles.disabledMask, { backgroundColor: colors.surfaceSecondary, pointerEvents: "none" }]} /> : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    width: "100%",
    maxWidth: FORM_MAX + 80,
    alignSelf: "center",
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(128,128,128,0.4)", alignSelf: "center", marginBottom: spacing.md },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  typesRow: { gap: spacing.sm, paddingBottom: spacing.md },
  typeChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 38, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, flexShrink: 0 },
  form: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  input: { height: 52, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, fontFamily: font.medium },
  disabledMask: { opacity: 0.45, borderRadius: radius.pill },
});
