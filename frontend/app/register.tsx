import React, { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";

import { withTimeout } from "@/src/async";
import { SocialProvider, useAuth } from "@/src/auth";
import { useApp } from "@/src/emergent/AppContext";
import { CONTENT_MAX, FORM_MAX, font, fontSize, radius, spacing } from "@/src/emergent/tokens";
import { LangToggle, ThemeToggle, Txt } from "@/src/emergent/ui";

type FieldErrors = Partial<Record<"email" | "password" | "confirm" | "consent", string>>;
type RegisterStep = "email" | "password";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, theme, lang, t } = useApp();
  const { register, startSocialLogin } = useAuth();
  const ru = lang === "ru";
  const a = t.auth;

  const [step, setStep] = useState<RegisterStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const cleanEmail = email.trim().toLowerCase();
  const emailReady = /^\S+@\S+\.\S+$/.test(cleanEmail);
  const passwordReady = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirm;
  const unavailable = busy || socialBusy !== null;

  const continueWithEmail = () => {
    setError(null);
    if (!emailReady) {
      setFieldErrors((previous) => ({ ...previous, email: ru ? "Введите корректный email" : "Enter a valid email" }));
      return;
    }
    clearField(setFieldErrors, "email");
    setStep("password");
  };

  const validatePasswordStep = () => {
    const next: FieldErrors = {};
    if (password.length < 8) next.password = ru ? "Нужно минимум 8 символов" : "Use at least 8 characters";
    if (!confirm) next.confirm = ru ? "Повторите пароль" : "Repeat the password";
    else if (password !== confirm) next.confirm = ru ? "Пароли не совпадают" : "Passwords do not match";
    if (!consent) next.consent = ru ? "Подтвердите согласие с условиями" : "Please accept the terms";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitEmail = async () => {
    setError(null);
    if (!emailReady) {
      setStep("email");
      setFieldErrors((previous) => ({ ...previous, email: ru ? "Введите корректный email" : "Enter a valid email" }));
      return;
    }
    if (!validatePasswordStep()) return;
    setBusy(true);
    try {
      await withTimeout(register("Мой профиль", cleanEmail, password, null), 8000, "register");
      router.replace("/onboarding" as any);
    } catch (cause: any) {
      setError(friendlyError(String(cause?.message || ""), ru));
    } finally {
      setBusy(false);
    }
  };

  const socialRegister = async (provider: SocialProvider) => {
    setError(null);
    setSocialBusy(provider);
    try {
      const returnUri = Platform.OS === "web" && typeof window !== "undefined" ? `${window.location.origin}/auth` : "https://aidaassistent.ru/auth";
      const authorizationUrl = await withTimeout(startSocialLogin(provider, returnUri), 6500, `register_${provider}`);
      if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(authorizationUrl);
      else await Linking.openURL(authorizationUrl);
    } catch (cause: any) {
      const slow = String(cause?.message || "").includes("timeout");
      setError(slow ? (ru ? "Сервис регистрации отвечает слишком долго. Попробуйте ещё раз." : "The registration provider is taking too long. Try again.") : (ru ? "Не удалось начать регистрацию через внешний аккаунт." : "Could not start social registration."));
      setSocialBusy(null);
    }
  };

  const emailLabel = ru ? "Электронная почта" : "Email";
  const confirmLabel = ru ? "Повтор пароля" : "Repeat password";
  const consentLabel = ru ? "Я принимаю пользовательское соглашение и политику конфиденциальности" : "I accept the Terms of Use and Privacy Policy";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Header top={insets.top} onBack={() => step === "password" ? setStep("email") : router.back()} />
      <KeyboardAwareScrollView bottomOffset={20} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formWrap}>
          <View style={[styles.segment, { backgroundColor: colors.surfaceTertiary }]}>
            <Pressable testID="register-tab-login" onPress={() => router.replace("/auth")} style={styles.segmentBtn}><Txt variant="label" weight="bold" color={colors.muted}>{a.loginTab}</Txt></Pressable>
            <Pressable testID="register-tab-register" style={[styles.segmentBtn, { backgroundColor: colors.surfaceSecondary }]}><Txt variant="label" weight="bold">{a.registerTab}</Txt></Pressable>
          </View>

          <Animated.View entering={FadeIn.duration(250)}>
            <Txt variant="h1" style={styles.title}>{a.registerTitle}</Txt>
            <Txt variant="body" color={colors.muted} style={styles.subtitle}>{ru ? "Выберите быстрый вход или зарегистрируйтесь по email." : "Choose a quick sign-in or register with email."}</Txt>

            <View style={styles.socialGroup} testID="register-social-options">
              <SocialButton provider="yandex" label={a.yandex} busy={socialBusy === "yandex"} disabled={unavailable && socialBusy !== "yandex"} onPress={() => socialRegister("yandex")} />
              <SocialButton provider="vk" label={a.vk} busy={socialBusy === "vk"} disabled={unavailable && socialBusy !== "vk"} onPress={() => socialRegister("vk")} />
            </View>

            <View style={styles.dividerRow}><View style={[styles.divider, { backgroundColor: colors.border }]} /><Txt variant="label" weight="semibold" color={colors.muted}>{a.or}</Txt><View style={[styles.divider, { backgroundColor: colors.border }]} /></View>

            {step === "email" ? (
              <View testID="register-email-step">
                <Field label={emailLabel} error={fieldErrors.email}>
                  <TextInput value={email} onChangeText={(value) => { setEmail(value); clearField(setFieldErrors, "email"); }} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: fieldErrors.email ? colors.error : colors.border, color: colors.onSurface }]} placeholder={a.emailPlaceholder} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={continueWithEmail} accessibilityLabel={emailLabel} testID="register-email" />
                </Field>
                <Pressable testID="register-email-continue" onPress={continueWithEmail} disabled={unavailable} style={[styles.primary, { backgroundColor: colors.brandPrimary }, unavailable && styles.disabled]} accessibilityRole="button">
                  <Txt variant="body" weight="bold" color={colors.onBrandPrimary}>{ru ? "Продолжить" : "Continue"}</Txt><Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            ) : (
              <View testID="register-password-step">
                <Pressable onPress={() => setStep("email")} style={[styles.emailSummary, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} accessibilityRole="button" testID="register-edit-email">
                  <View style={{ flex: 1 }}><Txt variant="label" color={colors.muted}>{emailLabel}</Txt><Txt variant="caption" weight="semibold" numberOfLines={1}>{cleanEmail}</Txt></View>
                  <Txt variant="label" weight="bold" color={colors.brand}>{ru ? "Изменить" : "Edit"}</Txt>
                </Pressable>

                <View style={styles.fields}>
                  <Field label={a.password} error={fieldErrors.password}>
                    <View style={styles.passwordWrap}>
                      <TextInput value={password} onChangeText={(value) => { setPassword(value); clearField(setFieldErrors, "password"); }} style={[styles.input, styles.passwordInput, { backgroundColor: colors.surfaceSecondary, borderColor: fieldErrors.password ? colors.error : colors.border, color: colors.onSurface }]} placeholder={a.passwordPlaceholder} placeholderTextColor={colors.muted} secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" returnKeyType="next" accessibilityLabel={a.password} testID="register-password" />
                      <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showPassword ? (ru ? "Скрыть пароль" : "Hide password") : (ru ? "Показать пароль" : "Show password")}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} /></Pressable>
                    </View>
                    <Requirement ready={passwordReady} label={ru ? "8 или больше символов" : "8 or more characters"} />
                  </Field>

                  <Field label={confirmLabel} error={fieldErrors.confirm}>
                    <TextInput value={confirm} onChangeText={(value) => { setConfirm(value); clearField(setFieldErrors, "confirm"); }} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: fieldErrors.confirm ? colors.error : colors.border, color: colors.onSurface }]} placeholder={ru ? "Повторите пароль" : "Repeat password"} placeholderTextColor={colors.muted} secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={() => { if (consent && !busy) submitEmail(); }} accessibilityLabel={confirmLabel} testID="register-confirm" />
                    {confirm ? <Requirement ready={passwordsMatch} label={passwordsMatch ? (ru ? "Пароли совпадают" : "Passwords match") : (ru ? "Пароли должны совпадать" : "Passwords must match")} /> : null}
                  </Field>

                  <Pressable onPress={() => { setConsent((value) => !value); clearField(setFieldErrors, "consent"); }} style={styles.consentRow} accessibilityRole="checkbox" accessibilityLabel={consentLabel} accessibilityState={{ checked: consent }} testID="register-consent">
                    <View style={[styles.checkbox, { borderColor: consent ? colors.brand : colors.borderStrong, backgroundColor: consent ? colors.brand : "transparent" }]}>{consent ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}</View>
                    <Txt variant="label" color={colors.muted} style={{ flex: 1 }}>{consentLabel}</Txt>
                  </Pressable>
                  {fieldErrors.consent ? <ErrorText text={fieldErrors.consent} /> : null}
                  <View style={styles.legalLinks}><Pressable onPress={() => router.push("/terms")} accessibilityRole="link"><Txt variant="label" weight="bold" color={colors.brand}>{ru ? "Условия использования" : "Terms of Use"}</Txt></Pressable><Txt variant="label" color={colors.muted}>{ru ? "и" : "and"}</Txt><Pressable onPress={() => router.push("/privacy-policy")} accessibilityRole="link"><Txt variant="label" weight="bold" color={colors.brand}>{ru ? "Политика конфиденциальности" : "Privacy Policy"}</Txt></Pressable></View>
                </View>

                {error ? <Notice kind="error" text={error} /> : null}
                <Pressable testID="register-submit" onPress={submitEmail} disabled={unavailable} style={[styles.primary, { backgroundColor: colors.brandPrimary }, unavailable && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: unavailable, busy }}>
                  {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Txt variant="body" weight="bold" color={colors.onBrandPrimary}>{a.registerCta}</Txt><Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} /></>}
                </Pressable>
              </View>
            )}

            {error && step === "email" ? <Notice kind="error" text={error} /> : null}
            <View style={styles.switchRow}><Txt variant="caption" color={colors.muted}>{a.switchToLoginQ}</Txt><Pressable onPress={() => router.replace("/auth")} accessibilityRole="link" style={{ marginLeft: 6 }}><Txt variant="caption" weight="bold" color={colors.brand}>{a.switchToLogin}</Txt></Pressable></View>
          </Animated.View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Header({ top, onBack }: { top: number; onBack: () => void }) {
  const { colors } = useApp();
  return <View style={[styles.header, { paddingTop: top + spacing.sm }]}><View style={styles.headerInner}><Pressable onPress={onBack} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]} accessibilityRole="button"><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable><View style={styles.headerControls}><LangToggle /><ThemeToggle /></View></View></View>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const { colors } = useApp();
  return <View><Txt variant="label" weight="semibold" color={colors.muted} style={styles.fieldLabel}>{label}</Txt>{children}{error ? <ErrorText text={error} /> : null}</View>;
}

