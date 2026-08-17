import React, { useEffect, useMemo, useState } from "react";
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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SocialProvider, useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type Mode = "login" | "register" | "forgot";
type FieldErrors = Partial<Record<"name" | "email" | "password" | "consent", string>>;

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useI18n();
  const { login, register, forgotPassword, preview, startSocialLogin, completeSocialLogin } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fieldFocused, setFieldFocused] = useState(false);

  const ru = lang === "ru";
  const passwordLongEnough = password.length >= 8;
  const cleanEmail = email.trim().toLowerCase();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("oauth_ticket");
    if (!ticket) return;

    let active = true;
    setBusy(true);
    setError(null);
    completeSocialLogin(ticket)
      .then(() => {
        if (!active) return;
        window.history.replaceState({}, "", window.location.pathname);
        router.replace("/");
      })
      .catch((e: any) => {
        if (!active) return;
        setError(friendlyError(String(e?.message || ""), ru));
        window.history.replaceState({}, "", window.location.pathname);
      })
      .finally(() => active && setBusy(false));

    return () => {
      active = false;
    };
  }, [completeSocialLogin, router, ru]);

  const validate = () => {
    const next: FieldErrors = {};
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      next.email = ru ? "Введите корректный email" : "Enter a valid email";
    }
    if (mode === "register" && !name.trim()) {
      next.name = ru ? "Введите имя" : "Enter your name";
    }
    if (mode !== "forgot" && password.length < (mode === "register" ? 8 : 1)) {
      next.password = ru
        ? (mode === "register" ? "Нужно минимум 8 символов" : "Введите пароль")
        : (mode === "register" ? "Use at least 8 characters" : "Enter your password");
    }
    if (mode === "register" && !consent) {
      next.consent = ru ? "Подтвердите согласие с условиями" : "Please accept the terms";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (mode === "login") {
        await login(cleanEmail, password);
      } else if (mode === "register") {
        await register(name.trim(), cleanEmail, password);
      } else {
        await forgotPassword(cleanEmail);
        setMessage(
          ru
            ? "Если аккаунт с таким email существует, мы отправили ссылку для восстановления."
            : "If an account with this email exists, a recovery link has been sent."
        );
      }
    } catch (e: any) {
      setError(friendlyError(String(e?.message || ""), ru));
    } finally {
      setBusy(false);
    }
  };

  const socialLogin = async (provider: SocialProvider) => {
    setError(null);
    setMessage(null);
    setSocialBusy(provider);
    try {
      const returnUri = Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}/auth`
        : "https://aidaassistent.ru/auth";
      const authorizationUrl = await startSocialLogin(provider, returnUri);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.assign(authorizationUrl);
      } else {
        await Linking.openURL(authorizationUrl);
      }
    } catch (e: any) {
      setError(friendlyError(String(e?.message || ""), ru));
      setSocialBusy(null);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setFieldErrors({});
    setPassword("");
    setShowPassword(false);
  };

  const headerCompact = fieldFocused;
  const contentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingTop: insets.top + (headerCompact ? 22 : 48),
        paddingBottom: insets.bottom + 32,
      },
    ],
    [headerCompact, insets.bottom, insets.top]
  );

  const inputFocus = () => setFieldFocused(true);
  const inputBlur = () => setFieldFocused(false);

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle}>
        {Platform.OS === "web" ? (
          <Image
            source={{ uri: "/aida-logo.svg" }}
            style={[styles.brandLogo, headerCompact && styles.brandLogoCompact]}
            contentFit="contain"
            contentPosition="left center"
            accessibilityLabel="Aida — ваше здоровье, единая система"
          />
        ) : (
          <>
            <View style={[styles.brandMark, headerCompact && styles.brandMarkCompact]}>
              <Ionicons name="sparkles" size={headerCompact ? 19 : 24} color={colors.onSurfaceInverse} />
            </View>
            <Text style={styles.brand}>AIDA</Text>
          </>
        )}

        <Text style={[styles.heroTitle, headerCompact && styles.heroTitleCompact]}>
          {mode === "login"
            ? (ru ? "С возвращением" : "Welcome back")
            : mode === "register"
              ? (ru ? "Создайте аккаунт" : "Create your account")
              : (ru ? "Восстановление пароля" : "Reset your password")}
        </Text>
        <Text style={styles.heroText}>
          {mode === "forgot"
            ? (ru ? "Введите email — мы отправим одноразовую ссылку для смены пароля." : "Enter your email and we'll send a one-time reset link.")
            : (ru ? "Ваши медицинские данные будут храниться отдельно от данных других аккаунтов." : "Your health data stays separated from other accounts.")}
        </Text>

        {mode !== "forgot" && (
          <View style={styles.modeTabs}>
            <Pressable onPress={() => switchMode("login")} style={[styles.modeTab, mode === "login" && styles.modeTabActive]} testID="auth-mode-login">
              <Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>{ru ? "Войти" : "Sign in"}</Text>
            </Pressable>
            <Pressable onPress={() => switchMode("register")} style={[styles.modeTab, mode === "register" && styles.modeTabActive]} testID="auth-mode-register">
              <Text style={[styles.modeText, mode === "register" && styles.modeTextActive]}>{ru ? "Регистрация" : "Register"}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.form}>
          {mode === "register" && (
            <Field label={ru ? "Имя" : "Name"} icon="person-outline" error={fieldErrors.name}>
              <TextInput
                value={name}
                onChangeText={(value) => { setName(value); setFieldErrors((prev) => ({ ...prev, name: undefined })); }}
                style={[styles.input, fieldErrors.name && styles.inputError]}
                placeholder={ru ? "Как к вам обращаться" : "Your name"}
                placeholderTextColor={colors.onSurfaceSecondary}
                autoCapitalize="words"
                onFocus={inputFocus}
                onBlur={inputBlur}
                testID="auth-name"
              />
            </Field>
          )}

          <Field label="Email" icon="mail-outline" error={fieldErrors.email}>
            <TextInput
              value={email}
              onChangeText={(value) => { setEmail(value); setFieldErrors((prev) => ({ ...prev, email: undefined })); }}
              style={[styles.input, fieldErrors.email && styles.inputError]}
              placeholder="name@example.com"
              placeholderTextColor={colors.onSurfaceSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              onFocus={inputFocus}
              onBlur={inputBlur}
              testID="auth-email"
            />
          </Field>

          {mode !== "forgot" && (
            <Field label={ru ? "Пароль" : "Password"} icon="lock-closed-outline" error={fieldErrors.password}>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={(value) => { setPassword(value); setFieldErrors((prev) => ({ ...prev, password: undefined })); }}
                  style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]}
                  placeholder={mode === "register" ? (ru ? "Минимум 8 символов" : "At least 8 characters") : "••••••••"}
                  placeholderTextColor={colors.onSurfaceSecondary}
                  secureTextEntry={!showPassword}
                  textContentType={mode === "register" ? "newPassword" : "password"}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                  testID="auth-password"
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? (ru ? "Скрыть пароль" : "Hide password") : (ru ? "Показать пароль" : "Show password")}
                  testID="auth-password-visibility"
                >
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.onSurfaceSecondary} />
                </Pressable>
              </View>
              {mode === "register" && password.length > 0 ? (
                <View style={styles.requirementRow}>
                  <Ionicons name={passwordLongEnough ? "checkmark-circle" : "ellipse-outline"} size={15} color={passwordLongEnough ? colors.success : colors.onSurfaceSecondary} />
                  <Text style={[styles.requirementText, passwordLongEnough && styles.requirementTextReady]}>{ru ? "8 или больше символов" : "8 or more characters"}</Text>
                </View>
              ) : null}
            </Field>
          )}

          {mode === "register" ? (
            <View style={styles.consentBlock}>
              <Pressable
                onPress={() => { setConsent((value) => !value); setFieldErrors((prev) => ({ ...prev, consent: undefined })); }}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                testID="auth-consent"
              >
                <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
                  {consent ? <Ionicons name="checkmark" size={14} color={colors.onSurfaceInverse} /> : null}
                </View>
                <Text style={styles.consentText}>{ru ? "Я принимаю " : "I accept "}</Text>
              </Pressable>
              <View style={styles.legalLinks}>
                <Pressable onPress={() => router.push("/terms" as any)}><Text style={styles.legalLink}>{ru ? "Условия использования" : "Terms of Use"}</Text></Pressable>
                <Text style={styles.consentText}>{ru ? " и " : " and "}</Text>
                <Pressable onPress={() => router.push("/privacy" as any)}><Text style={styles.legalLink}>{ru ? "Политику конфиденциальности" : "Privacy Policy"}</Text></Pressable>
              </View>
              {fieldErrors.consent ? <Text style={styles.fieldError}>{fieldErrors.consent}</Text> : null}
            </View>
          ) : null}

          {error ? (
            <View style={styles.noticeError}><Ionicons name="alert-circle-outline" size={17} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View>
          ) : null}
          {message ? (
            <View style={styles.noticeSuccess}><Ionicons name="checkmark-circle-outline" size={17} color={colors.success} /><Text style={styles.successText}>{message}</Text></View>
          ) : null}

          <Pressable style={[styles.submit, busy && styles.submitDisabled]} onPress={submit} disabled={busy || socialBusy !== null} testID="auth-submit">
            {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : (
              <>
                <Text style={styles.submitText}>
                  {mode === "login" ? (ru ? "Войти" : "Sign in") : mode === "register" ? (ru ? "Создать аккаунт" : "Create account") : (ru ? "Отправить ссылку" : "Send reset link")}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.onSurfaceInverse} />
              </>
            )}
          </Pressable>

          {mode !== "forgot" ? (
            <>
              <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>{ru ? "или" : "or"}</Text><View style={styles.dividerLine} /></View>
              <View style={styles.socialStack}>
                <SocialButton provider="vk" label={ru ? "Продолжить с VK ID" : "Continue with VK ID"} busy={socialBusy === "vk"} disabled={busy || socialBusy !== null} onPress={() => socialLogin("vk")} />
              </View>
            </>
          ) : null}

          {mode === "login" && (
            <>
              <Pressable onPress={() => switchMode("forgot")} style={styles.textButton} testID="auth-forgot">
                <Text style={styles.textButtonLabel}>{ru ? "Забыли пароль?" : "Forgot password?"}</Text>
              </Pressable>
              <Pressable onPress={() => switchMode("register")} style={styles.bottomSwitch} testID="auth-bottom-register">
                <Text style={styles.bottomSwitchMuted}>{ru ? "Нет аккаунта? " : "No account? "}</Text>
                <Text style={styles.bottomSwitchStrong}>{ru ? "Зарегистрироваться" : "Register"}</Text>
              </Pressable>
            </>
          )}
          {mode === "register" && (
            <Pressable onPress={() => switchMode("login")} style={styles.bottomSwitch} testID="auth-bottom-login">
              <Text style={styles.bottomSwitchMuted}>{ru ? "Уже есть аккаунт? " : "Already have an account? "}</Text>
              <Text style={styles.bottomSwitchStrong}>{ru ? "Войти" : "Sign in"}</Text>
            </Pressable>
          )}
          {mode === "forgot" && (
            <Pressable onPress={() => switchMode("login")} style={styles.textButton} testID="auth-back-login">
              <Ionicons name="arrow-back" size={16} color={colors.onSurface} />
              <Text style={styles.textButtonLabel}>{ru ? "Вернуться ко входу" : "Back to sign in"}</Text>
            </Pressable>
          )}

          {Platform.OS === "web" && preview && mode !== "forgot" ? (
            <Pressable
              onPress={() => router.replace("/")}
              style={styles.previewButton}
              testID="auth-preview-entry"
              accessibilityRole="button"
              accessibilityLabel={ru ? "Посмотреть приложение без входа" : "Preview the app without signing in"}
            >
              <Ionicons name="eye-outline" size={17} color={colors.onSurfaceSecondary} />
              <Text style={styles.previewButtonLabel}>{ru ? "Посмотреть приложение без входа" : "Preview app without signing in"}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onSurfaceSecondary} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyError(raw: string, ru: boolean) {
  if (raw.includes("Account already exists")) return ru ? "Аккаунт с таким email уже существует" : "An account with this email already exists";
  if (raw.includes("Invalid email or password")) return ru ? "Неверный email или пароль" : "Incorrect email or password";
  if (raw.includes("VK login is not configured")) return ru ? "Вход через VK ID ещё не подключён на сервере" : "VK ID is not configured on the server yet";
  if (raw.includes("Authentication is not configured") || raw.includes("Request failed (503)")) return ru ? "Сервис авторизации временно недоступен. Попробуйте чуть позже." : "Authentication is temporarily unavailable. Please try again shortly.";
  if (raw.includes("Failed to fetch") || raw.includes("Network request failed")) return ru ? "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз." : "Could not reach the server. Check your connection and try again.";
  return ru ? "Не удалось выполнить запрос. Попробуйте ещё раз." : "Could not complete the request. Please try again.";
}

function Field({ label, icon, error, children }: { label: string; icon: any; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={styles.fieldLabelRow}><Ionicons name={icon} size={15} color={colors.onSurfaceSecondary} /><Text style={styles.fieldLabel}>{label}</Text></View>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SocialButton({ provider, label, busy, disabled, onPress }: { provider: SocialProvider; label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.socialButton, disabled && !busy && styles.socialButtonDisabled]} onPress={onPress} disabled={disabled} testID={`auth-social-${provider}`}>
      {busy ? <ActivityIndicator color={colors.onSurface} /> : (
        <>
          <View style={[styles.socialIcon, styles.socialIconVk]}>
            <Text style={styles.socialIconText}>VK</Text>
          </View>
          <Text style={styles.socialLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, maxWidth: 520, width: "100%", alignSelf: "center" },
  brandLogo: { width: "100%", maxWidth: 360, height: 132, marginBottom: spacing.sm },
  brandLogoCompact: { height: 92, maxWidth: 300 },
  brandMark: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  brandMarkCompact: { width: 40, height: 40, borderRadius: 20 },
  brand: { marginTop: spacing.md, fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 2.4, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  heroTitle: { marginTop: spacing.lg, fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8, color: colors.onSurface, fontFamily: fonts.display },
  heroTitleCompact: { marginTop: spacing.sm, fontSize: 30, lineHeight: 35 },
  heroText: { marginTop: spacing.sm, fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  modeTabs: { flexDirection: "row", padding: 4, marginTop: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  modeTab: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  modeTabActive: { backgroundColor: colors.onSurface },
  modeText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  modeTextActive: { color: colors.onSurfaceInverse },
  form: { marginTop: spacing.xl },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  fieldError: { marginTop: 6, fontSize: 12, lineHeight: 16, color: colors.error, fontFamily: fonts.text },
  input: { height: 54, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  inputError: { borderColor: colors.error },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 54 },
  eyeButton: { position: "absolute", right: 4, top: 4, width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  requirementText: { fontSize: 12, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  requirementTextReady: { color: colors.onSurface },
  consentBlock: { marginTop: -2, marginBottom: spacing.md },
  consentRow: { flexDirection: "row", alignItems: "center" },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginRight: 8 },
  checkboxChecked: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  consentText: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", paddingLeft: 28, marginTop: 2 },
  legalLink: { fontSize: 12, lineHeight: 18, fontWeight: "700", color: colors.onSurface, textDecorationLine: "underline", fontFamily: fonts.text },
  submit: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.onSurface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  submitDisabled: { opacity: 0.65 },
  submitText: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  socialStack: { gap: spacing.sm },
  socialButton: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: spacing.lg },
  socialButtonDisabled: { opacity: 0.55 },
  socialIcon: { minWidth: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  socialIconVk: { backgroundColor: "#0077FF" },
  socialIconText: { fontSize: 11, fontWeight: "900", color: "#FFFFFF", fontFamily: fonts.text },
  socialLabel: { fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  textButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.sm },
  textButtonLabel: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  bottomSwitch: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  bottomSwitchMuted: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  bottomSwitchStrong: { fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  previewButton: { minHeight: 48, marginTop: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  previewButtonLabel: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  noticeError: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: "#F8E5E0", marginBottom: spacing.md },
  errorText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18, color: colors.error, fontFamily: fonts.text },
  noticeSuccess: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: "#E6F0E8", marginBottom: spacing.md },
  successText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurface, fontFamily: fonts.text },
});
