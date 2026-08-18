import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch, setApiToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export const AUTH_TOKEN_KEY = "aida.auth.accessToken";
const WEB_PREVIEW_DEFAULT = process.env.EXPO_PUBLIC_AIDA_WEB_PREVIEW === "true";

export type SocialProvider = "yandex" | "vk";

type Account = {
  id: string;
  email: string;
  phone?: string | null;
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

export type RegistrationResult = {
  verification_required: boolean;
  email: string;
};

type AuthContextValue = {
  account: Account | null;
  token: string | null;
  preview: boolean;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string | null) => Promise<RegistrationResult>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (identifier: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  startSocialLogin: (provider: SocialProvider, returnUri: string) => Promise<string>;
  completeSocialLogin: (ticket: string) => Promise<void>;
  restore: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorDetail(body: any): string | null {
  const detail = body?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item?.msg || item?.message).filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    if (messages.length) return messages.join("; ");
  }
  const safeMessage = body?.safe_user_message || body?.message;
  return typeof safeMessage === "string" && safeMessage.trim() ? safeMessage.trim() : null;
}

async function readJson(res: Response) {
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
  if (!res.ok) {
    const detail = errorDetail(body);
    const requestId = body?.request_id ? ` [request ${String(body.request_id)}]` : "";
    throw new Error(detail ? `${detail}${requestId}` : `Request failed (${res.status})${requestId}`);
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
  const [preview, setPreview] = useState(WEB_PREVIEW_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback(async (session: SessionPayload) => {
    setPreview(false);
    setApiToken(session.access_token);
    setToken(session.access_token);
    setAccount(session.account);
    await storage.secureSet(AUTH_TOKEN_KEY, session.access_token);
  }, []);

  const clearSession = useCallback(async () => {
    setApiToken(null);
    setToken(null);
    setAccount(null);
    setPreview(WEB_PREVIEW_DEFAULT);
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
      setPreview(false);
      setToken(stored);
      setAccount(body.account || null);
    } catch (_) {
      await clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => { restore(); }, [restore]);

  const login = useCallback(async (identifier: string, password: string) => {
    setError(null);
    try {
      const session = await authRequest("/auth/login", { identifier: identifier.trim(), password });
      await applySession(session);
    } catch (e: any) {
      setError(e?.message || "Login failed");
      throw e;
    }
  }, [applySession]);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string | null): Promise<RegistrationResult> => {
    setError(null);
    try {
      const result = await authRequest("/auth/register", { name: name.trim(), email: email.trim(), password, phone: phone?.trim() || null });
      if (!result?.verification_required || !result?.email) throw new Error("Email verification was not requested");
      return result as RegistrationResult;
    } catch (e: any) {
      setError(e?.message || "Registration failed");
      throw e;
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    try { await authRequest("/auth/resend-verification", { email: email.trim() }); }
    catch (e: any) { setError(e?.message || "Verification email resend failed"); throw e; }
  }, []);

  const logout = useCallback(async () => {
    try { if (token) await authRequest("/auth/logout", undefined, "POST"); }
    catch (_) { /* local logout must still work */ }
    finally { await clearSession(); }
  }, [clearSession, token]);

  const forgotPassword = useCallback(async (identifier: string) => {
    setError(null);
    try { await authRequest("/auth/forgot-password", { identifier: identifier.trim() }); }
    catch (e: any) { setError(e?.message || "Recovery request failed"); throw e; }
  }, []);

  const resetPassword = useCallback(async (resetToken: string, newPassword: string) => {
    setError(null);
    try {
      const session = await authRequest("/auth/reset-password", { token: resetToken, new_password: newPassword });
      await applySession(session);
    } catch (e: any) {
      setError(e?.message || "Password reset failed");
      throw e;
    }
  }, [applySession]);

  const startSocialLogin = useCallback(async (provider: SocialProvider, returnUri: string) => {
    setError(null);
    try {
      const result = await authRequest(`/auth/oauth/${provider}/start`, { return_uri: returnUri });
      if (!result?.authorization_url) throw new Error("Social login URL was not returned");
      return String(result.authorization_url);
    } catch (e: any) { setError(e?.message || "Social login failed"); throw e; }
  }, []);

  const completeSocialLogin = useCallback(async (ticket: string) => {
    setError(null);
    try {
      const session = await authRequest("/auth/oauth/complete", { ticket });
      await applySession(session);
    } catch (e: any) { setError(e?.message || "Social login failed"); throw e; }
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => ({
    account, token, preview, loading, error, login, register, resendVerification, logout, forgotPassword,
    resetPassword, startSocialLogin, completeSocialLogin, restore,
  }), [account, token, preview, loading, error, login, register, resendVerification, logout, forgotPassword, resetPassword, startSocialLogin, completeSocialLogin, restore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