function ErrorText({ text }: { text: string }) {
  const { colors } = useApp();
  return <Txt variant="label" color={colors.error} style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">{text}</Txt>;
}

function Requirement({ ready, label }: { ready: boolean; label: string }) {
  const { colors } = useApp();
  return <View style={styles.requirement}><Ionicons name={ready ? "checkmark-circle" : "ellipse-outline"} size={14} color={ready ? colors.success : colors.muted} /><Txt variant="label" color={ready ? colors.success : colors.muted}>{label}</Txt></View>;
}

function SocialButton({ provider, label, busy, disabled, onPress }: { provider: SocialProvider; label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useApp();
  return <Pressable onPress={onPress} disabled={busy || disabled} style={[styles.socialButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, disabled && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: busy || disabled, busy }} testID={`register-social-${provider}`}>{busy ? <ActivityIndicator color={colors.onSurface} /> : <><View style={[styles.providerMark, { backgroundColor: provider === "yandex" ? "#FC3F1D" : "#0077FF" }]}><Txt variant="label" weight="extrabold" color="#FFFFFF" style={{ fontSize: provider === "yandex" ? 16 : 12 }}>{provider === "yandex" ? "Я" : "VK"}</Txt></View><Txt variant="body" weight="bold" style={{ marginLeft: spacing.md }}>{label}</Txt></>}</Pressable>;
}

function Notice({ kind, text }: { kind: "error" | "success"; text: string }) {
  const { colors } = useApp();
  const accent = kind === "error" ? colors.error : colors.success;
  return <View style={[styles.notice, { borderColor: accent, backgroundColor: colors.surfaceSecondary }]} accessibilityRole="alert" accessibilityLiveRegion="polite"><Ionicons name={kind === "error" ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={accent} /><Txt variant="label" style={{ flex: 1 }}>{text}</Txt></View>;
}

function clearField(setter: React.Dispatch<React.SetStateAction<FieldErrors>>, field: keyof FieldErrors) {
  setter((previous) => ({ ...previous, [field]: undefined }));
}

function friendlyError(raw: string, ru: boolean) {
  const text = raw.toLowerCase();
  if (text.includes("already exists") || text.includes("409")) return ru ? "Аккаунт с таким email уже существует." : "An account with this email already exists.";
  if (text.includes("timeout")) return ru ? "Сервис отвечает слишком долго. Попробуйте ещё раз." : "The service is taking too long. Try again.";
  return ru ? "Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз." : "Could not create the account. Check the details and try again.";
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  headerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },
  headerControls: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl, alignItems: "center" },
  formWrap: { width: "100%", maxWidth: FORM_MAX },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.pill },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  title: { marginTop: spacing.lg },
  subtitle: { marginTop: 4 },
  socialGroup: { gap: spacing.sm, marginTop: spacing.lg },
  fields: { marginTop: spacing.md, gap: spacing.md },
  fieldLabel: { marginBottom: 7 },
  input: { height: 52, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, fontFamily: font.medium },
  passwordWrap: { justifyContent: "center" },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: "absolute", right: spacing.lg, height: 52, justifyContent: "center" },
  requirement: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  errorText: { marginTop: 5 },
  consentRow: { minHeight: 40, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6 },
  primary: { minHeight: 52, marginTop: spacing.md, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  disabled: { opacity: 0.55 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.md },
  divider: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  socialButton: { minHeight: 50, flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  providerMark: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emailSummary: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  notice: { marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});