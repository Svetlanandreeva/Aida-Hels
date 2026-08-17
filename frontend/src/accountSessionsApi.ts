import { apiFetch } from "@/src/api";

export type AccountSession = {
  id: string;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  active: boolean;
  is_current: boolean;
};

async function readJson(res: Response) {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = null;
  }
  if (!res.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
  return body;
}

export const accountSessionsApi = {
  list: async (): Promise<AccountSession[]> => {
    const res = await apiFetch("/account/sessions", { method: "GET" });
    const body = await readJson(res);
    return Array.isArray(body?.sessions) ? body.sessions : [];
  },

  revoke: async (sessionId: string): Promise<{ ok: boolean; current_session_revoked?: boolean }> => {
    const res = await apiFetch(`/account/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    return readJson(res);
  },

  revokeOthers: async (): Promise<{ ok: boolean; revoked_count: number }> => {
    const res = await apiFetch("/account/sessions/revoke-others", { method: "POST" });
    return readJson(res);
  },
};
