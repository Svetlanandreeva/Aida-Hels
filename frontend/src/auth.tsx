import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch, setApiToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export const AUTH_TOKEN_KEY = "aida.auth.accessToken";

type Account = {
  id: string;
  email: string;
  name?: string | null;
  created_at?: string | null;
};

type SessionPayload = {
  access_token: string;
  token_type: string;
  expires_at: string;
  account: Account;
  profile_id?: string | null;
};

type AuthContextValue = {
  account: Account | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  restore: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

async function authRequest(path: string, body?: any, method = "POST") {
  const res = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return readJson(res);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback(async (session: SessionPayload) => {
    setApiToken(session.access_token);
    setToken(session.access_token);
    setAccount(session.account);
    await storage.secureSet(AUTH_TOKEN_KEY, session.access_token);
  }, []);

  const clearSession = useCallback(async () => {
    setApiToken(null);
    setToken(null);
    setAccount(null);
    await storage.secureRemove(AUTH_TOKEN_KEY);
  }, []);

  const restore = useCallback(async () => {
    setLoading(true);
    setError(null);
    const stored = await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
    if (!stored) {
      await clearSession();
      setLoading(false);
      return;
    }

    setApiToken(stored);
    try {
      const res = await apiFetch("/auth/me", { method: "GET" });
      const body = await readJson(res);
      setToken(stored);
      setAccount(body.account || null);
    } catch (_) {
      await clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    restore();
  }, [restore]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const session = await authRequest("/auth/login", { email: email.trim(), password });
      await applySession(session);
    } catch (e: any) {
      const message = e?.message || "Login failed";
      setError(message);
      throw e;
    }
  }, [applySession]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const session = await authRequest("/auth/register", { name: name.trim(), email: email.trim(), password });
      await applySession(session);
    } catch (e: any) {
      const message = e?.message || "Registration failed";
      setError(message);
      throw e;
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      if (token) await authRequest("/auth/logout", undefined, "POST");
    } catch (_) {
      // Local logout must still complete when the network is unavailable.
    } finally {
      await clearSession();
    }
  }, [clearSession, token]);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await authRequest("/auth/forgot-password", { email: email.trim() });
    } catch (e: any) {
      const message = e?.message || "Recovery request failed";
      setError(message);
      throw e;
    }
  }, []);

  const resetPassword = useCallback(async (resetToken: string, newPassword: string) => {
    setError(null);
    try {
      const session = await authRequest("/auth/reset-password", {
        token: resetToken,
        new_password: newPassword,
      });
      await applySession(session);
    } catch (e: any) {
      const message = e?.message || "Password reset failed";
      setError(message);
      throw e;
    }
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => ({
    account,
    token,
    loading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    restore,
  }), [account, token, loading, error, login, register, logout, forgotPassword, resetPassword, restore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
