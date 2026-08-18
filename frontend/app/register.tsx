import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "password" | "confirm" | "consent", string>>;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useI18n();
  const { register, resendVerification } = useAuth();
  const ru = lang === "ru";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const cleanEmail = email.trim().toLowerCase();
  const passwordReady = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirm;

  const phoneHint = useMemo(
    () => ru
      ? "Поле уже есть в структуре аккаунта. Вход и восстановление по телефону подключаются отдельным backend-шагом; сейчас email обязателен."
      : "The phone field is already part of the account flow. Phone sign-in and recovery are a separate backend step; email is required for now.",
    [ru]
  );

  const validate = () => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = ru ? "Введите имя и фамилию" : "Enter your full name";
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) next.email = ru ? "Введите корректный email" : "Enter a valid email";
    if (phone.trim() && !/^\+?[0-9()\-\s]{7,20}$/.test(phone.trim())) next.phone = ru ? "Проверьте номер телефона" : "Check the phone number";
    if (password.length < 8) next.password = ru ? "Нужно минимум 8 символов" : "Use at least 8 characters";
    if (!confirm) next.confirm = ru ? "Повторите пароль" : "Repeat the password";
    else if (password !== confirm) next.confirm = ru ? "Пароли не совпадают" : "Passwords do not match";
    if (!consent) next.consent = ru ? "Подтвердите согласие с условиями" : "Please accept the terms";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const result = await register(name.trim(), cleanEmail, password);
      setVerificationEmail(result.email);
    } catch (e: any) {
      setError(friendlyError(String(e?.message || ""), ru));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!verificationEmail) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await resendVerification(verificationEmail);
      setMessage(ru ? "Письмо отправлено ещё раз." : "Verification email sent again.");
    } catch (e: any) {
      setError(friendlyError(String(e?.message || ""), ru));
    } finally {
      setBusy(false);
    }
  };

  if (verificationEmail) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.verifyCard}>
          <View style={styles.brandIcon}><Ionicons name="mail-open-outline" size={24} color={colors.onSurfaceInverse} /></View>
          <Text style={styles.title}>{ru ? "Подтвердите email" : "Verify your email"}</Text>
          <Text style={styles.subtitle}>{ru ? "Откройте ссылку в письме. После подтверждения можно войти и продолжить настройку профиля." : "Open the link in the email. After verification, sign in and continue profile setup."}</Text>
          <View style={styles.emailPill}><Ionicons name="mail-outline" size={16} color={colors.onSurfaceSecondary} /><Text style={styles.emailPillText}>{verificationEmail}</Text></View>
          {error ? <Notice kind="error" text={error} /> : null}
          {message ? <Notice kind="success" text={message} /> : null}
          <Pressable style={[styles.primary, busy && styles.disabled]} onPress={resend} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.primaryText}>{ru ? "Отправить письмо ещё раз" : "Send again"}</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.replace("/auth")}>
            <Text style={styles.secondaryText}>{ru ? "Перейти ко входу" : "Go to sign in"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 34 }]}>
        <View style={styles.brandIcon}><Ionicons name="sparkles" size={20} color={colors.onSurfaceInverse} /></View>
        <Text style={styles.eyebrow}>AIDA</Text>
        <Text style={styles.title}>{ru ? "Создать аккаунт" : "Create account"}</Text>
        <Text style={styles.subtitle}>{ru ? "Один аккаунт — отдельный профиль и доступ к вашим данным здоровья." : "One account gives you a separate profile and access to your health data."}</Text>

        <View style={styles.form}>
          <Field label={ru ? "Имя и фамилия" : "Full name"} icon="person-outline" error={fieldErrors.name}>
            <TextInput value={name} onChangeText={(v) => { setName(v); clearField(setFieldErrors, "name"); }} style={[styles.input, fieldErrors.name && styles.inputError]} placeholder={ru ? "Как к вам обращаться" : "Your full name"} placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="words" textContentType="name" />
          </Field>

          <Field label={ru ? "Электронная почта" : "Email"} icon="mail-outline" error={fieldErrors.email}>
            <TextInput value={email} onChangeText={(v) => { setEmail(v); clearField(setFieldErrors, "email"); }} style={[styles.input, fieldErrors.email && styles.inputError]} placeholder="name@example.com" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
          </Field>

          <Field label={ru ? "Телефон" : "Phone"} icon="call-outline" error={fieldErrors.phone} hint={phoneHint}>
            <TextInput value={phone} onChangeText={(v) => { setPhone(v); clearField(setFieldErrors, "phone"); }} style={[styles.input, fieldErrors.phone && styles.inputError]} placeholder="+7 999 000-00-00" placeholderTextColor={colors.onSurfaceSecondary} keyboardType="phone-pad" textContentType="telephoneNumber" />
          </Field>

          <Field label={ru ? "Пароль" : "Password"} icon="lock-closed-outline" error={fieldErrors.password}>
            <View style={styles.passwordWrap}>
              <TextInput value={password} onChangeText={(v) => { setPassword(v); clearField(setFieldErrors, "password"); }} style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]} placeholder={ru ? "Минимум 8 символов" : "At least 8 characters"} placeholderTextColor={colors.onSurfaceSecondary} secureTextEntry={!showPassword} textContentType="newPassword" />
              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.onSurfaceSecondary} /></Pressable>
            </View>
            <Requirement ready={passwordReady} label={ru ? "8 или больше символов" : "8 or more characters"} />
          </Field>

          <Field label={ru ? "Повтор пароля" : "Repeat password"} icon="shield-checkmark-outline" error={fieldErrors.confirm}>
            <TextInput value={confirm} onChangeText={(v) => { setConfirm(v); clearField(setFieldErrors, "confirm"); }} style={[styles.input, fieldErrors.confirm && styles.inputError]} placeholder={ru ? "Введите пароль ещё раз" : "Enter the password again"} placeholderTextColor={colors.onSurfaceSecondary} secureTextEntry={!showPassword} textContentType="newPassword" />
            {confirm.length > 0 ? <Requirement ready={passwordsMatch} label={passwordsMatch ? (ru ? "Пароли совпадают" : "Passwords match") : (ru ? "Пароли должны совпадать" : "Passwords must match")} /> : null}
          </Field>

          <View style={styles.consentBlock}>
            <Pressable onPress={() => { setConsent((v) => !v); clearField(setFieldErrors, "consent"); }} style={styles.consentRow}>
              <View style={[styles.checkbox, consent && styles.checkboxChecked]}>{consent ? <Ionicons name="checkmark" size={14} color={colors.onSurfaceInverse} /> : null}</View>
              <Text style={styles.consentText}>{ru ? "Я принимаю пользовательское соглашение и политику конфиденциальности" : "I accept the Terms of Use and Privacy Policy"}</Text>
            </Pressable>
            <View style={styles.legalRow}>
              <Pressable onPress={() => router.push("/terms" as any)}><Text style={styles.legalLink}>{ru ? "Условия использования" : "Terms"}</Text></Pressable>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={() => router.push("/privacy" as any)}><Text style={styles.legalLink}>{ru ? "Конфиденциальность" : "Privacy"}</Text></Pressable>
            </View>
            {fieldErrors.consent ? <Text style={styles.fieldError}>{fieldErrors.consent}</Text> : null}
          </View>

          {error ? <Notice kind="error" text={error} /> : null}
          <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy} testID="register-submit">
            {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <><Text style={styles.primaryText}>{ru ? "Создать аккаунт" : "Create account"}</Text><Ionicons name="arrow-forward" size={18} color={colors.onSurfaceInverse} /></>}
          </Pressable>
          <Pressable style={styles.loginLink} onPress={() => router.replace("/auth")}>
            <Text style={styles.loginCopy}>{ru ? "Уже есть аккаунт? " : "Already have an account? "}<Text style={styles.loginStrong}>{ru ? "Войти" : "Sign in"}</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function clearField(setter: React.Dispatch<React.SetStateAction<FieldErrors>>, field: keyof FieldErrors) {
  setter((prev) => ({ ...prev, [field]: undefined }));
}

