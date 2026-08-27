import React, { createContext, useCallback, useContext, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Sheet } from "./Sheet";
import { Chip, PrimaryButton } from "./ui";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useApp } from "@/src/store";
import { api, Biomarker, LabImportPreview } from "@/src/api";

type Ctx = { openMenu: () => void; openSymptom: () => void; openMed: () => void; openLab: (targetProfileId?: string) => void; toast: (msg: string) => void };
const LogContext = createContext<Ctx>({ openMenu: () => {}, openSymptom: () => {}, openMed: () => {}, openLab: () => {}, toast: () => {} });
export const useLog = () => useContext(LogContext);

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, lang } = useI18n();
  const { activeId, profiles, bumpRefresh } = useApp();
  const [menu, setMenu] = useState(false);
  const [symOpen, setSymOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [labTarget, setLabTarget] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [labPreview, setLabPreview] = useState<LabImportPreview | null>(null);
  const [labError, setLabError] = useState<string | null>(null);
  const [savingLab, setSavingLab] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [permBlocked, setPermBlocked] = useState(false);

  const [symName, setSymName] = useState("");
  const [symSev, setSymSev] = useState(5);
  const [symNote, setSymNote] = useState("");
  const [savingSym, setSavingSym] = useState(false);
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medSchedule, setMedSchedule] = useState("");
  const [savingMed, setSavingMed] = useState(false);

  const toast = useCallback((msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2600); }, []);
  const openMenu = useCallback(() => setMenu(true), []);
  const openSymptom = useCallback(() => { setMenu(false); setSymName(""); setSymSev(5); setSymNote(""); setTimeout(() => setSymOpen(true), 250); }, []);
  const openMed = useCallback(() => { setMenu(false); setMedName(""); setMedDose(""); setMedSchedule(""); setTimeout(() => setMedOpen(true), 250); }, []);
  const openLab = useCallback((targetProfileId?: string) => {
    setMenu(false);
    setLabTarget(targetProfileId || activeId || profiles[0]?.id || null);
    setPermBlocked(false);
    setLabPreview(null);
    setLabError(null);
    setTimeout(() => setLabOpen(true), 250);
  }, [activeId, profiles]);

  const saveSymptom = async () => {
    if (!symName.trim() || !activeId) return;
    setSavingSym(true);
    try { await api.createSymptom({ profile_id: activeId, name: symName.trim(), severity: symSev, note: symNote.trim() || null }); setSymOpen(false); bumpRefresh(); toast(lang === "ru" ? "Симптом записан" : "Symptom logged"); }
    finally { setSavingSym(false); }
  };
  const saveMed = async () => {
    if (!medName.trim() || !activeId) return;
    setSavingMed(true);
    try { await api.createMed({ profile_id: activeId, name: medName.trim(), dose: medDose.trim() || null, schedule: medSchedule.trim() || null, active: true }); setMedOpen(false); bumpRefresh(); toast(lang === "ru" ? "Лекарство добавлено" : "Medication added"); }
    finally { setSavingMed(false); }
  };

  const processUpload = async (file: { uri: string; name: string; type: string }) => {
    const target = labTarget || activeId || profiles[0]?.id;
    if (!target) {
      const message = lang === "ru" ? "Сначала выберите профиль, для которого загружается анализ." : "Choose a profile before uploading a lab.";
      setLabError(message);
      toast(message);
      return;
    }
    setLabError(null);
    setRecognizing(true);
    try {
      const preview = await api.uploadLab(target, lang, file);
      setLabPreview(preview);
      toast(lang === "ru" ? "Проверьте распознанные значения перед сохранением" : "Review recognized values before saving");
    } catch (cause) {
      const message = lang === "ru" ? "Не удалось загрузить или распознать анализ. Попробуйте ещё раз." : "Could not upload or read the lab. Please try again.";
      setLabError(message);
      toast(message);
      console.warn("Lab upload failed", cause);
    } finally { setRecognizing(false); }
  };

  const updatePreview = (patch: Partial<LabImportPreview>) => setLabPreview((prev) => prev ? { ...prev, ...patch } : prev);
  const updateBiomarker = (index: number, patch: Partial<Biomarker>) => setLabPreview((prev) => {
    if (!prev) return prev;
    const biomarkers = prev.biomarkers.map((item, i) => i === index ? { ...item, ...patch } : item);
    return { ...prev, biomarkers };
  });
  const removeBiomarker = (index: number) => setLabPreview((prev) => prev ? { ...prev, biomarkers: prev.biomarkers.filter((_, i) => i !== index) } : prev);
  const addBiomarker = () => setLabPreview((prev) => prev ? { ...prev, biomarkers: [...prev.biomarkers, { name: "", value: "", unit: "", reference: "", status: "unknown" }] } : prev);

  const confirmLab = async () => {
    if (!labPreview || !labPreview.biomarkers.some((b) => b.name.trim() && b.value.trim())) return;
    setSavingLab(true);
    try {
      await api.updateLabImport(labPreview.import_id, {
        title: labPreview.title, date: labPreview.date, lab_name: labPreview.lab_name,
        biomarkers: labPreview.biomarkers, ai_summary: labPreview.ai_summary,
      });
      await api.commitLabImport(labPreview.import_id);
      setLabPreview(null); setLabOpen(false); bumpRefresh();
      toast(lang === "ru" ? "Анализ проверен и сохранён" : "Lab reviewed and saved");
    } catch { toast(lang === "ru" ? "Не удалось сохранить подтверждённый анализ" : "Could not save the reviewed lab"); }
    finally { setSavingLab(false); }
  };
  const cancelLabReview = async () => {
    if (!labPreview) { setLabOpen(false); return; }
    setSavingLab(true);
    try { await api.cancelLabImport(labPreview.import_id); setLabPreview(null); setLabOpen(false); toast(lang === "ru" ? "Импорт отменён, данные не добавлены" : "Import cancelled; no medical data was added"); }
    catch { toast(lang === "ru" ? "Не удалось отменить импорт" : "Could not cancel import"); }
    finally { setSavingLab(false); }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync(); if (!perm.granted) { if (!perm.canAskAgain) setPermBlocked(true); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 }); if (!res.canceled && res.assets[0]) { const a = res.assets[0]; await processUpload({ uri: a.uri, name: a.fileName || "photo.jpg", type: a.mimeType || "image/jpeg" }); }
  };
  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!perm.granted) { if (!perm.canAskAgain) setPermBlocked(true); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 }); if (!res.canceled && res.assets[0]) { const a = res.assets[0]; await processUpload({ uri: a.uri, name: a.fileName || "image.jpg", type: a.mimeType || "image/jpeg" }); }
  };
  const pickFile = async () => {
    setLabError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const browserFile = (a as any).file as Blob | undefined;
    let uploadUri = a.uri;
    let revokeUri = false;
    try {
      if (browserFile && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        uploadUri = URL.createObjectURL(browserFile);
        revokeUri = true;
      }
      await processUpload({ uri: uploadUri, name: a.name || "document.pdf", type: a.mimeType || (browserFile as any)?.type || "application/pdf" });
    } finally {
      if (revokeUri && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(uploadUri);
    }
  };

  return <LogContext.Provider value={{ openMenu, openSymptom, openMed, openLab, toast }}>
    {children}
    <Sheet visible={menu} onClose={() => setMenu(false)} testID="log-menu-sheet">
      <Text style={styles.sheetTitle}>{t("log_data")}</Text>
      <MenuRow icon="water-outline" label={t("upload_lab")} onPress={() => openLab()} testID="menu-lab" />
      <MenuRow icon="pulse-outline" label={t("add_symptom")} onPress={openSymptom} testID="menu-symptom" />
      <MenuRow icon="medkit-outline" label={t("add_medication")} onPress={openMed} testID="menu-med" />
    </Sheet>

    <Sheet visible={symOpen} onClose={() => setSymOpen(false)} testID="symptom-sheet" scroll>
      <Text style={styles.sheetTitle}>{t("add_symptom")}</Text>
      <Field label={t("symptom_name")}><TextInput testID="symptom-name-input" value={symName} onChangeText={setSymName} placeholder={lang === "ru" ? "Напр. головная боль" : "e.g. headache"} placeholderTextColor={colors.onSurfaceSecondary} style={styles.input} /></Field>
      <Field label={`${t("severity")}: ${symSev}/10`}><View style={styles.sevRow}>{Array.from({ length: 10 }).map((_, i) => { const v = i + 1; return <Pressable key={v} testID={`severity-${v}`} onPress={() => setSymSev(v)} style={[styles.sevDot, v <= symSev && styles.sevDotActive]}><Text style={[styles.sevText, v <= symSev && { color: colors.onBrandPrimary }]}>{v}</Text></Pressable>; })}</View></Field>
      <Field label={`${t("note")} (${t("optional")})`}><TextInput testID="symptom-note-input" value={symNote} onChangeText={setSymNote} multiline style={[styles.input, { height: 80, paddingTop: spacing.md, textAlignVertical: "top" }]} placeholderTextColor={colors.onSurfaceSecondary} /></Field>
      <PrimaryButton label={t("save")} onPress={saveSymptom} loading={savingSym} testID="save-symptom" />
    </Sheet>

    <Sheet visible={medOpen} onClose={() => setMedOpen(false)} testID="medication-sheet" scroll>
      <Text style={styles.sheetTitle}>{t("add_medication")}</Text>
      <Field label={t("med_name")}><TextInput testID="med-name-input" value={medName} onChangeText={setMedName} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} /></Field>
      <Field label={`${t("dose")} (${t("optional")})`}><TextInput testID="med-dose-input" value={medDose} onChangeText={setMedDose} placeholder={lang === "ru" ? "Напр. 5 мг" : "e.g. 5 mg"} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} /></Field>
      <Field label={`${t("schedule")} (${t("optional")})`}><TextInput testID="med-schedule-input" value={medSchedule} onChangeText={setMedSchedule} placeholder={lang === "ru" ? "Напр. 1 таб утром" : "e.g. 1 tab in the morning"} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} /></Field>
      <PrimaryButton label={t("save")} onPress={saveMed} loading={savingMed} testID="save-med" />
    </Sheet>

    <Sheet visible={labOpen} onClose={() => !recognizing && !savingLab && setLabOpen(false)} testID="lab-sheet" scroll>
      <Text style={styles.sheetTitle}>{labPreview ? (lang === "ru" ? "Проверьте анализ" : "Review lab") : t("upload_lab")}</Text>
      {recognizing ? <View style={styles.recognizing}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.recognizingText}>{t("recognizing")}</Text><Text style={styles.reviewHint}>{lang === "ru" ? "Ничего не попадёт в медицинскую историю без вашего подтверждения." : "Nothing is added to medical history without your confirmation."}</Text></View> : labPreview ? <>
        <View style={styles.reviewBanner}><Ionicons name="shield-checkmark-outline" size={20} color={colors.brand} /><Text style={styles.reviewBannerText}>{lang === "ru" ? "OCR может ошибаться. Исправьте значения и сохраните только после проверки." : "OCR can be wrong. Correct values and save only after review."}</Text></View>
        <Field label={lang === "ru" ? "Название анализа" : "Lab title"}><TextInput testID="lab-preview-title" value={labPreview.title} onChangeText={(title) => updatePreview({ title })} style={styles.input} /></Field>
        <View style={styles.twoCols}><View style={styles.flex}><Field label={lang === "ru" ? "Дата" : "Date"}><TextInput testID="lab-preview-date" value={labPreview.date} onChangeText={(date) => updatePreview({ date })} style={styles.input} /></Field></View><View style={styles.flex}><Field label={lang === "ru" ? "Лаборатория" : "Laboratory"}><TextInput testID="lab-preview-lab" value={labPreview.lab_name || ""} onChangeText={(lab_name) => updatePreview({ lab_name })} style={styles.input} /></Field></View></View>
        <Text style={styles.sectionTitle}>{lang === "ru" ? "Распознанные показатели" : "Recognized biomarkers"}</Text>
        {labPreview.biomarkers.map((b, i) => <View key={`${i}-${b.name}`} style={styles.markerCard} testID={`lab-preview-row-${i}`}>
          <View style={styles.markerHead}><Text style={styles.markerIndex}>{i + 1}</Text><Pressable onPress={() => removeBiomarker(i)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} /></Pressable></View>
          <TextInput value={b.name} onChangeText={(name) => updateBiomarker(i, { name })} placeholder={lang === "ru" ? "Показатель" : "Biomarker"} placeholderTextColor={colors.onSurfaceSecondary} style={styles.input} />
          <View style={styles.twoCols}><TextInput value={b.value} onChangeText={(value) => updateBiomarker(i, { value })} placeholder={lang === "ru" ? "Значение" : "Value"} placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input, styles.flex]} /><TextInput value={b.unit || ""} onChangeText={(unit) => updateBiomarker(i, { unit })} placeholder={lang === "ru" ? "Ед." : "Unit"} placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input, styles.flex]} /></View>
          <TextInput value={b.reference || ""} onChangeText={(reference) => updateBiomarker(i, { reference })} placeholder={lang === "ru" ? "Референс" : "Reference"} placeholderTextColor={colors.onSurfaceSecondary} style={styles.input} />
        </View>)}
        <Pressable onPress={addBiomarker} style={styles.addMarker} testID="lab-preview-add"><Ionicons name="add" size={18} color={colors.brand} /><Text style={styles.addMarkerText}>{lang === "ru" ? "Добавить показатель" : "Add biomarker"}</Text></Pressable>
        <View style={styles.actions}><PrimaryButton label={lang === "ru" ? "Подтвердить и сохранить" : "Confirm and save"} onPress={confirmLab} loading={savingLab} testID="lab-preview-confirm" /><Pressable disabled={savingLab} onPress={cancelLabReview} style={styles.cancelBtn} testID="lab-preview-cancel"><Text style={styles.cancelText}>{lang === "ru" ? "Отменить импорт" : "Cancel import"}</Text></Pressable></View>
      </> : <>
        <View style={styles.whoseBox}><Text style={styles.whoseTitle}>{t("whose_lab")}</Text><Text style={styles.whoseHint}>{t("whose_lab_hint")}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>{profiles.map((p) => <Chip key={p.id} testID={`lab-target-${p.id}`} label={p.name} active={labTarget === p.id} onPress={() => { setLabTarget(p.id); setLabError(null); }} />)}</ScrollView></View>
        {labError && <View style={styles.permBanner} testID="lab-upload-error"><Ionicons name="alert-circle-outline" size={18} color={colors.warning} /><Text style={styles.permText}>{labError}</Text></View>}
        {permBlocked && <Pressable style={styles.permBanner} onPress={() => Linking.openSettings()} testID="open-settings"><Ionicons name="warning-outline" size={18} color={colors.warning} /><Text style={styles.permText}>{lang === "ru" ? "Доступ запрещён. Открыть настройки" : "Access denied. Open settings"}</Text></Pressable>}
        <MenuRow icon="camera-outline" label={t("from_camera")} onPress={pickCamera} testID="lab-camera" /><MenuRow icon="images-outline" label={t("from_gallery")} onPress={pickGallery} testID="lab-gallery" /><MenuRow icon="document-outline" label={t("from_file")} onPress={pickFile} testID="lab-file" />
      </>}
    </Sheet>

    {toastMsg && <View style={styles.toast} testID="toast" pointerEvents="none"><Ionicons name="checkmark-circle" size={18} color={colors.onSurfaceInverse} /><Text style={styles.toastText}>{toastMsg}</Text></View>}
  </LogContext.Provider>;
};

