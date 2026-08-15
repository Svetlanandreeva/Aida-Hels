import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, PrimaryButton, Chip } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, MedicalDocument } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const TYPES = [
  { key: "discharge", ru: "Выписка", en: "Discharge summary" },
  { key: "doctor_note", ru: "Заключение", en: "Doctor note" },
  { key: "prescription", ru: "Назначение", en: "Prescription" },
  { key: "imaging", ru: "Исследование", en: "Imaging / study" },
  { key: "other", ru: "Другое", en: "Other" },
];

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { lang } = useI18n();

  const [items, setItems] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("other");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setItems([]);
      setError(false);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      setItems(await api.listDocuments(activeId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load, refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pick = async () => {
    if (!activeId || saving) return;
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;

    const a = res.assets[0];
    setSaving(true);
    try {
      await api.uploadDocument(activeId, type, note, {
        uri: a.uri,
        name: a.name || "medical-document.pdf",
        type: a.mimeType || "application/pdf",
      });
      setOpen(false);
      setNote("");
      setType("other");
      bumpRefresh();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (key?: string | null) => {
    const found = TYPES.find((x) => x.key === key);
    return found ? (lang === "ru" ? found.ru : found.en) : (lang === "ru" ? "Документ" : "Document");
  };

  const openFile = async (url?: string | null) => {
    if (!url) return;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={lang === "ru" ? "Медицинские документы" : "Medical documents"} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.onSurface} />
        </View>
      ) : !activeId ? (
        <View style={styles.centerState}>
          <Ionicons name="person-circle-outline" size={52} color={colors.onSurfaceSecondary} />
          <Text style={styles.stateTitle}>{lang === "ru" ? "Сначала выберите профиль" : "Choose a profile first"}</Text>
          <Muted style={styles.stateText}>{lang === "ru" ? "Документы всегда привязаны к конкретному человеку." : "Documents are always linked to a specific person."}</Muted>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={52} color={colors.onSurfaceSecondary} />
          <Text style={styles.stateTitle}>{lang === "ru" ? "Не удалось загрузить документы" : "Could not load documents"}</Text>
          <PrimaryButton label={lang === "ru" ? "Повторить" : "Retry"} onPress={() => { setLoading(true); load(); }} style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
        >
          <Pressable style={styles.addCard} onPress={() => setOpen(true)} testID="upload-medical-document">
            <View style={styles.addIcon}>
              <Ionicons name="document-attach-outline" size={22} color={colors.surfaceSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addTitle}>{lang === "ru" ? "Загрузить документ" : "Upload document"}</Text>
              <Text style={styles.addHint}>{lang === "ru" ? "Выписка, заключение, назначение или другое" : "Discharge summary, doctor note, prescription or other"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.surfaceSecondary} />
          </Pressable>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={56} color={colors.onSurfaceSecondary} />
              <Text style={styles.stateTitle}>{lang === "ru" ? "Документов пока нет" : "No documents yet"}</Text>
              <Muted style={styles.stateText}>{lang === "ru" ? "Здесь будут храниться оригиналы медицинских файлов из Google Drive." : "Original medical files from Google Drive will appear here."}</Muted>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {items.map((d) => (
                <Pressable key={d.id} onPress={() => openFile(d.drive_url)} disabled={!d.drive_url} testID={`document-${d.id}`}>
                  <Card>
                    <View style={styles.row}>
                      <View style={styles.fileIcon}>
                        <Ionicons name={d.mime_type?.includes("pdf") ? "document-text-outline" : "image-outline"} size={21} color={colors.onSurface} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fileName} numberOfLines={2}>{d.name}</Text>
                        <Muted style={{ marginTop: 3 }}>{typeLabel(d.document_type)}{d.created_at ? ` · ${d.created_at.slice(0, 10)}` : ""}</Muted>
                        {d.note ? <Text style={styles.note} numberOfLines={2}>{d.note}</Text> : null}
                      </View>
                      {d.drive_url ? <Ionicons name="open-outline" size={18} color={colors.onSurfaceSecondary} /> : null}
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Sheet visible={open} onClose={() => !saving && setOpen(false)} testID="document-upload-sheet" scroll>
        <Text style={styles.sheetTitle}>{lang === "ru" ? "Новый документ" : "New document"}</Text>
        <Text style={styles.fieldLabel}>{lang === "ru" ? "Тип документа" : "Document type"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TYPES.map((x) => (
            <Chip key={x.key} label={lang === "ru" ? x.ru : x.en} active={type === x.key} onPress={() => setType(x.key)} />
          ))}
        </ScrollView>
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{lang === "ru" ? "Заметка (необязательно)" : "Note (optional)"}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          style={styles.input}
          placeholder={lang === "ru" ? "Например: заключение кардиолога" : "For example: cardiology report"}
          placeholderTextColor={colors.onSurfaceSecondary}
        />
        <PrimaryButton
          label={lang === "ru" ? "Выбрать PDF или фото" : "Choose PDF or image"}
          icon="document-attach-outline"
          onPress={pick}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
        <Muted style={{ marginTop: spacing.md, lineHeight: 18 }}>
          {lang === "ru" ? "Документ сохранится как оригинал. Аида не будет автоматически считать его лабораторным анализом." : "The original file will be stored as-is. Aida will not automatically treat it as a lab result."}
        </Muted>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], paddingHorizontal: spacing.lg },
  stateTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center", fontFamily: fonts.text },
  stateText: { marginTop: spacing.sm, textAlign: "center", lineHeight: 19 },
  addCard: { minHeight: 82, borderRadius: radius.xl, backgroundColor: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  addTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.surfaceSecondary, fontFamily: fonts.text },
  addHint: { marginTop: 3, fontSize: fontSize.sm, lineHeight: 18, color: "rgba(255,255,255,0.68)", fontFamily: fonts.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  fileIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  fileName: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  note: { marginTop: spacing.sm, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurface, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  chips: { gap: spacing.sm, paddingVertical: spacing.sm },
  input: { minHeight: 84, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: fontSize.base, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top", fontFamily: fonts.text },
});
