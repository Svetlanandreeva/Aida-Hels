import React, { useState } from "react";
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

import { withTimeout } from "@/src/async";
import { SocialProvider, useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type FieldErrors = Partial<Record<"email" | "password" | "confirm" | "consent", string>>;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useI18n();
  const { register, startSocialLogin } = useAuth();
  const ru = lang === "ru";

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
    } catch (e: any) {
      setError(friendlyError(String(e?.message || ""), ru));
    } finally {
      setBusy(false);
    }
  };

  const socialRegister = async (provider: SocialProvider) => {
    setError(null);
    setSocialBusy(provider);
    try {
      const returnUri = Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}/auth`
        : "https://aidaassistent.ru/auth";
      const authorizationUrl = await withTimeout(startSocialLogin(provider, returnUri), 6500, `register_${provider}`);
      if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(authorizationUrl);
      else await Linking.openURL(authorizationUrl);
    } catch (e: any) {
      const slow = String(e?.message || "").includes("timeout");
      setError(
        slow
          ? (ru ? "Сервис регистрации отвечает слишком долго. Попробуйте ещё раз." : "The registration provider is taking too long. Try again.")
          : (ru ? "Не удалось начать регистрацию через внешний аккаунт." : "Could not start social registration.")
      );
      setSocialBusy(null);
    }
  };

  const emailLabel = ru ? "Электронная почта" : "Email";
  const passwordLabel = ru ? "Пароль" : "Password";
  const confirmLabel = ru ? "Повтор пароля" : "Repeat password";
  const submitLabel = ru ? "Продолжить" : "Continue";
  const consentLabel = ru ? "Я принимаю пользовательское соглашение и политику конфиденциальности" : "I accept the Terms of Use and Privacy Policy";

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 26 }]}
      >
        <View style={styles.header}>
          <View style={styles.brandIcon} accessible={false}>
            <Ionicons name="sparkles" size={20} color={colors.onSurfaceInverse} />
          </View>
          <Text style={styles.eyebrow}>AIDA · 1/2</Text>
          <Text style={styles.title}>{ru ? "Создать аккаунт" : "Create account"}</Text>
          <Text style={styles.subtitle}>
            {ru
              ? "Выберите способ регистрации. Личные данные подтвердим следующим шагом."
              : "Choose how to register. You will confirm your profile details on the next step."}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.authCard}>
            <Text style={styles.sectionTitle}>{ru ? "Быстрый вход" : "Quick sign up"}</Text>
            <View style={styles.socialRow}>
              <View style={styles.socialCell}>
                <SocialButton
                  provider="yandex"
                  label={ru ? "Яндекс ID" : "Yandex ID"}
                  busy={socialBusy === "yandex"}
                  disabled={busy || (socialBusy !== null && socialBusy !== "yandex")}
                  onPress={() => socialRegister("yandex")}
                />
              </View>
              <View style={styles.socialCell}>
                <SocialButton
                  provider="vk"
                  label="VK ID"
                  busy={socialBusy === "vk"}
                  disabled={busy || (socialBusy !== null && socialBusy !== "vk")}
                  onPress={() => socialRegister("vk")}
                />
              </View>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>{ru ? "или по email" : "or with email"}</Text>
              <View style={styles.divider} />
            </View>

            <Text style={styles.sectionTitle}>{ru ? "Регистрация по email" : "Register with email"}</Text>
            <View style={styles.emailFields}>
              <Field label={emailLabel} icon="mail-outline" error={fieldErrors.email}>
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); clearField(setFieldErrors, "email"); }}
                  style={[styles.input, fieldErrors.email && styles.inputError]}
                  placeholder={ru ? "Электронная почта" : "Email address"}
                  placeholderTextColor={colors.onSurfaceSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  accessibilityLabel={emailLabel}
                  accessibilityHint={fieldErrors.email}
                  testID="register-email"
                />
              </Field>

              <Field label={passwordLabel} icon="lock-closed-outline" error={fieldErrors.password}>
                <View style={styles.passwordWrap}>
                  <TextInput
                    value={password}
                    onChangeText={(v) => { setPassword(v); clearField(setFieldErrors, "password"); }}
                    style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]}
                    placeholder={ru ? "Пароль" : "Password"}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    accessibilityLabel={passwordLabel}
                    accessibilityHint={fieldErrors.password}
                    testID="register-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? (ru ? "Скрыть пароль" : "Hide password") : (ru ? "Показать пароль" : "Show password")}
                    accessibilityState={{ selected: showPassword }}
                  >
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.onSurfaceSecondary} />
                  </Pressable>
                </View>
                <Requirement ready={passwordReady} label={ru ? "8 или больше символов" : "8 or more characters"} />
              </Field>

              <Field label={confirmLabel} icon="shield-checkmark-outline" error={fieldErrors.confirm}>
                <View style={styles.passwordWrap}>
                  <TextInput
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); clearField(setFieldErrors, "confirm"); }}
                    style={[styles.input, styles.passwordInput, fieldErrors.confirm && styles.inputError]}
                    placeholder={ru ? "Повторите пароль" : "Repeat password"}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={() => { if (consent && !busy) submitEmail(); }}
                    accessibilityLabel={confirmLabel}
                    accessibilityHint={fieldErrors.confirm}
                    testID="register-confirm"
                  />
                  <View style={styles.eyeSpacer} />
                </View>
                {confirm.length > 0 ? (
                  <Requirement
                    ready={passwordsMatch}
                    label={passwordsMatch ? (ru ? "Пароли совпадают" : "Passwords match") : (ru ? "Пароли должны совпадать" : "Passwords must match")}
                  />
                ) : null}
              </Field>
            </View>

            <View style={styles.consentBlock}>
              <Pressable
                onPress={() => { setConsent((v) => !v); clearField(setFieldErrors, "consent"); }}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityLabel={consentLabel}
                accessibilityHint={fieldErrors.consent}
                accessibilityState={{ checked: consent }}
                testID="register-consent"
              >
                <View style={[styles.checkbox, consent && styles.checkboxChecked]} accessible={false}>
                  {consent ? <Ionicons name="checkmark" size={13} color={colors.onSurfaceInverse} /> : null}
                </View>
                <Text style={styles.consentText}>{consentLabel}</Text>
              </Pressable>
              <View style={styles.legalRow}>
                <Pressable onPress={() => router.push("/terms" as any)} accessibilityRole="link">
                  <Text style={styles.legalLink}>{ru ? "Условия" : "Terms"}</Text>
                </Pressable>
                <Text style={styles.dot}>·</Text>
                <Pressable onPress={() => router.push("/privacy-policy" as any)} accessibilityRole="link">
                  <Text style={styles.legalLink}>{ru ? "Конфиденциальность" : "Privacy"}</Text>
                </Pressable>
              </View>
              {fieldErrors.consent ? <Text style={styles.fieldError} accessibilityRole="alert" accessibilityLiveRegion="polite">{fieldErrors.consent}</Text> : null}
            </View>

            {error ? <Notice text={error} /> : null}

            <Pressable
              style={[styles.primary, (busy || socialBusy !== null) && styles.disabled]}
              onPress={submitEmail}
              disabled={busy || socialBusy !== null}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              accessibilityState={{ disabled: busy || socialBusy !== null, busy }}
              testID="register-submit"
            >
              {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.primaryText}>{submitLabel}</Text>}
            </Pressable>
          </View>

          <Pressable
            style={styles.loginLink}
            onPress={() => router.replace("/auth")}
            accessibilityRole="link"
            accessibilityLabel={ru ? "Уже есть аккаунт? Войти" : "Already have an account? Sign in"}
          >
            <Text style={styles.loginCopy}>
              {ru ? "Уже есть аккаунт? " : "Already have an account? "}
              <Text style={styles.loginStrong}>{ru ? "Войти" : "Sign in"}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function clearField(setter: React.Dispatch<React.SetStateAction<FieldErrors>>, field: keyof FieldErrors) {
  setter((prev) => ({ ...prev, [field]: undefined }));
}

function Field({ label, icon, error, children }: { label: string; icon: any; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={14} color={colors.onSurfaceSecondary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {children}
      {error ? <Text style={styles.fieldError} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

function Requirement({ ready, label }: { ready: boolean; label: string }) {
  return (
    <View style={styles.requirement} accessible accessibilityLabel={`${label}: ${ready ? "OK" : "not complete"}`}>
      <Ionicons name={ready ? "checkmark-circle" : "ellipse-outline"} size={14} color={ready ? colors.success : colors.onSurfaceSecondary} />
      <Text style={[styles.requirementText, ready && styles.requirementReady]}>{label}</Text>
    </View>
  );
}

function SocialButton({ provider, label, busy, disabled, onPress }: { provider: SocialProvider; label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.socialButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled, busy }}
    >
      {busy ? (
        <ActivityIndicator color={colors.onSurface} />
      ) : (
        <>
          <View style={styles.providerMark}>
            <Text style={styles.providerMarkText}>{provider === "yandex" ? "Я" : "VK"}</Text>
          </View>
          <Text style={styles.socialText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View style={[styles.notice, styles.noticeError]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function friendlyError(raw: string, ru: boolean) {
  const text = raw.toLowerCase();
  if (text.includes("already exists") || text.includes("409")) return ru ? "Аккаунт с таким email уже существует." : "An account with this email already exists.";
  if (text.includes("timeout")) return ru ? "Сервис отвечает слишком долго. Попробуйте ещё раз." : "The service is taking too long. Try again.";
  return ru ? "Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз." : "Could not create the account. Check the details and try again.";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: spacing.xl },
  header: { alignItems: "center" },
  brandIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  eyebrow: { marginTop: spacing.md, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: colors.onSurface, fontFamily: fonts.display, fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1.1, textAlign: "center" },
  subtitle: { marginTop: spacing.sm, maxWidth: 520, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.sm, lineHeight: 20, textAlign: "center" },
  form: { marginTop: spacing.xl, gap: spacing.md },
  authCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "900" },
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  socialCell: { flex: 1, minWidth: 220 },
  socialButton: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  providerMark: { minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  providerMarkText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 12, fontWeight: "900" },
  socialText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "800" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: 2 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
  emailFields: { gap: 11 },
  field: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 12, fontWeight: "800" },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm },
  inputError: { borderColor: colors.error },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 50 },
  eyeButton: { position: "absolute", right: 0, top: 0, width: 48, height: 50, alignItems: "center", justifyContent: "center" },
  eyeSpacer: { position: "absolute", right: 0, top: 0, width: 48, height: 50 },
  fieldError: { color: colors.error, fontFamily: fonts.text, fontSize: 11, lineHeight: 15 },
  requirement: { flexDirection: "row", alignItems: "center", gap: 6 },
  requirementText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11 },
  requirementReady: { color: colors.success },
  consentBlock: { gap: 6, paddingTop: 2 },
  consentRow: { minHeight: 44, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxChecked: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  consentText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 18 },
  legalRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, paddingLeft: 28, marginTop: -6 },
  legalLink: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 11, fontWeight: "800", textDecorationLine: "underline" },
  dot: { color: colors.onSurfaceSecondary },
  primary: { minHeight: 50, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onSurfaceInverse, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.sm, textAlign: "center" },
  disabled: { opacity: 0.55 },
  loginLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  loginCopy: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.sm, textAlign: "center" },
  loginStrong: { color: colors.onSurface, fontWeight: "800" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  noticeError: { borderColor: "rgba(190, 54, 54, 0.25)", backgroundColor: "rgba(190, 54, 54, 0.06)" },
  noticeText: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
});