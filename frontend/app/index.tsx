import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const features = [
  ["pulse-outline", "Все данные здоровья в одном месте", "Анализы, давление, лекарства, психика, цикл, сон и данные устройств — внутри одного профиля."],
  ["sparkles-outline", "Аида объясняет, а не пугает", "ИИ использует только доступный контекст профиля и отделяет факты от наблюдений."],
  ["watch-outline", "Apple Health и Health Connect", "Подключайте устройства и синхронизируйте поддерживаемые показатели без ручного переписывания."],
  ["shield-checkmark-outline", "Данные разделены по профилям", "Каждый аккаунт и семейный профиль имеют собственные права доступа. Отсутствующие данные не заменяются выдуманными значениями."],
] as const;

const steps = [
  ["01", "Выберите цели", "Настройте Аиду под то, что важно именно вам: анализы, сон, давление, лекарства, психика и другое."],
  ["02", "Добавьте данные", "Вводите вручную, загружайте документы или подключайте совместимые источники здоровья."],
  ["03", "Следите за динамикой", "Главная, история и Аида используют данные вашего профиля и показывают, где информации пока недостаточно."],
] as const;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const mobile = width < 520;
  const narrow = width < 390;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
      <View style={[styles.shell, mobile && styles.shellCompact, { paddingTop: insets.top + (mobile ? 6 : 12) }]}>
        <View style={[styles.header, mobile && styles.headerCompact]}>
          <Pressable style={styles.brandRow} onPress={() => router.replace("/")} accessibilityRole="link" accessibilityLabel="Aida">
            {Platform.OS === "web" ? (
              <Image source={{ uri: "/aida-logo.svg" }} style={[styles.brandLogo, mobile && styles.brandLogoCompact]} resizeMode="contain" accessibilityLabel="Aida" />
            ) : (
              <><View style={styles.logo}><Ionicons name="sparkles" size={18} color={colors.onSurfaceInverse} /></View><Text style={styles.brand}>AIDA</Text></>
            )}
          </Pressable>
          <View style={[styles.headerActions, mobile && styles.headerActionsCompact]}>
            <Pressable style={[styles.loginButton, mobile && styles.loginButtonCompact]} onPress={() => router.push("/auth")}>
              <Text style={[styles.loginText, mobile && styles.headerActionTextCompact]} numberOfLines={1}>Войти</Text>
            </Pressable>
            {!mobile ? (
              <Pressable style={styles.primarySmall} onPress={() => router.push("/register")}>
                <Text style={styles.primaryText} numberOfLines={1}>Начать бесплатно</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.hero, mobile && styles.heroMobile, desktop && styles.heroDesktop]}>
          <View style={styles.heroCopy}>
            <View style={[styles.badge, mobile && styles.badgeMobile]}><View style={styles.badgeDot} /><Text style={[styles.badgeText, mobile && styles.badgeTextMobile]}>Персональный ассистент здоровья</Text></View>
            <Text style={[styles.heroTitle, mobile && styles.heroTitleMobile, narrow && styles.heroTitleNarrow, desktop && styles.heroTitleDesktop]}>Здоровье — не набор цифр. Аида собирает их в понятную картину.</Text>
            <Text style={[styles.heroBody, mobile && styles.heroBodyMobile]}>Храните данные здоровья в одном профиле, следите за изменениями и получайте объяснения без подмены отсутствующих данных красивыми фантазиями.</Text>
            <View style={[styles.heroActions, mobile && styles.heroActionsMobile]}>
              <Pressable style={[styles.primary, mobile && styles.primaryMobile]} onPress={() => router.push("/register")}>
                <Text style={styles.primaryText}>Начать бесплатно</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.onSurfaceInverse} />
              </Pressable>
              {!mobile ? (
                <Pressable style={styles.secondary} onPress={() => router.push("/auth")}>
                  <Text style={styles.secondaryText}>Войти в приложение</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={[styles.heroVisual, mobile && styles.heroVisualMobile]}>
            <View style={styles.visualTop}>
              <Text style={styles.visualEyebrow}>ИИ-ИТОГ ДНЯ</Text>
              <View style={[styles.livePill, mobile && styles.livePillMobile]}><View style={styles.liveDot} /><Text style={styles.liveText}>по вашим данным</Text></View>
            </View>
            <Text style={[styles.visualTitle, mobile && styles.visualTitleMobile]}>Сегодня данных достаточно для нескольких наблюдений.</Text>
            <Text style={[styles.visualText, mobile && styles.visualTextMobile]}>Аида показывает источник каждого вывода и отдельно сообщает, если информации для оценки пока недостаточно.</Text>
            <View style={[styles.signalRow, mobile && styles.signalRowMobile]}>
              <Signal icon="flask-outline" label="Анализы" />
              <Signal icon="heart-outline" label="Давление" />
              <Signal icon="moon-outline" label="Сон" />
            </View>
            <View style={[styles.orbit, mobile && styles.orbitMobile]}>
              <View style={[styles.orbitDot, { top: 18, left: "16%" }]} />
              <View style={[styles.orbitDot, styles.orbitDotAccent, { top: 62, right: "14%" }]} />
              <View style={[styles.orbitDot, { bottom: 24, left: "42%" }]} />
              <View style={styles.orbitLine} />
              <View style={[styles.orbitLine, styles.orbitLineTwo]} />
            </View>
          </View>
        </View>

        <Section eyebrow="ВОЗМОЖНОСТИ" title="Не отдельные дневники, а одна система" mobile={mobile} narrow={narrow}>
          <View style={[styles.grid, mobile && styles.gridMobile]}>
            {features.map(([icon, title, text]) => (
              <View key={title} style={[styles.card, mobile && styles.cardMobile, desktop && styles.cardDesktop]}>
                <View style={[styles.iconBox, mobile && styles.iconBoxMobile]}><Ionicons name={icon as any} size={mobile ? 20 : 22} color={colors.onSurface} /></View>
                <Text style={[styles.cardTitle, mobile && styles.cardTitleMobile]}>{title}</Text>
                <Text style={[styles.cardText, mobile && styles.cardTextMobile]}>{text}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section eyebrow="КАК ЭТО РАБОТАЕТ" title="Начать можно без заполнения медицинской энциклопедии о себе" mobile={mobile} narrow={narrow}>
          <View style={[styles.steps, mobile && styles.stepsMobile]}>
            {steps.map(([number, title, text]) => (
              <View key={number} style={[styles.step, mobile && styles.stepMobile]}>
                <Text style={[styles.stepNumber, mobile && styles.stepNumberMobile]}>{number}</Text>
                <View style={styles.stepBody}><Text style={[styles.stepTitle, mobile && styles.stepTitleMobile]}>{title}</Text><Text style={[styles.stepText, mobile && styles.stepTextMobile]}>{text}</Text></View>
              </View>
            ))}
          </View>
        </Section>

        <View style={[styles.privacyBlock, mobile && styles.privacyBlockMobile]}>
          <View style={[styles.privacyIcon, mobile && styles.privacyIconMobile]}><Ionicons name="lock-closed-outline" size={mobile ? 21 : 24} color={colors.onSurface} /></View>
          <View style={styles.privacyCopy}>
            <Text style={[styles.privacyTitle, mobile && styles.privacyTitleMobile]}>Нет данных — значит «нет данных».</Text>
            <Text style={[styles.privacyText, mobile && styles.privacyTextMobile]}>Аида не должна подставлять демонстрационные показатели в обычные профили. Тестовые записи относятся только к специально созданному тестовому аккаунту, а доступ к медицинским данным проверяется по профилю.</Text>
          </View>
        </View>

        <View style={[styles.cta, mobile && styles.ctaMobile]}>
          <Text style={[styles.ctaTitle, mobile && styles.ctaTitleMobile]}>Соберите свою картину здоровья в одном месте.</Text>
          <Text style={[styles.ctaText, mobile && styles.ctaTextMobile]}>Создайте профиль и включите только те разделы, которые вам действительно нужны.</Text>
          <Pressable style={[styles.ctaButton, mobile && styles.ctaButtonMobile]} onPress={() => router.push("/register")}>
            <Text style={styles.primaryText}>Начать бесплатно</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onSurfaceInverse} />
          </Pressable>
        </View>

        <View style={[styles.footer, mobile && styles.footerMobile]}><Text style={styles.footerBrand}>AIDA</Text><Text style={styles.footerText}>Цифровой ассистент здоровья</Text></View>
      </View>
    </ScrollView>
  );
}

function Signal({ icon, label }: { icon: any; label: string }) {
  return <View style={styles.signal}><Ionicons name={icon} size={16} color={colors.onSurface} /><Text style={styles.signalText}>{label}</Text></View>;
}

function Section({ eyebrow, title, children, mobile, narrow }: { eyebrow: string; title: string; children: React.ReactNode; mobile?: boolean; narrow?: boolean }) {
  return (
    <View style={[styles.section, mobile && styles.sectionMobile]}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={[styles.sectionTitle, mobile && styles.sectionTitleMobile, narrow && styles.sectionTitleNarrow]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  shell: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: spacing.xl },
  shellCompact: { paddingHorizontal: 20 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headerCompact: { minHeight: 54, gap: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  brandLogo: { width: 116, height: 48 },
  brandLogoCompact: { width: 92, height: 38 },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  brand: { fontFamily: fonts.text, fontSize: 13, fontWeight: "900", letterSpacing: 2.4, color: colors.onSurface },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerActionsCompact: { gap: 2, flexShrink: 0 },
  loginButton: { minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  loginButtonCompact: { minHeight: 40, paddingHorizontal: 10 },
  loginText: { color: colors.onSurface, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.base },
  primarySmall: { minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  headerActionTextCompact: { fontSize: 14 },
  primaryText: { color: colors.onSurfaceInverse, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.base },
  hero: { paddingTop: 64, paddingBottom: 72, gap: 32 },
  heroMobile: { paddingTop: 34, paddingBottom: 44, gap: 24 },
  heroDesktop: { flexDirection: "row", alignItems: "center", gap: 56, paddingTop: 88, paddingBottom: 96 },
  heroCopy: { flex: 1 },
  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  badgeMobile: { paddingHorizontal: 11, paddingVertical: 7 },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  badgeText: { color: colors.onSurface, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.sm },
  badgeTextMobile: { fontSize: 13 },
  heroTitle: { marginTop: spacing.xl, color: colors.onSurface, fontFamily: fonts.display, fontSize: 42, lineHeight: 47, letterSpacing: -1.2, fontWeight: "800" },
  heroTitleMobile: { marginTop: 20, fontSize: 36, lineHeight: 40, letterSpacing: -1.1 },
  heroTitleNarrow: { fontSize: 32, lineHeight: 36, letterSpacing: -0.9 },
  heroTitleDesktop: { fontSize: 58, lineHeight: 62, letterSpacing: -2 },
  heroBody: { marginTop: spacing.lg, maxWidth: 680, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 17, lineHeight: 26 },
  heroBodyMobile: { marginTop: 16, fontSize: 16, lineHeight: 23 },
  heroActions: { marginTop: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  heroActionsMobile: { marginTop: 20 },
  primary: { minHeight: 50, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.onSurface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryMobile: { width: "100%", minHeight: 52 },
  secondary: { minHeight: 50, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.onSurface, fontFamily: fonts.text, fontWeight: "800", fontSize: fontSize.base },
  heroVisual: { flex: 0.82, minHeight: 430, borderRadius: radius.xl, padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.glassBorder, overflow: "hidden" },
  heroVisualMobile: { flex: 0, minHeight: 0, padding: 20, borderRadius: 26 },
  visualTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  visualEyebrow: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  livePillMobile: { paddingHorizontal: 9, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  visualTitle: { marginTop: 28, color: colors.onSurface, fontFamily: fonts.display, fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.7 },
  visualTitleMobile: { marginTop: 22, fontSize: 27, lineHeight: 32, letterSpacing: -0.6 },
  visualText: { marginTop: 12, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 },
  visualTextMobile: { fontSize: 15, lineHeight: 21 },
  signalRow: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signalRowMobile: { marginTop: 20, gap: 7 },
  signal: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  signalText: { color: colors.onSurface, fontWeight: "700", fontSize: 12 },
  orbit: { flex: 1, minHeight: 130, marginTop: 18, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  orbitMobile: { flex: 0, height: 104, minHeight: 104, marginTop: 18 },
  orbitDot: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: colors.onSurface },
  orbitDotAccent: { backgroundColor: colors.accent, width: 22, height: 22, borderRadius: 11 },
  orbitLine: { position: "absolute", width: "70%", height: 1, backgroundColor: colors.borderStrong, top: 62, left: "10%", transform: [{ rotate: "12deg" }] },
  orbitLineTwo: { width: "55%", top: 86, left: "30%", transform: [{ rotate: "-18deg" }] },
  section: { paddingVertical: 68 },
  sectionMobile: { paddingVertical: 44 },
  eyebrow: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  sectionTitle: { marginTop: 10, maxWidth: 760, color: colors.onSurface, fontFamily: fonts.display, fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.9 },
  sectionTitleMobile: { fontSize: 30, lineHeight: 35, letterSpacing: -0.7 },
  sectionTitleNarrow: { fontSize: 28, lineHeight: 33 },
  grid: { marginTop: 30, flexDirection: "row", flexWrap: "wrap", gap: 14 },
  gridMobile: { marginTop: 22, gap: 12 },
  card: { width: "100%", minHeight: 220, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardMobile: { minHeight: 0, padding: 20, borderRadius: 24 },
  cardDesktop: { width: "48.8%" },
  iconBox: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  iconBoxMobile: { width: 40, height: 40, borderRadius: 20 },
  cardTitle: { marginTop: 24, color: colors.onSurface, fontFamily: fonts.display, fontSize: 21, lineHeight: 25, fontWeight: "800" },
  cardTitleMobile: { marginTop: 16, fontSize: 20, lineHeight: 24 },
  cardText: { marginTop: 9, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: fontSize.base, lineHeight: 21 },
  cardTextMobile: { fontSize: 15, lineHeight: 21 },
  steps: { marginTop: 30, borderTopWidth: 1, borderColor: colors.borderStrong },
  stepsMobile: { marginTop: 22 },
  step: { flexDirection: "row", gap: spacing.xl, paddingVertical: 24, borderBottomWidth: 1, borderColor: colors.borderStrong },
  stepMobile: { gap: 16, paddingVertical: 20 },
  stepNumber: { width: 44, color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  stepNumberMobile: { width: 34 },
  stepBody: { flex: 1 },
  stepTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: "800" },
  stepTitleMobile: { fontSize: 20, lineHeight: 24 },
  stepText: { marginTop: 7, maxWidth: 760, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 },
  stepTextMobile: { fontSize: 15, lineHeight: 21 },
  privacyBlock: { marginVertical: 44, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.accent, flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  privacyBlockMobile: { marginVertical: 28, padding: 20, borderRadius: 24, flexDirection: "column", gap: 16 },
  privacyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  privacyIconMobile: { width: 42, height: 42, borderRadius: 21 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  privacyTitleMobile: { fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  privacyText: { marginTop: 8, color: colors.onSurface, opacity: 0.72, fontSize: fontSize.base, lineHeight: 22 },
  privacyTextMobile: { fontSize: 15, lineHeight: 21 },
  cta: { marginTop: 72, marginBottom: 64, alignItems: "center", paddingVertical: 56, paddingHorizontal: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.onSurface },
  ctaMobile: { marginTop: 44, marginBottom: 40, paddingVertical: 36, paddingHorizontal: 20, borderRadius: 26 },
  ctaTitle: { maxWidth: 760, textAlign: "center", color: colors.onSurfaceInverse, fontFamily: fonts.display, fontSize: 36, lineHeight: 42, fontWeight: "800", letterSpacing: -1 },
  ctaTitleMobile: { fontSize: 28, lineHeight: 33, letterSpacing: -0.7 },
  ctaText: { marginTop: 10, maxWidth: 620, textAlign: "center", color: "rgba(251,251,250,0.65)", fontSize: fontSize.base, lineHeight: 22 },
  ctaTextMobile: { fontSize: 15, lineHeight: 21 },
  ctaButton: { marginTop: 24, minHeight: 50, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", gap: 10 },
  ctaButtonMobile: { width: "100%", justifyContent: "center" },
  footer: { minHeight: 76, borderTopWidth: 1, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footerMobile: { minHeight: 64 },
  footerBrand: { color: colors.onSurface, fontSize: 12, fontWeight: "900", letterSpacing: 2.4 },
  footerText: { color: colors.onSurfaceSecondary, fontSize: 12 },
});