import React, { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

type Mode = "login" | "register" | "forgot";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useI18n();
  const { login, register, forgotPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ru = lang === "ru";

  const submit = async () => {
    setError(null);
    setMessage(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError(ru ? "Введите корректный email" : "Enter a valid email");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError(ru ? "Введите имя" : "Enter your name");
      return;
    }
    if (mode !== "forgot" && password.length < (mode === "register" ? 8 : 1)) {
      setError(ru ? "Пароль должен содержать минимум 8 символов" : "Password must be at least 8 characters");
      return;
    }

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
      const raw = String(e?.message || "");
      const friendly = raw.includes("Account already exists")
        ? (ru ? "Аккаунт с таким email уже существует" : "An account with this email already exists")
        : raw.includes("Invalid email or password")
          ? (ru ? "Неверный email или пароль" : "Incorrect email or password")
          : (ru ? "Не удалось выполнить запрос. Попробуйте ещё раз." : "Could not complete the request. Please try again.");
      setError(friendly);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setPassword("");
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.brandMark}>
          <Ionicons name="sparkles" size={24} color={colors.onSurfaceInverse} />
        </View>
        <Text style={styles.brand}>AIDA</Text>
        <Text style={styles.heroTitle}>
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
            <Field label={ru ? "Имя" : "Name"} icon="person-outline">
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder={ru ? "Как к вам обращаться" : "Your name"}
                placeholderTextColor={colors.onSurfaceSecondary}
                autoCapitalize="words"
                testID="auth-name"
              />
            </Field>
          )}

          <Field label="Email" icon="mail-outline">
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={colors.onSurfaceSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              testID="auth-email"
            />
          </Field>

          {mode !== "forgot" && (
            <Field label={ru ? "Пароль" : "Password"} icon="lock-closed-outline">
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder={mode === "register" ? (ru ? "Минимум 8 символов" : "At least 8 characters") : "••••••••"}
                placeholderTextColor={colors.onSurfaceSecondary}
                secureTextEntry
                textContentType={mode === "register" ? "newPassword" : "password"}
                testID="auth-password"
              />
            </Field>
          )}

          {error ? (
            <View style={styles.noticeError}><Ionicons name="alert-circle-outline" size={17} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View>
          ) : null}
          {message ? (
            <View style={styles.noticeSuccess}><Ionicons name="checkmark-circle-outline" size={17} color={colors.success} /><Text style={styles.successText}>{message}</Text></View>
          ) : null}

          <Pressable style={[styles.submit, busy && styles.submitDisabled]} onPress={submit} disabled={busy} testID="auth-submit">
            {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : (
              <>
                <Text style={styles.submitText}>
                  {mode === "login" ? (ru ? "Войти" : "Sign in") : mode === "register" ? (ru ? "Создать аккаунт" : "Create account") : (ru ? "Отправить ссылку" : "Send reset link")}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.onSurfaceInverse} />
              </>
            )}
          </Pressable>

          {mode === "login" && (
            <Pressable onPress={() => switchMode("forgot")} style={styles.textButton} testID="auth-forgot">
              <Text style={styles.textButtonLabel}>{ru ? "Забыли пароль?" : "Forgot password?"}</Text>
            </Pressable>
          )}
          {mode === "forgot" && (
            <Pressable onPress={() => switchMode("login")} style={styles.textButton} testID="auth-back-login">
              <Ionicons name="arrow-back" size={16} color={colors.onSurface} />
              <Text style={styles.textButtonLabel}>{ru ? "Вернуться ко входу" : "Back to sign in"}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={styles.fieldLabelRow}><Ionicons name={icon} size={15} color={colors.onSurfaceSecondary} /><Text style={styles.fieldLabel}>{label}</Text></View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, maxWidth: 520, width: "100%", alignSelf: "center" },
  brandMark: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  brand: { marginTop: spacing.md, fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 2.4, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  heroTitle: { marginTop: spacing.lg, fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8, color: colors.onSurface, fontFamily: fonts.display },
  heroText: { marginTop: spacing.sm, fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  modeTabs: { flexDirection: "row", padding: 4, marginTop: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  modeTab: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  modeTabActive: { backgroundColor: colors.onSurface },
  modeText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  modeTextActive: { color: colors.onSurfaceInverse },
  form: { marginTop: spacing.xl },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  input: { height: 54, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  submit: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.onSurface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  submitDisabled: { opacity: 0.65 },
  submitText: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  textButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.sm },
  textButtonLabel: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  noticeError: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: "#F8E5E0", marginBottom: spacing.md },
  errorText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18, color: colors.error, fontFamily: fonts.text },
  noticeSuccess: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: "#E6F0E8", marginBottom: spacing.md },
  successText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurface, fontFamily: fonts.text },
});
