import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking, Platform, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, apiFetch, MedicalDocument } from "@/src/api";
import { withTimeout } from "@/src/async";
import { AddCard, FCard, figma, FigmaTxt as Txt, mobileStyles, RoundIcon, SectionHeader } from "@/src/emergent/figma-mobile";

const TYPES = [
  { key: "discharge", ru: "Выписка", en: "Discharge summary" },
  { key: "doctor_note", ru: "Заключение", en: "Doctor note" },
  { key: "prescription", ru: "Назначение", en: "Prescription" },
  { key: "imaging", ru: "Исследование", en: "Imaging / study" },
  { key: "other", ru: "Другое", en: "Other" },
];
type UploadFile = { uri: string; name: string; type: string };
const DOCUMENTS_TIMEOUT_MS = 3500;

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [items, setItems] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("other");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<UploadFile | null>(null);

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); setError(false); setLoading(false); return; }
    setError(false);
    try { setItems(await withTimeout(api.listDocuments(activeId), DOCUMENTS_TIMEOUT_MS, "documents")); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, [activeId]);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load, refreshTick]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const uploadSelected = async (file: UploadFile) => {
    if (!activeId || saving) return;
    setSaving(true); setUploadError(null); setPendingFile(file);
    try {
      if (Platform.OS === "web") {
        const fileResponse = await withTimeout(fetch(file.uri), 5000, "document_file_read");
        if (!fileResponse.ok) throw new Error("Could not read selected file");
        const blob = await withTimeout(fileResponse.blob(), 5000, "document_file_blob");
        const form = new FormData();
        form.append("profile_id", activeId); form.append("document_type", type);
        if (note.trim()) form.append("note", note.trim());
        form.append("file", blob, file.name);
        const response = await withTimeout(apiFetch("/documents/upload", { method: "POST", body: form }), 12000, "document_upload");
        if (!response.ok) throw new Error(`${response.status}: ${await response.text().catch(() => "")}`);
        await response.json();
      } else await withTimeout(api.uploadDocument(activeId, type, note, file), 12000, "document_upload");
      setOpen(false); setNote(""); setType("other"); setPendingFile(null); setUploadError(null); bumpRefresh(); await load();
    } catch (e: any) {
      const raw = String(e?.message || "").toLowerCase();
      setUploadError(raw.includes("timeout") ? (ru ? "Загрузка заняла слишком много времени. Можно повторить отправку." : "Upload took too long. You can retry it.") : (ru ? "Не удалось загрузить документ. Проверьте соединение и повторите отправку." : "Could not upload the document. Check your connection and retry."));
    } finally { setSaving(false); }
  };

  const pick = async () => {
    if (!activeId || saving) return;
    setUploadError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await uploadSelected({ uri: a.uri, name: a.name || "medical-document.pdf", type: a.mimeType || "application/pdf" });
  };
  const typeLabel = (key?: string | null) => { const found = TYPES.find((x) => x.key === key); return found ? (ru ? found.ru : found.en) : (ru ? "Документ" : "Document"); };
  const openFile = async (url?: string | null) => { if (!url) return; if (await Linking.canOpenURL(url)) await Linking.openURL(url); };

  return <View style={mobileStyles.page}>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={figma.ink} />} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 + insets.bottom }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><RoundIcon icon="chevron-back" size={42} bg={figma.card} /></Pressable>
          <View style={{ flex: 1 }}><Txt variant="h1" style={styles.title}>{ru ? "Документы" : "Documents"}</Txt><Txt variant="label" color={figma.muted}>{ru ? "Медицинские файлы и заключения" : "Medical files and reports"}</Txt></View>
          {!!activeId && <Pressable onPress={() => { setUploadError(null); setPendingFile(null); setOpen(true); }}><RoundIcon icon="add" size={42} bg={figma.card} /></Pressable>}
        </View>

        {!!activeId && <View style={{ marginTop: 18 }}><AddCard testID="upload-medical-document" title={ru ? "Загрузить документ" : "Upload document"} subtitle={ru ? "PDF, фото, выписка, заключение или назначение" : "PDF, image, discharge summary, report or prescription"} icon="document-attach-outline" onPress={() => { setUploadError(null); setPendingFile(null); setOpen(true); }} /></View>}

        {loading ? <View style={styles.center} testID="documents-loading-state"><ActivityIndicator size="small" color={figma.ink} /><Txt variant="label" color={figma.muted}>{ru ? "Обновляем документы…" : "Refreshing documents…"}</Txt></View> : null}
        {!loading && !activeId ? <FCard style={styles.state}><RoundIcon icon="person-circle-outline" size={48} bg={figma.bg} /><Txt variant="caption" weight="bold">{ru ? "Сначала выберите профиль" : "Choose a profile first"}</Txt><Txt variant="label" color={figma.muted} center>{ru ? "Документы всегда привязаны к конкретному человеку." : "Documents are always linked to a specific person."}</Txt></FCard> : null}
        {!loading && activeId && error ? <View testID="documents-error-state"><FCard style={styles.state}><RoundIcon icon="cloud-offline-outline" size={48} bg={figma.bg} /><Txt variant="caption" weight="bold">{ru ? "Не удалось обновить список" : "Could not refresh the list"}</Txt><Txt variant="label" color={figma.muted} center>{ru ? "Уже загруженные документы остаются доступными." : "Previously loaded documents remain available"}</Txt><Pressable onPress={() => { setLoading(true); void load(); }} style={styles.blackBtn}><Txt variant="label" color="#fff" weight="bold">{ru ? "Повторить" : "Retry"}</Txt></Pressable></FCard></View> : null}

        {!loading && activeId && !error ? <>
          <SectionHeader title={ru ? "Мои документы" : "My documents"} action={items.length ? `${items.length}` : undefined} />
          {items.length === 0 ? <FCard style={styles.state}><RoundIcon icon="folder-open-outline" size={48} bg={figma.bg} /><Txt variant="caption" weight="bold">{ru ? "Документов пока нет" : "No documents yet"}</Txt><Txt variant="label" color={figma.muted} center>{ru ? "Здесь будут храниться оригиналы загруженных медицинских файлов." : "Original uploaded medical files will appear here."}</Txt></FCard> : <View style={styles.stack}>{items.map((d) => <Pressable key={d.id} onPress={() => void openFile(d.drive_url)} disabled={!d.drive_url} testID={`document-${d.id}`}><FCard style={styles.docCard}><View style={[styles.fileIcon, { backgroundColor: d.mime_type?.includes("pdf") ? "#FBEAE5" : "#EAF2FA" }]}><Ionicons name={d.mime_type?.includes("pdf") ? "document-text-outline" : "image-outline"} size={21} color={figma.ink} /></View><View style={{ flex: 1 }}><Txt variant="caption" weight="bold" numberOfLines={2}>{d.name}</Txt><Txt variant="label" color={figma.muted} style={{ marginTop: 3 }}>{typeLabel(d.document_type)}{d.created_at ? ` · ${d.created_at.slice(0, 10)}` : ""}</Txt>{d.note ? <Txt variant="label" color={figma.soft} style={{ marginTop: 6 }} numberOfLines={2}>{d.note}</Txt> : null}</View>{d.drive_url ? <Ionicons name="open-outline" size={18} color={figma.muted} /> : null}</FCard></Pressable>)}</View>}
        </> : null}
      </View>
    </ScrollView>

    <Sheet visible={open} onClose={() => !saving && setOpen(false)} testID="document-upload-sheet" scroll>
      <Txt variant="h1" style={styles.sheetTitle}>{ru ? "Новый документ" : "New document"}</Txt>
      <Txt variant="label" color={figma.muted} style={{ marginTop: 4 }}>{ru ? "Выберите тип документа" : "Choose document type"}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types}>{TYPES.map((x) => <Pressable key={x.key} onPress={() => setType(x.key)} style={[styles.typeChip, type === x.key && styles.typeChipActive]}><Txt variant="label" weight="bold">{ru ? x.ru : x.en}</Txt></Pressable>)}</ScrollView>
      <Txt variant="label" weight="bold" style={{ marginTop: 18 }}>{ru ? "Заметка (необязательно)" : "Note (optional)"}</Txt>
      <TextInput value={note} onChangeText={setNote} multiline style={styles.input} placeholder={ru ? "Например: заключение кардиолога" : "For example: cardiology report"} placeholderTextColor={figma.muted} />
      {uploadError ? <View testID="document-upload-error"><FCard style={styles.errorCard}><Ionicons name="alert-circle-outline" size={20} color="#C64E5B" /><Txt variant="label" color="#C64E5B" style={{ flex: 1 }}>{uploadError}</Txt></FCard></View> : null}
      <Pressable disabled={saving} onPress={() => uploadError && pendingFile ? void uploadSelected(pendingFile) : void pick()} style={styles.saveBtn}>{saving ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name={uploadError && pendingFile ? "refresh-outline" : "document-attach-outline"} size={18} color="#fff" /><Txt variant="caption" color="#fff" weight="bold">{uploadError && pendingFile ? (ru ? "Повторить отправку" : "Retry upload") : (ru ? "Выбрать PDF или фото" : "Choose PDF or image")}</Txt></>}</Pressable>
      <Txt variant="label" color={figma.muted} style={{ marginTop: 12, lineHeight: 18 }}>{ru ? "Документ сохранится как оригинал. Аида не будет автоматически считать его лабораторным анализом." : "The original file will be stored as-is. Aida will not automatically treat it as a lab result."}</Txt>
    </Sheet>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 }, title: { fontSize: 28, lineHeight: 32 },
  center: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10 }, state: { minHeight: 180, marginTop: 20, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, blackBtn: { marginTop: 8, minHeight: 40, paddingHorizontal: 20, borderRadius: 999, backgroundColor: figma.ink, alignItems: "center", justifyContent: "center" },
  stack: { gap: 10 }, docCard: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 12 }, fileIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 28, lineHeight: 32 }, types: { gap: 8, paddingVertical: 14 }, typeChip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: figma.bg, alignItems: "center", justifyContent: "center" }, typeChipActive: { backgroundColor: figma.lime }, input: { minHeight: 92, marginTop: 8, borderRadius: 18, backgroundColor: figma.bg, paddingHorizontal: 16, paddingVertical: 14, color: figma.ink, textAlignVertical: "top" }, errorCard: { marginTop: 12, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FDECEF" }, saveBtn: { height: 52, borderRadius: 999, backgroundColor: figma.ink, marginTop: 18, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
});