import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, PrimaryButton } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, MedicalDocument, Medication, Surgery } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const MODULES = [
  { key: "labs", ru: "Анализы", en: "Labs" },
  { key: "mind", ru: "Психика и сон", en: "Mind & sleep" },
  { key: "medications", ru: "Лекарства", en: "Medications" },
  { key: "pressure", ru: "Давление", en: "Blood pressure" },
  { key: "women_health", ru: "Женское здоровье", en: "Women's health" },
];

const csv = (value: string) => value.split(",").map((x) => x.trim()).filter(Boolean);

export default function MedicalCardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeProfile, reload, refreshTick, bumpRefresh } = useApp();
  const { lang } = useI18n();

  const [meds, setMeds] = useState<Medication[]>([]);
  const [docs, setDocs] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const [diagnoses, setDiagnoses] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [includeAI, setIncludeAI] = useState(true);
  const [shareDocs, setShareDocs] = useState(false);
  const [modules, setModules] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!activeProfile) {
      setMeds([]);
      setDocs([]);
      setError(false);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const [m, d] = await Promise.all([
        api.listMeds(activeProfile.id),
        api.listDocuments(activeProfile.id),
      ]);
      setMeds(m.filter((x) => x.active));
      setDocs(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeProfile?.id]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load, refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload().catch(() => {}), load()]);
    setRefreshing(false);
  };

  const openEdit = () => {
    if (!activeProfile) return;
    setDiagnoses((activeProfile.diagnoses || []).join(", "));
    setSurgeries((activeProfile.surgeries || []).map((s) => [s.title, s.date || "", s.note || ""].join(" | ")).join("\n"));
    setIncludeAI(activeProfile.privacy?.include_in_ai_context !== false);
    setShareDocs(activeProfile.privacy?.share_documents === true);
    setModules(activeProfile.module_settings || {});
    setEdit(true);
  };

  const parseSurgeries = (): Surgery[] => surgeries
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, date, note] = line.split("|").map((x) => x.trim());
      return {
        id: activeProfile?.surgeries?.[index]?.id || `surgery-${Date.now()}-${index}`,
        title,
        date: date || null,
        note: note || null,
      };
    })
    .filter((x) => x.title);

  const save = async () => {
    if (!activeProfile) return;
    setSaving(true);
    try {
      await api.updateProfile(activeProfile.id, {
        diagnoses: csv(diagnoses),
        surgeries: parseSurgeries(),
        privacy: {
          ...(activeProfile.privacy || {}),
          include_in_ai_context: includeAI,
          share_documents: shareDocs,
        },
        module_settings: modules,
      });
      await reload();
      bumpRefresh();
      setEdit(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>;
  }

  if (!activeProfile) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={lang === "ru" ? "Медицинская карта" : "Medical card"} />
        <View style={styles.state}>
          <Ionicons name="person-circle-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.stateTitle}>{lang === "ru" ? "Сначала выберите профиль" : "Choose a profile first"}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={lang === "ru" ? "Медицинская карта" : "Medical card"} />
        <View style={styles.state}>
          <Ionicons name="cloud-offline-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.stateTitle}>{lang === "ru" ? "Не удалось загрузить карту" : "Could not load medical card"}</Text>
          <PrimaryButton label={lang === "ru" ? "Повторить" : "Retry"} onPress={() => { setLoading(true); load(); }} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    );
  }

  const diagnosesList = activeProfile.diagnoses || [];
  const surgeriesList = activeProfile.surgeries || [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={lang === "ru" ? "Медицинская карта" : "Medical card"} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
      >
        <Pressable style={styles.editCard} onPress={openEdit} testID="edit-medical-card">
          <View style={styles.editIcon}><Ionicons name="create-outline" size={22} color={colors.surfaceSecondary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.editTitle}>{lang === "ru" ? "Обновить медицинскую карту" : "Update medical card"}</Text>
            <Text style={styles.editHint}>{lang === "ru" ? "Диагнозы, операции, privacy и модули" : "Diagnoses, procedures, privacy and modules"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.surfaceSecondary} />
        </Pressable>

        <SectionCard icon="medical-outline" title={lang === "ru" ? "Диагнозы" : "Diagnoses"}>
          {diagnosesList.length ? <TagList items={diagnosesList} /> : <Muted>{lang === "ru" ? "Нет добавленных диагнозов" : "No diagnoses added"}</Muted>}
        </SectionCard>

        <SectionCard icon="bandage-outline" title={lang === "ru" ? "Операции и вмешательства" : "Surgeries & procedures"}>
          {surgeriesList.length ? surgeriesList.map((s) => (
            <View key={s.id} style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitle}>{s.title}</Text>
                {(s.date || s.note) ? <Muted style={{ marginTop: 3 }}>{[s.date, s.note].filter(Boolean).join(" · ")}</Muted> : null}
              </View>
            </View>
          )) : <Muted>{lang === "ru" ? "Нет добавленных операций" : "No procedures added"}</Muted>}
        </SectionCard>

        <SectionCard icon="medkit-outline" title={lang === "ru" ? "Текущие лекарства" : "Current medications"}>
          {meds.length ? meds.map((m) => (
            <View key={m.id} style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitle}>{m.name}</Text>
                <Muted style={{ marginTop: 3 }}>{[m.dose, m.schedule].filter(Boolean).join(" · ") || "—"}</Muted>
              </View>
            </View>
          )) : <Muted>{lang === "ru" ? "Активных лекарств нет" : "No active medications"}</Muted>}
          <Pressable style={styles.inlineAction} onPress={() => router.push("/medications" as any)}>
            <Text style={styles.inlineActionText}>{lang === "ru" ? "Открыть лекарства" : "Open medications"}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceSecondary} />
          </Pressable>
        </SectionCard>

        <SectionCard icon="folder-outline" title={lang === "ru" ? "Документы" : "Documents"}>
          <Text style={styles.bigNumber}>{docs.length}</Text>
          <Muted>{lang === "ru" ? "оригиналов сохранено в Google Drive" : "originals stored in Google Drive"}</Muted>
          <Pressable style={styles.inlineAction} onPress={() => router.push("/documents" as any)}>
            <Text style={styles.inlineActionText}>{lang === "ru" ? "Открыть документы" : "Open documents"}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceSecondary} />
          </Pressable>
        </SectionCard>

        <SectionCard icon="shield-checkmark-outline" title={lang === "ru" ? "Конфиденциальность" : "Privacy"}>
          <StatusRow label={lang === "ru" ? "Использовать данные карты в контексте Аиды" : "Use card data in Aida context"} enabled={activeProfile.privacy?.include_in_ai_context !== false} />
          <StatusRow label={lang === "ru" ? "Разрешать передачу документов" : "Allow document sharing"} enabled={activeProfile.privacy?.share_documents === true} />
        </SectionCard>
      </ScrollView>

      <Sheet visible={edit} onClose={() => !saving && setEdit(false)} testID="medical-card-sheet" scroll>
        <Text style={styles.sheetTitle}>{lang === "ru" ? "Редактировать карту" : "Edit medical card"}</Text>
        <Text style={styles.fieldLabel}>{lang === "ru" ? "Диагнозы" : "Diagnoses"}</Text>
        <TextInput value={diagnoses} onChangeText={setDiagnoses} style={styles.input} placeholder={lang === "ru" ? "через запятую" : "comma separated"} placeholderTextColor={colors.onSurfaceSecondary} />

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{lang === "ru" ? "Операции / вмешательства" : "Surgeries / procedures"}</Text>
        <TextInput
          value={surgeries}
          onChangeText={setSurgeries}
          multiline
          style={[styles.input, { minHeight: 110, paddingTop: spacing.md, textAlignVertical: "top" }]}
          placeholder={lang === "ru" ? "Операция | 2024-05-20 | комментарий\nКаждая операция — с новой строки" : "Procedure | 2024-05-20 | note\nOne procedure per line"}
          placeholderTextColor={colors.onSurfaceSecondary}
        />

        <Text style={[styles.subheading, { marginTop: spacing.xl }]}>{lang === "ru" ? "Конфиденциальность" : "Privacy"}</Text>
        <ToggleRow label={lang === "ru" ? "Использовать карту в контексте Аиды" : "Use card in Aida context"} value={includeAI} onChange={setIncludeAI} />
        <ToggleRow label={lang === "ru" ? "Разрешать передачу документов" : "Allow document sharing"} value={shareDocs} onChange={setShareDocs} />

        <Text style={[styles.subheading, { marginTop: spacing.xl }]}>{lang === "ru" ? "Активные модули" : "Active modules"}</Text>
        {MODULES.map((m) => (
          <ToggleRow
            key={m.key}
            label={lang === "ru" ? m.ru : m.en}
            value={modules[m.key] !== false}
            onChange={(value) => setModules((prev) => ({ ...prev, [m.key]: value }))}
          />
        ))}

        <PrimaryButton label={lang === "ru" ? "Сохранить" : "Save"} onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />
      </Sheet>
    </View>
  );
}

