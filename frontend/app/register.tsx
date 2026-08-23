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

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, theme, lang, t } = useApp();
  const { register, startSocialLogin } = useAuth();
  const ru = lang === "ru";
  const a = t.auth;

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
  const passwordReady = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirm;
  const unavailable = busy || socialBusy !== null;

  const validate = () => {
    const next: FieldErrors = {};
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) next.email = ru ? "Введите корректный email" : "Enter a valid email";
    if (password.length < 8) next.password = ru ? "Нужно минимум 8 символов" : "Use at least 8 characters";
    if (!confirm) next.confirm = ru ? "Повторите пароль" : "Repeat the password";
    else if (password !== confirm) next.confirm = ru ? "Пароли не совпадают" : "Passwords do not match";
    if (!consent) next.consent = ru ? "Подтвердите согласие с условиями" : "Please accept the terms";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitEmail = async () => {
    setError(null);
    if (!validate()) return;
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
      <Header top={insets.top} onBack={() => router.back()} />
      <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formWrap}>
          <Brand />
          <View style={[styles.segment, { backgroundColor: colors.surfaceTertiary }]}>
            <Pressable testID="register-tab-login" onPress={() => router.replace("/auth")} style={styles.segmentBtn}><Txt variant="label" weight="bold" color={colors.muted}>{a.loginTab}</Txt></Pressable>
            <Pressable testID="register-tab-register" style={[styles.segmentBtn, { backgroundColor: colors.surfaceSecondary }]}><Txt variant="label" weight="bold">{a.registerTab}</Txt></Pressable>
          </View>

          <Animated.View entering={FadeIn.duration(250)}>
            <Txt variant="h1" style={{ marginTop: spacing.xl }}>{a.registerTitle}</Txt>
            <Txt variant="body" color={colors.muted} style={{ marginTop: 6 }}>{ru ? "Создайте аккаунт — личные данные добавим следующим шагом." : "Create an account — we will add personal details next."}</Txt>

            <View style={styles.fields}>
              <Field label={emailLabel} error={fieldErrors.email}>
                <TextInput value={email} onChangeText={(value) => { setEmail(value); clearField(setFieldErrors, "email"); }} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: fieldErrors.email ? colors.error : colors.border, color: colors.onSurface }]} placeholder={a.emailPlaceholder} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" accessibilityLabel={emailLabel} testID="register-email" />
              </Field>

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
            <Pressable testID="register-submit" onPress={submitEmail} disabled={unavailable} style={[styles.primary, { backgroundColor: colors.brandPrimary }, unavailable && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: busy || socialBusy !== null, busy }}>
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Txt variant="body" weight="bold" color={colors.onBrandPrimary}>{a.registerCta}</Txt><Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} /></>}
            </Pressable>

            <View style={styles.dividerRow}><View style={[styles.divider, { backgroundColor: colors.border }]} /><Txt variant="label" weight="semibold" color={colors.muted}>{a.or}</Txt><View style={[styles.divider, { backgroundColor: colors.border }]} /></View>
            <View style={{ gap: spacing.md }}><SocialButton provider="yandex" label={a.yandex} busy={socialBusy === "yandex"} disabled={unavailable && socialBusy !== "yandex"} onPress={() => socialRegister("yandex")} /><SocialButton provider="vk" label={a.vk} busy={socialBusy === "vk"} disabled={unavailable && socialBusy !== "vk"} onPress={() => socialRegister("vk")} /></View>
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

function Brand() {
  const { colors, t } = useApp();
  return <View style={styles.brandRow}><View style={[styles.logoDot, { backgroundColor: colors.brand }]}><Ionicons name="pulse" size={18} color={colors.onBrandPrimary} /></View><Txt variant="h2" weight="extrabold">{t.brand}</Txt></View>;
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
  return <Pressable onPress={onPress} disabled={busy || disabled} style={[styles.socialButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, disabled && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: busy || disabled, busy }}>{busy ? <ActivityIndicator color={colors.onSurface} /> : <><View style={[styles.providerMark, { backgroundColor: provider === "yandex" ? "#FC3F1D" : "#0077FF" }]}><Txt variant="label" weight="extrabold" color="#FFFFFF" style={{ fontSize: provider === "yandex" ? 16 : 12 }}>{provider === "yandex" ? "Я" : "VK"}</Txt></View><Txt variant="body" weight="bold" style={{ marginLeft: spacing.md }}>{label}</Txt></>}</Pressable>;
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
  scrollContent: { padding: spacing.xl, paddingBottom: spacing["3xl"], alignItems: "center" },
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
  requirement: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  errorText: { marginTop: 6 },
  consentRow: { minHeight: 44, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6 },
  primary: { minHeight: 54, marginTop: spacing.lg, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  disabled: { opacity: 0.55 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xl },
  divider: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  socialButton: { minHeight: 54, flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  providerMark: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  notice: { marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
