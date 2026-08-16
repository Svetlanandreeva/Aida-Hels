import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ru = lang === "ru";

  const submit = async () => {
    if (!token) return setError(ru ? "Ссылка восстановления недействительна" : "Invalid reset link");
    if (password.length < 8) return setError(ru ? "Минимум 8 символов" : "Use at least 8 characters");
    if (password !== confirm) return setError(ru ? "Пароли не совпадают" : "Passwords do not match");
    setBusy(true); setError(null);
    try {
      await resetPassword(token, password);
      router.replace("/(tabs)" as any);
    } catch {
      setError(ru ? "Ссылка устарела или уже использована" : "This link expired or was already used");
    } finally { setBusy(false); }
  };

  return <View style={[styles.page, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
    <View style={styles.card}>
      <View style={styles.icon}><Ionicons name="key-outline" size={22} color={colors.onSurfaceInverse} /></View>
      <Text style={styles.title}>{ru ? "Новый пароль" : "New password"}</Text>
      <Text style={styles.hint}>{ru ? "Придумайте новый пароль для аккаунта Аиды." : "Choose a new password for your Aida account."}</Text>
      <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder={ru ? "Новый пароль" : "New password"} placeholderTextColor={colors.onSurfaceSecondary} style={styles.input} />
      <TextInput secureTextEntry value={confirm} onChangeText={setConfirm} placeholder={ru ? "Повторите пароль" : "Repeat password"} placeholderTextColor={colors.onSurfaceSecondary} style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.buttonText}>{ru ? "Сохранить пароль" : "Save password"}</Text>}</Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 520, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  title: { marginTop: spacing.lg, fontSize: 30, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  hint: { marginTop: spacing.sm, marginBottom: spacing.xl, fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  input: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginBottom: spacing.md, fontSize: fontSize.base, color: colors.onSurface },
  error: { color: colors.error, marginBottom: spacing.md, fontFamily: fonts.text },
  button: { minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.onSurfaceInverse, fontWeight: "800", fontFamily: fonts.text },
});