function Field({ label, icon, error, hint, children }: { label: string; icon: any; error?: string; hint?: string; children: React.ReactNode }) {
  return <View style={styles.field}><View style={styles.labelRow}><Ionicons name={icon} size={15} color={colors.onSurfaceSecondary} /><Text style={styles.label}>{label}</Text></View>{children}{hint ? <Text style={styles.hint}>{hint}</Text> : null}{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

function Requirement({ ready, label }: { ready: boolean; label: string }) {
  return <View style={styles.requirement}><Ionicons name={ready ? "checkmark-circle" : "ellipse-outline"} size={15} color={ready ? colors.success : colors.onSurfaceSecondary} /><Text style={[styles.requirementText, ready && styles.requirementReady]}>{label}</Text></View>;
}

function Notice({ kind, text }: { kind: "error" | "success"; text: string }) {
  return <View style={[styles.notice, kind === "error" ? styles.noticeError : styles.noticeSuccess]}><Ionicons name={kind === "error" ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={kind === "error" ? colors.error : colors.success} /><Text style={styles.noticeText}>{text}</Text></View>;
}

function friendlyError(raw: string, ru: boolean) {
  const text = raw.toLowerCase();
  if (text.includes("already exists") || text.includes("409")) return ru ? "Аккаунт с таким email уже существует." : "An account with this email already exists.";
  if (text.includes("verification delivery") || text.includes("smtp") || text.includes("503")) return ru ? "Сервис отправки письма временно недоступен. Попробуйте позже." : "Email delivery is temporarily unavailable. Try again later.";
  return ru ? "Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз." : "Could not create the account. Check the details and try again.";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: spacing.xl },
  brandIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  eyebrow: { marginTop: spacing.lg, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: spacing.sm, color: colors.onSurface, fontFamily: fonts.display, fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1.1 },
  subtitle: { marginTop: spacing.md, maxWidth: 560, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.base, lineHeight: 23 },
  form: { marginTop: spacing.xl, gap: spacing.lg },
  field: { gap: spacing.sm },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  label: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "800" },
  input: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg, color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.base },
  inputError: { borderColor: colors.error },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 54 },
  eyeButton: { position: "absolute", right: 0, top: 0, width: 52, height: 54, alignItems: "center", justifyContent: "center" },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
  fieldError: { color: colors.error, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
  requirement: { flexDirection: "row", alignItems: "center", gap: 7 },
  requirementText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
  requirementReady: { color: colors.success },
  consentBlock: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxChecked: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  consentText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  legalRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, paddingLeft: 30 },
  legalLink: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 12, fontWeight: "800", textDecorationLine: "underline" },
  dot: { color: colors.onSurfaceSecondary },
  primary: { minHeight: 54, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.onSurface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryText: { color: colors.onSurfaceInverse, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.base },
  disabled: { opacity: 0.55 },
  loginLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  loginCopy: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.sm },
  loginStrong: { color: colors.onSurface, fontWeight: "800" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  noticeError: { borderColor: "rgba(190, 54, 54, 0.25)", backgroundColor: "rgba(190, 54, 54, 0.06)" },
  noticeSuccess: { borderColor: "rgba(47, 125, 87, 0.25)", backgroundColor: "rgba(47, 125, 87, 0.06)" },
  noticeText: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.sm, lineHeight: 19 },
  verifyCard: { width: "100%", maxWidth: 560, alignSelf: "center", margin: "auto" as any, padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  emailPill: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  emailPillText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700" },
  secondary: { marginTop: spacing.sm, minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.onSurface, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.base },
});
