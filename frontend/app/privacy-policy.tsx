import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>Политика конфиденциальности Аиды</Text>
      <Text style={styles.updated}>Редакция от 17 августа 2026 года</Text>
      <Section title="Какие данные обрабатываются">Аида может обрабатывать данные аккаунта, сведения профиля здоровья, загруженные документы, дневники, показатели устройств и техническую информацию, необходимую для безопасности и работы сервиса.</Section>
      <Section title="Зачем нужны данные">Данные используются для работы выбранных пользователем функций: хранения медицинской истории, отображения динамики, напоминаний, персонализации интерфейса и формирования информационных подсказок.</Section>
      <Section title="Авторизация через внешние сервисы">При входе через Яндекс ID или VK ID Аида получает только данные, необходимые для создания или поиска аккаунта в пределах разрешений, подтверждённых пользователем у соответствующего провайдера. Медицинская информация Аиды не передаётся провайдеру авторизации только из-за факта такого входа.</Section>
      <Section title="Безопасность">Пароли не должны храниться в открытом виде. Сессии и операции восстановления доступа ограничиваются по сроку действия, а чувствительные операции должны проходить через защищённое соединение.</Section>
      <Section title="Передача третьим лицам">Данные могут передаваться техническим подрядчикам только в объёме, необходимом для работы инфраструктуры и выбранных функций, либо когда такая передача требуется законом. Продажа медицинских данных для рекламного таргетинга не является назначением сервиса.</Section>
      <Section title="Удаление и исправление">Пользователь должен иметь возможность исправить данные профиля, завершить активные сессии и запросить удаление аккаунта и связанных персональных данных с учётом обязательных сроков хранения, если они применимы.</Section>
      <View style={styles.note}><Text style={styles.noteText}>До публичного коммерческого запуска в документ необходимо добавить юридические реквизиты оператора персональных данных, контакт для обращений, фактические сроки хранения и перечень используемых обработчиков данных.</Text></View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.heading}>{title}</Text><Text style={styles.body}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: spacing.xl },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { marginTop: spacing.xl, fontSize: 32, lineHeight: 38, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  updated: { marginTop: spacing.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  section: { marginTop: spacing.xl },
  heading: { fontSize: 18, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  body: { marginTop: spacing.sm, fontSize: 15, lineHeight: 23, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  note: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  noteText: { fontSize: 13, lineHeight: 20, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
});
