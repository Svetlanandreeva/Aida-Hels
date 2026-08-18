import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SocialProvider, useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type Mode = "login" | "forgot";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useI18n();
  const { login, forgotPassword, startSocialLogin, completeSocialLogin } = useAuth();
  const ru = lang === "ru";

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
    if (params.get("verified") === "1") {
      setMessage(ru ? "Email подтверждён. Теперь можно войти." : "Email verified. You can sign in now.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("verify_error") === "1") {
      setError(ru ? "Ссылка подтверждения недействительна или истекла." : "The verification link is invalid or expired.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (!ticket) return;
    let active = true;
    setBusy(true);
    completeSocialLogin(ticket)
      .then(() => {
        if (!active) return;
        window.history.replaceState({}, "", window.location.pathname);
        router.replace("/");
      })
      .catch(() => active && setError(ru ? "Не удалось войти через внешний аккаунт." : "Social sign-in failed."))
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
        await login(value, password);
        router.replace("/");
      } else {
        await forgotPassword(value);
        setMessage(
          ru
            ? "Если аккаунт существует, ссылка для восстановления отправлена на привязанный email."
            : "If the account exists, a recovery link was sent to its linked email."
        );
      }
    } catch (e: any) {
      const raw = String(e?.message || "").toLowerCase();
      setError(
        raw.includes("invalid email/phone") || raw.includes("401")
          ? (ru ? "Неверный email/телефон или пароль." : "Invalid email/phone or password.")
          : (ru ? "Не удалось выполнить запрос. Попробуйте ещё раз." : "Could not complete the request. Try again.")
      );
    } finally {
      setBusy(false);
    }
  };

  const socialLogin = async (provider: SocialProvider) => {
    setError(null);
    setSocialBusy(provider);
    try {
      const returnUri = Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}/auth`
        : "https://aidaassistent.ru/auth";
      const authorizationUrl = await startSocialLogin(provider, returnUri);
      if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(authorizationUrl);
      else await Linking.openURL(authorizationUrl);
    } catch (_) {
      setError(ru ? "Не удалось начать вход." : "Could not start sign-in.");
      setSocialBusy(null);
    }
  };

  const submitLabel = mode === "login" ? (ru ? "Войти" : "Sign in") : (ru ? "Отправить ссылку" : "Send reset link");
  const identifierLabel = ru ? "Email или телефон" : "Email or phone";
  const passwordLabel = ru ? "Пароль" : "Password";

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 42, paddingBottom: insets.bottom + 34 }]}
      >
        <View style={styles.brandIcon}><Ionicons name="sparkles" size={20} color={colors.onSurfaceInverse} /></View>
        <Text style={styles.eyebrow}>AIDA</Text>
        <Text style={styles.title}>{mode === "login" ? (ru ? "С возвращением" : "Welcome back") : (ru ? "Восстановление пароля" : "Reset password")}</Text>
        <Text style={styles.subtitle}>
          {mode === "login"
            ? (ru ? "Войдите по email или номеру телефона." : "Sign in with your email or phone number.")
            : (ru ? "Укажите email или телефон. Ссылку мы отправим на email, привязанный к аккаунту." : "Enter your email or phone. We will send the link to the email connected to the account.")}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <View style={styles.labelRow}><Ionicons name="person-circle-outline" size={16} color={colors.onSurfaceSecondary} /><Text style={styles.label}>{identifierLabel}</Text></View>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              style={styles.input}
              placeholder={ru ? "name@example.com или +7 999 000-00-00" : "name@example.com or +1 555 000 0000"}
              placeholderTextColor={colors.onSurfaceSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              accessibilityLabel={identifierLabel}
              returnKeyType={mode === "forgot" ? "go" : "next"}
              onSubmitEditing={mode === "forgot" ? submit : undefined}
              testID="auth-identifier"
            />
          </View>

          {mode === "login" ? (
            <View style={styles.field}>
              <View style={styles.labelRow}><Ionicons name="lock-closed-outline" size={16} color={colors.onSurfaceSecondary} /><Text style={styles.label}>{passwordLabel}</Text></View>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  accessibilityLabel={passwordLabel}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  testID="auth-password"
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? (ru ? "Скрыть пароль" : "Hide password") : (ru ? "Показать пароль" : "Show password")}
                  accessibilityState={{ selected: showPassword }}
                >
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.onSurfaceSecondary} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {error ? <Notice kind="error" text={error} /> : null}
          {message ? <Notice kind="success" text={message} /> : null}

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={submit}
            disabled={busy || socialBusy !== null}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: busy || socialBusy !== null, busy }}
            testID="auth-submit"
          >
            {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <><Text style={styles.primaryText}>{submitLabel}</Text><Ionicons name="arrow-forward" size={18} color={colors.onSurfaceInverse} /></>}
          </Pressable>

          {mode === "login" ? (
            <>
              <Pressable
                onPress={() => { setMode("forgot"); setError(null); setMessage(null); }}
                style={styles.textButton}
                accessibilityRole="button"
                accessibilityLabel={ru ? "Забыли пароль?" : "Forgot password?"}
              >
                <Text style={styles.textButtonText}>{ru ? "Забыли пароль?" : "Forgot password?"}</Text>
              </Pressable>
              <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>{ru ? "или" : "or"}</Text><View style={styles.divider} /></View>
              <SocialButton label={ru ? "Продолжить с Яндекс ID" : "Continue with Yandex ID"} busy={socialBusy === "yandex"} onPress={() => socialLogin("yandex")} />
              <SocialButton label={ru ? "Продолжить с VK ID" : "Continue with VK ID"} busy={socialBusy === "vk"} onPress={() => socialLogin("vk")} />
              <Pressable
                onPress={() => router.push("/register")}
                style={styles.registerButton}
                accessibilityRole="link"
                accessibilityLabel={ru ? "Нет аккаунта? Создать" : "No account? Create one"}
                testID="auth-register-link"
              >
                <Text style={styles.registerText}>{ru ? "Нет аккаунта? Создать" : "No account? Create one"}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => { setMode("login"); setError(null); setMessage(null); }}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={ru ? "Вернуться ко входу" : "Back to sign in"}
            >
              <Ionicons name="arrow-back" size={16} color={colors.onSurface} /><Text style={styles.textButtonText}>{ru ? "Вернуться ко входу" : "Back to sign in"}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SocialButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={styles.socialButton}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
    >
      {busy ? <ActivityIndicator color={colors.onSurface} /> : <><Ionicons name="log-in-outline" size={18} color={colors.onSurface} /><Text style={styles.socialText}>{label}</Text></>}
    </Pressable>
  );
}

function Notice({ kind, text }: { kind: "error" | "success"; text: string }) {
  return (
    <View
      style={[styles.notice, kind === "error" ? styles.noticeError : styles.noticeSuccess]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={kind === "error" ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={kind === "error" ? colors.error : colors.success} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: spacing.xl },
  brandIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  eyebrow: { marginTop: spacing.lg, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: spacing.sm, color: colors.onSurface, fontFamily: fonts.display, fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1.1 },
  subtitle: { marginTop: spacing.md, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.base, lineHeight: 23 },
  form: { marginTop: spacing.xl, gap: spacing.lg },
  field: { gap: spacing.sm },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "700" },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.onSurface, paddingHorizontal: spacing.lg, fontFamily: fonts.text, fontSize: fontSize.base },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 52 },
  eyeButton: { position: "absolute", right: 8, top: 6, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  primary: { minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.onSurface, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  primaryText: { color: colors.onSurfaceInverse, fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  textButton: { minHeight: 44, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  textButtonText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.sm },
  socialButton: { minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  socialText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700" },
  registerButton: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  registerText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "800" },
  notice: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  noticeError: { borderColor: colors.error, backgroundColor: colors.surfaceSecondary },
  noticeSuccess: { borderColor: colors.success, backgroundColor: colors.surfaceSecondary },
  noticeText: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, lineHeight: 19 },
});