const MenuRow: React.FC<{ icon: any; label: string; onPress: () => void; testID?: string }> = ({ icon, label, onPress, testID }) => <Pressable testID={testID} style={styles.menuRow} onPress={onPress}><View style={styles.menuIcon}><Ionicons name={icon} size={22} color={colors.brand} /></View><Text style={styles.menuLabel}>{label}</Text><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} /></Pressable>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <View style={{ marginBottom: spacing.lg }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;

const styles = StyleSheet.create({
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "600", fontFamily: fonts.text },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  input: { minHeight: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.text },
  sevRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sevDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  sevDotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  sevText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontWeight: "700", fontFamily: fonts.text },
  recognizing: { alignItems: "center", paddingVertical: spacing["2xl"], gap: spacing.lg },
  recognizingText: { fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontFamily: fonts.text, textAlign: "center" },
  reviewHint: { maxWidth: 360, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text, textAlign: "center" },
  whoseBox: { marginBottom: spacing.md }, whoseTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text }, whoseHint: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2, fontFamily: fonts.text },
  permBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  permText: { color: colors.onSurface, fontFamily: fonts.text, fontWeight: "600", flex: 1 },
  reviewBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, marginBottom: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
  reviewBannerText: { flex: 1, color: colors.onSurface, fontSize: fontSize.sm, lineHeight: 20, fontFamily: fonts.text },
  twoCols: { flexDirection: "row", gap: spacing.sm }, flex: { flex: 1 }, sectionTitle: { color: colors.onSurface, fontFamily: fonts.display, fontWeight: "700", fontSize: fontSize.lg, marginBottom: spacing.md },
  markerCard: { gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  markerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, markerIndex: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontWeight: "700" },
  addMarker: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  addMarkerText: { color: colors.brand, fontFamily: fonts.text, fontWeight: "700" }, actions: { gap: spacing.md }, cancelBtn: { minHeight: 48, alignItems: "center", justifyContent: "center" }, cancelText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontWeight: "600" },
  toast: { position: "absolute", bottom: 110, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceInverse, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, maxWidth: "90%" },
  toastText: { color: colors.onSurfaceInverse, fontSize: fontSize.base, fontWeight: "600", fontFamily: fonts.text },
});