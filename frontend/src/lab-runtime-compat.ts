import { Platform } from "react-native";

import { api, apiFetch, LabImportPreview, LabTest } from "@/src/api";
import { withTimeout } from "@/src/async";

const LAB_LIST_TIMEOUT_MS = 7000;
const LAB_UPLOAD_TIMEOUT_MS = 60000;
const LAB_SAVE_TIMEOUT_MS = 15000;

const originalListLabs = api.listLabs;
const originalUploadLab = api.uploadLab;
const originalUpdateLabImport = api.updateLabImport;
const originalCommitLabImport = api.commitLabImport;

async function appendWebFile(form: FormData, file: { uri: string; name: string; type: string }) {
  const response = await withTimeout(fetch(file.uri), 10000, "lab_file_read");
  if (!response.ok) throw new Error(`lab_file_read_failed_${response.status}`);
  const blob = await response.blob();
  form.append("file", blob, file.name || "lab-document");
}

api.listLabs = (pid: string): Promise<LabTest[]> =>
  withTimeout(originalListLabs(pid), LAB_LIST_TIMEOUT_MS, "labs_list");

api.uploadLab = async (pid: string, lang: string, file: { uri: string; name: string; type: string }): Promise<LabImportPreview> => {
  if (Platform.OS !== "web") {
    return withTimeout(originalUploadLab(pid, lang, file), LAB_UPLOAD_TIMEOUT_MS, "lab_upload");
  }

  const form = new FormData();
  form.append("profile_id", pid);
  form.append("language", lang);
  await appendWebFile(form, file);

  const res = await withTimeout(
    apiFetch("/labs/upload", { method: "POST", body: form }),
    LAB_UPLOAD_TIMEOUT_MS,
    "lab_upload",
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
};

api.updateLabImport = (importId, preview) =>
  withTimeout(originalUpdateLabImport(importId, preview), LAB_SAVE_TIMEOUT_MS, "lab_review_save");

api.commitLabImport = (importId) =>
  withTimeout(originalCommitLabImport(importId), LAB_SAVE_TIMEOUT_MS, "lab_commit");
