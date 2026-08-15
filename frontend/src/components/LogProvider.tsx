import React, { createContext, useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Sheet } from "./Sheet";
import { PrimaryButton, Chip, Muted } from "./ui";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useApp } from "@/src/store";
import { api } from "@/src/api";

type Ctx = {
  openMenu: () => void;
  openSymptom: () => void;
  openMed: () => void;
  openLab: (targetProfileId?: string) => void;
  toast: (msg: string) => void;
};

const LogContext = createContext<Ctx>({
  openMenu: () => {},
  openSymptom: () => {},
  openMed: () => {},
  openLab: () => {},
  toast: () => {},
});

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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [permBlocked, setPermBlocked] = useState(false);

  // symptom form
  const [symName, setSymName] = useState("");
  const [symSev, setSymSev] = useState(5);
  const [symNote, setSymNote] = useState("");
  const [savingSym, setSavingSym] = useState(false);

  // med form
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medSchedule, setMedSchedule] = useState("");
  const [savingMed, setSavingMed] = useState(false);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const openMenu = useCallback(() => setMenu(true), []);
  const openSymptom = useCallback(() => {
    setMenu(false);
    setSymName("");
    setSymSev(5);
    setSymNote("");
    setTimeout(() => setSymOpen(true), 250);
  }, []);
  const openMed = useCallback(() => {
    setMenu(false);
    setMedName("");
    setMedDose("");
    setMedSchedule("");
    setTimeout(() => setMedOpen(true), 250);
  }, []);
  const openLab = useCallback(
    (targetProfileId?: string) => {
      setMenu(false);
      setLabTarget(targetProfileId || activeId);
      setPermBlocked(false);
      setTimeout(() => setLabOpen(true), 250);
    },
    [activeId]
  );

  const saveSymptom = async () => {
    if (!symName.trim() || !activeId) return;
    setSavingSym(true);
    try {
      await api.createSymptom({ profile_id: activeId, name: symName.trim(), severity: symSev, note: symNote.trim() || null });
      setSymOpen(false);
      bumpRefresh();
      toast(lang === "ru" ? "Симптом записан" : "Symptom logged");
    } finally {
      setSavingSym(false);
    }
  };

  const saveMed = async () => {
    if (!medName.trim() || !activeId) return;
    setSavingMed(true);
    try {
      await api.createMed({
        profile_id: activeId,
        name: medName.trim(),
        dose: medDose.trim() || null,
        schedule: medSchedule.trim() || null,
        active: true,
      });
      setMedOpen(false);
      bumpRefresh();
      toast(lang === "ru" ? "Лекарство добавлено" : "Medication added");
    } finally {
      setSavingMed(false);
    }
  };

  const processUpload = async (file: { uri: string; name: string; type: string }) => {
    const target = labTarget || activeId;
    if (!target) return;
    setRecognizing(true);
    try {
      await api.uploadLab(target, lang, file);
      setLabOpen(false);
      bumpRefresh();
      toast(lang === "ru" ? "Анализ распознан и сохранён" : "Lab recognized and saved");
    } catch (e: any) {
      toast(lang === "ru" ? "Не удалось распознать анализ" : "Could not read the lab");
    } finally {
      setRecognizing(false);
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setPermBlocked(true);
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      await processUpload({ uri: a.uri, name: a.fileName || "photo.jpg", type: a.mimeType || "image/jpeg" });
    }
  };

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setPermBlocked(true);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      await processUpload({ uri: a.uri, name: a.fileName || "image.jpg", type: a.mimeType || "image/jpeg" });
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      await processUpload({ uri: a.uri, name: a.name || "document.pdf", type: a.mimeType || "application/pdf" });
    }
  };

  const kindLabel = (k: string) => t(k === "me" ? "my_profile" : k === "child" ? "child" : "relative");

  return (
    <LogContext.Provider value={{ openMenu, openSymptom, openMed, openLab, toast }}>
      {children}

      {/* Main log menu */}
      <Sheet visible={menu} onClose={() => setMenu(false)} testID="log-menu-sheet">
        <Text style={styles.sheetTitle}>{t("log_data")}</Text>
        <MenuRow icon="water-outline" label={t("upload_lab")} onPress={() => openLab()} testID="menu-lab" />
        <MenuRow icon="pulse-outline" label={t("add_symptom")} onPress={openSymptom} testID="menu-symptom" />
        <MenuRow icon="medkit-outline" label={t("add_medication")} onPress={openMed} testID="menu-med" />
      </Sheet>

      {/* Symptom */}
      <Sheet visible={symOpen} onClose={() => setSymOpen(false)} testID="symptom-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("add_symptom")}</Text>
        <Field label={t("symptom_name")}>
          <TextInput
            testID="symptom-name-input"
            value={symName}
            onChangeText={setSymName}
            placeholder={lang === "ru" ? "Напр. головная боль" : "e.g. headache"}
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.input}
          />
        </Field>
        <Field label={`${t("severity")}: ${symSev}/10`}>
          <View style={styles.sevRow}>
            {Array.from({ length: 10 }).map((_, i) => {
              const v = i + 1;
              return (
                <Pressable
                  key={v}
                  testID={`severity-${v}`}
                  onPress={() => setSymSev(v)}
                  style={[styles.sevDot, v <= symSev && styles.sevDotActive]}
                >
                  <Text style={[styles.sevText, v <= symSev && { color: colors.onBrandPrimary }]}>{v}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Field label={`${t("note")} (${t("optional")})`}>
          <TextInput
            testID="symptom-note-input"
            value={symNote}
            onChangeText={setSymNote}
            multiline
            style={[styles.input, { height: 80, paddingTop: spacing.md, textAlignVertical: "top" }]}
            placeholderTextColor={colors.onSurfaceSecondary}
          />
        </Field>
        <PrimaryButton label={t("save")} onPress={saveSymptom} loading={savingSym} testID="save-symptom" />
      </Sheet>

      {/* Medication */}
      <Sheet visible={medOpen} onClose={() => setMedOpen(false)} testID="medication-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("add_medication")}</Text>
        <Field label={t("med_name")}>
          <TextInput testID="med-name-input" value={medName} onChangeText={setMedName} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <Field label={`${t("dose")} (${t("optional")})`}>
          <TextInput testID="med-dose-input" value={medDose} onChangeText={setMedDose} placeholder={lang === "ru" ? "Напр. 5 мг" : "e.g. 5 mg"} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <Field label={`${t("schedule")} (${t("optional")})`}>
          <TextInput testID="med-schedule-input" value={medSchedule} onChangeText={setMedSchedule} placeholder={lang === "ru" ? "Напр. 1 таб утром" : "e.g. 1 tab in the morning"} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>
        <PrimaryButton label={t("save")} onPress={saveMed} loading={savingMed} testID="save-med" />
      </Sheet>

      {/* Lab upload */}
      <Sheet visible={labOpen} onClose={() => !recognizing && setLabOpen(false)} testID="lab-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("upload_lab")}</Text>
        {recognizing ? (
          <View style={styles.recognizing}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.recognizingText}>{t("recognizing")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.whoseBox}>
              <Text style={styles.whoseTitle}>{t("whose_lab")}</Text>
              <Text style={styles.whoseHint}>{t("whose_lab_hint")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                {profiles.map((p) => (
                  <Chip
                    key={p.id}
                    testID={`lab-target-${p.id}`}
                    label={p.name}
                    active={labTarget === p.id}
                    onPress={() => setLabTarget(p.id)}
                  />
                ))}
              </ScrollView>
            </View>
            {permBlocked && (
              <Pressable style={styles.permBanner} onPress={() => Linking.openSettings()} testID="open-settings">
                <Ionicons name="warning-outline" size={18} color={colors.warning} />
                <Text style={styles.permText}>
                  {lang === "ru" ? "Доступ запрещён. Открыть настройки" : "Access denied. Open settings"}
                </Text>
              </Pressable>
            )}
            <MenuRow icon="camera-outline" label={t("from_camera")} onPress={pickCamera} testID="lab-camera" />
            <MenuRow icon="images-outline" label={t("from_gallery")} onPress={pickGallery} testID="lab-gallery" />
            <MenuRow icon="document-outline" label={t("from_file")} onPress={pickFile} testID="lab-file" />
          </>
        )}
      </Sheet>

      {/* Toast */}
      {toastMsg && (
        <View style={styles.toast} testID="toast" pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color={colors.onSurfaceInverse} />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </LogContext.Provider>
  );
};

const MenuRow: React.FC<{ icon: any; label: string; onPress: () => void; testID?: string }> = ({
  icon,
  label,
  onPress,
  testID,
}) => (
  <Pressable testID={testID} style={styles.menuRow} onPress={onPress}>
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={22} color={colors.brand} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
  </Pressable>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ marginBottom: spacing.lg }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: spacing.lg,
    fontFamily: fonts.display,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "600", fontFamily: fonts.text },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  input: {
    minHeight: 52,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.text,
  },
  sevRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sevDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sevDotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  sevText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontWeight: "700", fontFamily: fonts.text },
  recognizing: { alignItems: "center", paddingVertical: spacing["2xl"], gap: spacing.lg },
  recognizingText: { fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontFamily: fonts.text, textAlign: "center" },
  whoseBox: { marginBottom: spacing.md },
  whoseTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  whoseHint: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2, fontFamily: fonts.text },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  permText: { color: colors.onSurface, fontFamily: fonts.text, fontWeight: "600", flex: 1 },
  toast: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    maxWidth: "90%",
  },
  toastText: { color: colors.onSurfaceInverse, fontSize: fontSize.base, fontWeight: "600", fontFamily: fonts.text },
});
