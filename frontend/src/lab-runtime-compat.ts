import { api, LabTest } from "@/src/api";
import { withTimeout } from "@/src/async";

const LAB_LIST_TIMEOUT_MS = 7000;
const LAB_SAVE_TIMEOUT_MS = 15000;

const originalListLabs = api.listLabs;
const originalUpdateLabImport = api.updateLabImport;
const originalCommitLabImport = api.commitLabImport;

api.listLabs = (pid: string): Promise<LabTest[]> =>
  withTimeout(originalListLabs(pid), LAB_LIST_TIMEOUT_MS, "labs_list");

api.updateLabImport = (importId, preview) =>
  withTimeout(originalUpdateLabImport(importId, preview), LAB_SAVE_TIMEOUT_MS, "lab_review_save");

api.commitLabImport = (importId) =>
  withTimeout(originalCommitLabImport(importId), LAB_SAVE_TIMEOUT_MS, "lab_commit");
