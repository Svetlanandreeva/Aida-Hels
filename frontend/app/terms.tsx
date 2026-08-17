import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>Условия использования Аиды</Text>
      <Text style={styles.updated}>Редакция от 17 августа 2026 года</Text>
      <Section title="1. Назначение сервиса">Аида помогает пользователю хранить и структурировать сведения о здоровье, вести дневники и получать информационные подсказки. Сервис не заменяет врача, диагностику, экстренную помощь или назначение лечения.</Section>
      <Section title="2. Аккаунт">Пользователь отвечает за актуальность данных аккаунта и сохранность способов входа. Нельзя передавать доступ к аккаунту третьим лицам, если это создаёт риск доступа к медицинской информации.</Section>
      <Section title="3. Медицинская информация">Результаты автоматического анализа и ответы ИИ носят информационный характер. Решения о лечении, отмене или изменении препаратов должны приниматься с медицинским специалистом.</Section>
      <Section title="4. Допустимое использование">Нельзя использовать сервис для нарушения закона, попыток получить чужие данные, обхода механизмов безопасности или вмешательства в работу инфраструктуры Аиды.</Section>
      <Section title="5. Доступность">Мы стараемся поддерживать сервис доступным и безопасным, но отдельные функции могут временно быть недоступны из-за обновлений, работ провайдеров или технических сбоев.</Section>
      <Section title="6. Изменения условий">При существенном изменении условий новая редакция публикуется в приложении. Продолжение использования после вступления изменений в силу означает принятие новой редакции в пределах, допускаемых применимым законодательством.</Section>
      <View style={styles.note}><Text style={styles.noteText}>Юридические реквизиты владельца сервиса и контакт для официальных обращений должны быть добавлены до публичного коммерческого запуска.</Text></View>
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