const SectionCard: React.FC<{ icon: any; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card style={{ marginBottom: spacing.md }}>
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={19} color={colors.onSurface} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </Card>
);

const TagList: React.FC<{ items: string[] }> = ({ items }) => (
  <View style={styles.tags}>{items.map((x, i) => <View key={`${x}-${i}`} style={styles.tag}><Text style={styles.tagText}>{x}</Text></View>)}</View>
);

const StatusRow: React.FC<{ label: string; enabled: boolean }> = ({ label, enabled }) => (
  <View style={styles.statusRow}>
    <Text style={styles.statusLabel}>{label}</Text>
    <View style={[styles.statusBadge, enabled ? styles.statusOn : styles.statusOff]}>
      <Text style={styles.statusText}>{enabled ? "ON" : "OFF"}</Text>
    </View>
  </View>
);

const ToggleRow: React.FC<{ label: string; value: boolean; onChange: (value: boolean) => void }> = ({ label, value, onChange }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.surfaceTertiary, true: colors.brandTertiary }} thumbColor={value ? colors.brandPrimary : colors.onSurfaceSecondary} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  editCard: { minHeight: 82, borderRadius: radius.xl, backgroundColor: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md },
  editIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  editTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.surfaceSecondary, fontFamily: fonts.text },
  editHint: { marginTop: 3, fontSize: fontSize.sm, lineHeight: 18, color: "rgba(255,255,255,0.68)", fontFamily: fonts.text },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 7 },
  tagText: { fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500", fontFamily: fonts.text },
  detailRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  detailTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  inlineAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  inlineActionText: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface, fontFamily: fonts.text },
  bigNumber: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  statusRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  statusLabel: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  statusBadge: { minWidth: 42, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, alignItems: "center" },
  statusOn: { backgroundColor: colors.brandTertiary },
  statusOff: { backgroundColor: colors.surfaceTertiary },
  statusText: { fontSize: 10, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.sm, fontFamily: fonts.text },
  input: { minHeight: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.base, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.text },
  subheading: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  toggleRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  toggleLabel: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
});
