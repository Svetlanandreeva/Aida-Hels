import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { withTimeout } from "@/src/async";
import { SocialProvider, useAuth } from "@/src/auth";
import { useApp } from "@/src/emergent/AppContext";
import { font, fontSize, radius, spacing, CONTENT_MAX, FORM_MAX } from "@/src/emergent/tokens";
import { LangToggle, ThemeToggle, Txt } from "@/src/emergent/ui";

type Mode = "login" | "forgot";

function socialCallbackError(code: string, provider: string | null, ru: boolean) {
  const label = provider === "vk" ? "VK ID" : provider === "yandex" ? "Яндекс ID" : (ru ? "внешний аккаунт" : "social account");
  if (code === "account_exists") return ru ? "Аккаунт Aida с этой почтой уже существует. Войдите по email и паролю." : "An Aida account with this email already exists. Sign in with email and password.";
  if (code === "provider_rejected") return ru ? `${label} не завершил авторизацию. Попробуйте ещё раз.` : `${label} did not complete authorization. Try again.`;
  if (code === "provider_exchange_failed") return ru ? `Не удалось подтвердить вход через ${label}. Попробуйте ещё раз.` : `Could not verify the ${label} sign-in. Try again.`;
  if (code === "temporary_unavailable") return ru ? "Вход через внешний аккаунт временно недоступен. Попробуйте ещё раз." : "Social sign-in is temporarily unavailable. Try again.";
  return ru ? "Не удалось завершить вход через внешний аккаунт." : "Could not finish social sign-in.";
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, theme, lang, t } = useApp();
  const { login, forgotPassword, startSocialLogin, completeSocialLogin } = useAuth();
  const ru = lang === "ru";
  const a = t.auth;

  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("oauth_ticket");
    const oauthError = params.get("oauth_error");
    const oauthProvider = params.get("oauth_provider");
    if (params.get("verified") === "1") {
      setMessage(ru ? "Email подтверждён. Теперь можно войти." : "Email verified. You can sign in now.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("verify_error") === "1") {
      setError(ru ? "Ссылка подтверждения недействительна или истекла." : "The verification link is invalid or expired.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (oauthError) {
      setError(socialCallbackError(oauthError, oauthProvider, ru));
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!ticket) return;
    let active = true;
    setBusy(true);
    withTimeout(completeSocialLogin(ticket), 20000, "social_callback")
      .then(() => {
        if (!active) return;
        window.history.replaceState({}, "", window.location.pathname);
        router.replace("/");
      })
      .catch(() => active && setError(ru ? "Не удалось завершить вход через внешний аккаунт." : "Could not finish social sign-in."))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [completeSocialLogin, router, ru]);

  const submit = async () => {
    const value = identifier.trim();
    setError(null);
    setMessage(null);
    if (value.length < 3) {
      setError(ru ? "Введите email или номер телефона." : "Enter your email or phone number.");
      return;
    }
    if (mode === "login" && !password) {
      setError(ru ? "Введите пароль." : "Enter your password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await withTimeout(login(value, password), 8000, "login");
        router.replace("/");
      } else {
        await withTimeout(forgotPassword(value), 8000, "password_recovery");
        setMessage(ru ? "Если аккаунт существует, ссылка для восстановления отправлена на привязанный email." : "If the account exists, a recovery link was sent to the email connected to the account.");
      }
    } catch (cause: any) {
      const raw = String(cause?.message || "").toLowerCase();
      setError(raw.includes("invalid email/phone") || raw.includes("401")
        ? (ru ? "Неверный email/телефон или пароль." : "Invalid email/phone or password.")
        : raw.includes("timeout")
          ? (ru ? "Сервис отвечает слишком долго. Попробуйте ещё раз." : "The service is taking too long. Try again.")
          : (ru ? "Не удалось выполнить запрос. Попробуйте ещё раз." : "Could not complete the request. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const socialLogin = async (provider: SocialProvider) => {
    setError(null);
    setSocialBusy(provider);
    try {
      const returnUri = Platform.OS === "web" && typeof window !== "undefined" ? `${window.location.origin}/auth` : "https://aidaassistent.ru/auth";
      const authorizationUrl = await withTimeout(startSocialLogin(provider, returnUri), 6500, `social_${provider}`);
      if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(authorizationUrl);
      else await Linking.openURL(authorizationUrl);
    } catch (cause: any) {
      const slow = String(cause?.message || "").includes("timeout");
      setError(slow ? (ru ? "Сервис входа отвечает слишком долго. Попробуйте ещё раз." : "Sign-in provider is taking too long. Try again.") : (ru ? "Не удалось начать вход." : "Could not start sign-in."));
      setSocialBusy(null);
    }
  };

  const switchToForgot = () => { void Haptics.selectionAsync(); setMode("forgot"); setError(null); setMessage(null); };
  const returnToLogin = () => { void Haptics.selectionAsync(); setMode("login"); setError(null); setMessage(null); };
  const unavailable = busy || socialBusy !== null;
  const submitLabel = mode === "login" ? a.loginCta : (ru ? "Отправить ссылку" : "Send reset link");
  const identifierLabel = ru ? "Email или телефон" : "Email or phone";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerInner}>
          <Pressable testID="auth-back-button" onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
          <View style={styles.headerControls}><LangToggle /><ThemeToggle /></View>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"], alignItems: "center" }} keyboardShouldPersistTaps="handled">
        <View style={styles.formWrap}>
          <View style={styles.brandRow}><View style={[styles.logoDot, { backgroundColor: colors.brand }]}><Ionicons name="pulse" size={18} color={colors.onBrandPrimary} /></View><Txt variant="h2" weight="extrabold">{t.brand}</Txt></View>

          <View style={[styles.segment, { backgroundColor: colors.surfaceTertiary }]}>
            <Pressable testID="auth-tab-login" onPress={returnToLogin} style={[styles.segmentBtn, { backgroundColor: colors.surfaceSecondary }]}><Txt variant="label" weight="bold">{a.loginTab}</Txt></Pressable>
            <Pressable testID="auth-tab-register" onPress={() => router.push("/register")} style={styles.segmentBtn}><Txt variant="label" weight="bold" color={colors.muted}>{a.registerTab}</Txt></Pressable>
          </View>

          <Animated.View key={mode} entering={FadeIn.duration(250)}>
            <Txt variant="h1" style={{ marginTop: spacing.xl }}>{mode === "login" ? a.loginTitle : (ru ? "Восстановление пароля" : "Reset password")}</Txt>
            <Txt variant="body" color={colors.muted} style={{ marginTop: 6 }}>{mode === "login" ? (ru ? "Войдите по email или номеру телефона." : "Sign in with your email or phone number.") : (ru ? "Укажите email или телефон. Ссылку мы отправим на email, привязанный к аккаунту." : "Enter your email or phone. We will send the link to the email connected to the account.")}</Txt>

            <View style={styles.fields}>
              <View>
                <Txt variant="label" weight="semibold" color={colors.muted} style={styles.fieldLabel}>{identifierLabel}</Txt>
                <TextInput value={identifier} onChangeText={setIdentifier} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} placeholder={ru ? "name@example.com или +7 999 000-00-00" : "name@example.com or +1 555 000 0000"} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" accessibilityLabel={identifierLabel} returnKeyType={mode === "forgot" ? "go" : "next"} onSubmitEditing={mode === "forgot" ? submit : undefined} testID="auth-identifier" />
              </View>

              {mode === "login" ? <>
                <View>
                  <Txt variant="label" weight="semibold" color={colors.muted} style={styles.fieldLabel}>{a.password}</Txt>
                  <View style={styles.passwordWrap}>
                    <TextInput value={password} onChangeText={setPassword} style={[styles.input, styles.passwordInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} placeholder={a.passwordPlaceholder} placeholderTextColor={colors.muted} secureTextEntry={!showPassword} textContentType="password" autoComplete="current-password" returnKeyType="go" onSubmitEditing={submit} testID="auth-password" />
                    <Pressable testID="auth-toggle-password" onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showPassword ? (ru ? "Скрыть пароль" : "Hide password") : (ru ? "Показать пароль" : "Show password")}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} /></Pressable>
                  </View>
                </View>
                <Pressable onPress={switchToForgot} style={styles.forgotButton} testID="auth-forgot-link"><Txt variant="label" weight="bold" color={colors.brand}>{a.forgot}</Txt></Pressable>
              </> : null}
            </View>

            {error ? <Notice kind="error" text={error} /> : null}
            {message ? <Notice kind="success" text={message} /> : null}

            <Pressable testID="auth-submit" onPress={submit} disabled={unavailable} style={[styles.primary, { backgroundColor: colors.brandPrimary }, unavailable && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: unavailable, busy }}>
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Txt variant="body" weight="bold" color={colors.onBrandPrimary}>{submitLabel}</Txt><Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} /></>}
            </Pressable>

            {mode === "login" ? <>
              <View style={styles.dividerRow}><View style={[styles.divider, { backgroundColor: colors.border }]} /><Txt variant="label" weight="semibold" color={colors.muted}>{a.or}</Txt><View style={[styles.divider, { backgroundColor: colors.border }]} /></View>
              <View style={{ gap: spacing.md }}>
                <SocialButton provider="yandex" label={a.yandex} busy={socialBusy === "yandex"} disabled={unavailable && socialBusy !== "yandex"} onPress={() => socialLogin("yandex")} />
                <SocialButton provider="vk" label={a.vk} busy={socialBusy === "vk"} disabled={unavailable && socialBusy !== "vk"} onPress={() => socialLogin("vk")} />
              </View>
              <View style={styles.switchRow}><Txt variant="caption" color={colors.muted}>{a.switchToRegisterQ}</Txt><Pressable testID="auth-register-link" onPress={() => router.push("/register")} hitSlop={6} style={{ marginLeft: 6 }}><Txt variant="caption" weight="bold" color={colors.brand}>{a.switchToRegister}</Txt></Pressable></View>
              <View style={styles.legalBlock}>
                <Txt variant="label" color={colors.muted} weight="medium" center>{ru ? "Продолжая, вы соглашаетесь с" : "By continuing, you agree to the"}</Txt>
                <View style={styles.legalLinks}><Pressable onPress={() => router.push("/terms")}><Txt variant="label" weight="bold" color={colors.brand}>{ru ? "Условиями использования" : "Terms of Use"}</Txt></Pressable><Txt variant="label" color={colors.muted}>{ru ? "и" : "and"}</Txt><Pressable onPress={() => router.push("/privacy-policy")}><Txt variant="label" weight="bold" color={colors.brand}>{ru ? "Политикой конфиденциальности" : "Privacy Policy"}</Txt></Pressable></View>
              </View>
            </> : <Pressable onPress={returnToLogin} style={styles.backToLogin}><Ionicons name="arrow-back" size={16} color={colors.brand} /><Txt variant="caption" weight="bold" color={colors.brand}>{ru ? "Вернуться ко входу" : "Back to sign in"}</Txt></Pressable>}
          </Animated.View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function SocialButton({ provider, label, busy, disabled, onPress }: { provider: SocialProvider; label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useApp();
  return <Pressable testID={`auth-${provider}-button`} onPress={onPress} disabled={busy || disabled} style={[styles.social, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, disabled && styles.disabled]} accessibilityRole="button">{busy ? <ActivityIndicator color={colors.onSurface} /> : <><View style={[styles.socialBadge, { backgroundColor: provider === "yandex" ? "#FC3F1D" : "#0077FF" }]}><Txt variant="label" weight="extrabold" color="#FFFFFF" style={{ fontSize: provider === "yandex" ? 16 : 12 }}>{provider === "yandex" ? "Я" : "VK"}</Txt></View><Txt variant="body" weight="bold" style={{ marginLeft: spacing.md }}>{label}</Txt></>}</Pressable>;
}

function Notice({ kind, text }: { kind: "error" | "success"; text: string }) {
  const { colors } = useApp();
  const accent = kind === "error" ? colors.error : colors.success;
  return <View style={[styles.notice, { borderColor: accent, backgroundColor: colors.surfaceSecondary }]} accessibilityRole="alert" accessibilityLiveRegion="polite"><Ionicons name={kind === "error" ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={accent} /><Txt variant="label" style={{ flex: 1 }}>{text}</Txt></View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  headerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },
  headerControls: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  formWrap: { width: "100%", maxWidth: FORM_MAX },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  logoDot: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.pill },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  fields: { marginTop: spacing.xl, gap: spacing.md },
  fieldLabel: { marginBottom: 8 },
  input: { height: 54, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, fontFamily: font.medium },
  passwordWrap: { justifyContent: "center" },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: "absolute", right: spacing.lg, height: 54, justifyContent: "center" },
  forgotButton: { alignSelf: "flex-end", paddingVertical: spacing.sm },
  primary: { minHeight: 54, marginTop: spacing.lg, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  disabled: { opacity: 0.55 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xl },
  divider: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  social: { minHeight: 54, flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  socialBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  legalBlock: { marginTop: spacing.lg, alignItems: "center", gap: 6 },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6 },
  backToLogin: { minHeight: 48, marginTop: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  notice: { marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
