import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, Pressable, LayoutChangeEvent, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSharedValue } from "react-native-reanimated";

import { useApp } from "@/src/emergent/AppContext";
import { font, fontSize, radius, spacing, CONTENT_MAX } from "@/src/emergent/tokens";
import {
  Badge,
  DNAHelix,
  Glass,
  LangToggle,
  PillButton,
  PulseDot,
  SectionHeader,
  ThemeToggle,
  Txt,
  AnimatedCounter,
  Reveal,
  RevealProvider,
  shadow,
} from "@/src/emergent/ui";

const HERO_IMG_DARK = "https://images.pexels.com/photos/9665187/pexels-photo-9665187.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const HERO_IMG_LIGHT = "https://images.unsplash.com/photo-1738300332814-225c81707b1b?crop=entropy&cs=srgb&fm=jpg&q=85&w=940";
const HEART_IMG = "https://images.unsplash.com/photo-1761040414033-bb0a07473645?crop=entropy&cs=srgb&fm=jpg&q=85&w=940";

export default function Landing() {
  const { colors, theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const [headerH, setHeaderH] = useState(112);
  const { height: winH, width: winW } = useWindowDimensions();
  const [statsPlay, setStatsPlay] = useState(false);
  const scrollY = useSharedValue(0);
  const heroSize = winW < 360 ? 30 : winW < 720 ? 40 : 46;

  const registerSection = (key: string) => (e: LayoutChangeEvent) => {
    positions.current[key] = e.nativeEvent.layout.y;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.value = y;
    const statsY = positions.current.stats;
    if (statsY != null && !statsPlay && y + winH * 0.82 > statsY) {
      setStatsPlay(true);
    }
  };

  const scrollTo = (key: string) => {
    const y = positions.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - headerH + 4, 0), animated: true });
  };

  const navItems: { key: string; label: string }[] = [
    { key: "benefits", label: t.nav.benefits },
    { key: "difference", label: t.nav.difference },
    { key: "how", label: t.nav.how },
    { key: "features", label: t.nav.features },
    { key: "stats", label: t.nav.stats },
    { key: "reviews", label: t.nav.reviews },
    { key: "security", label: t.nav.security },
    { key: "faq", label: t.nav.faq },
  ];

  const openContacts = () => WebBrowser.openBrowserAsync("https://aidaassistent.ru");
  const goAuth = (mode: "login" | "register") => router.push(mode === "register" ? "/register" : "/auth");

  return (
    <RevealProvider scrollY={scrollY} winH={winH}>
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />

      {/* Sticky glass header */}
      <View style={styles.headerWrap} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <Glass intensity={60} style={[styles.headerGlass, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <View style={[styles.logoDot, { backgroundColor: colors.brand }]}>
                <Ionicons name="pulse" size={16} color={colors.onBrandPrimary} />
              </View>
              <Txt variant="h3" weight="extrabold">{t.brand}</Txt>
            </View>
            <View style={styles.headerControls}>
              <LangToggle />
              <ThemeToggle />
              <Pressable
                testID="header-login-button"
                onPress={() => goAuth("login")}
                style={[styles.loginPill, { borderColor: colors.borderStrong }]}
              >
                <Txt variant="label" weight="bold">{t.common.login}</Txt>
              </Pressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.navScroll}
            contentContainerStyle={styles.navRowContent}
          >
            {navItems.map((n) => (
              <Pressable
                key={n.key}
                testID={`nav-chip-${n.key}`}
                onPress={() => scrollTo(n.key)}
                style={[styles.navChip, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}
              >
                <Txt variant="label" weight="semibold" color={colors.onSurfaceTertiary}>{n.label}</Txt>
              </Pressable>
            ))}
          </ScrollView>
        </Glass>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: spacing["3xl"], alignItems: "center" }}
      >
        <View style={styles.contentWrap}>
        {/* ---------------- HERO ---------------- */}
        <View style={[styles.section, { paddingTop: spacing.xl }]}>
          <Badge label={t.hero.badge} icon="sparkles" />
          <Txt variant="display" style={{ marginTop: spacing.lg, fontSize: heroSize, lineHeight: heroSize + 6 }}>
            {t.hero.title}
          </Txt>
          <Txt variant="body" color={colors.muted} style={{ marginTop: spacing.md }}>
            {t.hero.description}
          </Txt>

          {/* DNA visual with overlay demo card */}
          <View style={styles.heroVisual}>
            <View style={styles.heroVisualBg}>
              <Image
                source={{ uri: theme === "dark" ? HERO_IMG_DARK : HERO_IMG_LIGHT }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={400}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: theme === "dark" ? "rgba(5,5,5,0.42)" : "rgba(245,245,247,0.55)" },
                ]}
              />
              <DNAHelix size={220} />
            </View>

            {/* Floating AI summary card */}
            <Glass intensity={70} style={[styles.demoCard, { borderColor: colors.border }, shadow("#000")]}>
              <View style={styles.demoCardHead}>
                <View style={[styles.demoCardIcon, { backgroundColor: colors.brand }]}>
                  <Ionicons name="sparkles" size={16} color={colors.onBrandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="label" weight="bold">{t.hero.demoCardTitle}</Txt>
                  <Txt variant="label" color={colors.muted} weight="medium">{t.hero.demoCardSubtitle}</Txt>
                </View>
                <View style={[styles.tagChip, { backgroundColor: colors.brandSecondary }]}>
                  <PulseDot color={colors.brand} />
                  <Txt variant="label" weight="bold" color={colors.onBrandSecondary} style={{ marginLeft: 6 }}>
                    {t.hero.demoTag}
                  </Txt>
                </View>
              </View>
              <Txt variant="caption" style={{ marginTop: spacing.md }}>{t.hero.demoInsight}</Txt>
              <View style={styles.demoMetricsRow}>
                <View style={[styles.demoMetric, { backgroundColor: colors.surfaceTertiary }]}>
                  <Txt variant="label" color={colors.muted}>{t.hero.demoMetricA}</Txt>
                  <Txt variant="h3" color={colors.brand}>68 <Txt variant="label" color={colors.muted}>bpm</Txt></Txt>
                </View>
                <View style={[styles.demoMetric, { backgroundColor: colors.surfaceTertiary }]}>
                  <Txt variant="label" color={colors.muted}>{t.hero.demoMetricB}</Txt>
                  <Txt variant="h3" color={colors.info}>5.4 <Txt variant="label" color={colors.muted}>h</Txt></Txt>
                </View>
              </View>
            </Glass>
          </View>

          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <PillButton testID="hero-start-button" label={t.common.startFree} onPress={() => goAuth("register")} size="lg" icon="arrow-forward" full />
            <PillButton testID="hero-demo-button" label={t.common.tryDemo} variant="secondary" onPress={() => router.push("/auth")} size="lg" full />
          </View>
        </View>

        {/* ---------------- BENEFITS ---------------- */}
        <View style={styles.section} onLayout={registerSection("benefits")}>
          <SectionHeader eyebrow="01" title={t.benefits.title} subtitle={t.benefits.subtitle} />
          <View style={styles.grid2}>
            {t.benefits.items.map((b) => (
              <Reveal
                key={b.title}
                style={[styles.benefitCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.iconBadge, { backgroundColor: colors.brandSecondary }]}>
                  <Ionicons name={b.icon as any} size={22} color={colors.brand} />
                </View>
                <Txt variant="h3" style={{ marginTop: spacing.md }}>{b.title}</Txt>
                <Txt variant="caption" color={colors.muted} style={{ marginTop: 6 }}>{b.desc}</Txt>
              </Reveal>
            ))}
          </View>
        </View>

        {/* ---------------- DIFFERENCE ---------------- */}
        <View style={styles.section} onLayout={registerSection("difference")}>
          <SectionHeader eyebrow="02" title={t.difference.title} subtitle={t.difference.subtitle} />
          <View style={styles.compareRow}>
            <View style={[styles.compareCol, { backgroundColor: colors.brand }]}>
              <Txt variant="h3" color={colors.onBrandPrimary}>{t.difference.aida}</Txt>
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {t.difference.points.map((p) => (
                  <View key={p} style={styles.compareItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.onBrandPrimary} />
                    <Txt variant="caption" color={colors.onBrandPrimary} style={styles.compareTxt}>{p}</Txt>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.compareCol, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 }]}>
              <Txt variant="h3" color={colors.muted}>{t.difference.others}</Txt>
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {t.difference.othersPoints.map((p) => (
                  <View key={p} style={styles.compareItem}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                    <Txt variant="caption" color={colors.muted} style={styles.compareTxt}>{p}</Txt>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <View style={styles.section} onLayout={registerSection("how")}>
          <SectionHeader eyebrow="03" title={t.how.title} subtitle={t.how.subtitle} />
          <View>
            {t.how.steps.map((s, i) => (
              <Reveal key={s.title} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, { backgroundColor: colors.brand }]}>
                    <Txt variant="label" weight="extrabold" color={colors.onBrandPrimary}>{i + 1}</Txt>
                  </View>
                  {i < t.how.steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: colors.border }]} /> : null}
                </View>
                <View style={[styles.stepCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Txt variant="h3">{s.title}</Txt>
                  <Txt variant="caption" color={colors.muted} style={{ marginTop: 4 }}>{s.desc}</Txt>
                </View>
              </Reveal>
            ))}
          </View>
        </View>

        {/* ---------------- FEATURES ---------------- */}
        <View style={styles.section} onLayout={registerSection("features")}>
          <SectionHeader eyebrow="04" title={t.features.title} subtitle={t.features.subtitle} />
          <View style={styles.grid2}>
            {t.features.items.map((f) => (
              <Reveal
                key={f.title}
                style={[styles.featureCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.iconBadge, { backgroundColor: colors.brandSecondary }]}>
                  <Ionicons name={f.icon as any} size={20} color={colors.brand} />
                </View>
                <Txt variant="label" weight="bold" style={{ marginTop: spacing.sm, fontSize: fontSize.lg }}>{f.title}</Txt>
                <Txt variant="label" color={colors.muted} weight="medium" style={{ marginTop: 4, lineHeight: 17 }}>{f.desc}</Txt>
              </Reveal>
            ))}
          </View>
        </View>

        {/* ---------------- SHOWCASE IMAGE ---------------- */}
        <View style={styles.section}>
          <Reveal style={styles.showcase}>
            <Image source={{ uri: HEART_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.85)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.showcaseContent}>
              <View style={styles.showcaseChip}>
                <Ionicons name="pulse" size={14} color="#FFFFFF" />
                <Txt variant="label" weight="bold" color="#FFFFFF" style={{ marginLeft: 6 }}>{t.showcase.badge}</Txt>
              </View>
              <Txt variant="h1" color="#FFFFFF" style={{ marginTop: spacing.md }}>{t.showcase.title}</Txt>
              <Txt variant="caption" color="rgba(255,255,255,0.88)" style={{ marginTop: 8 }}>{t.showcase.desc}</Txt>
            </View>
          </Reveal>
        </View>

        {/* ---------------- STATS ---------------- */}
        <View style={styles.section} onLayout={registerSection("stats")}>
          <View style={[styles.statsWrap, { backgroundColor: theme === "dark" ? colors.surfaceSecondary : colors.surfaceInverse }]}>
            <Txt variant="h1" color={theme === "dark" ? colors.onSurface : colors.onSurfaceInverse}>{t.stats.title}</Txt>
            <Txt variant="caption" color={colors.muted} style={{ marginTop: 8 }}>{t.stats.subtitle}</Txt>
            <View style={styles.statsGrid}>
              {t.stats.items.map((s) => (
                <View key={s.label} style={styles.statCell}>
                  <AnimatedCounter value={s.value} play={statsPlay} color={colors.brand} size={44} />
                  <Txt variant="caption" color={theme === "dark" ? colors.muted : "rgba(255,255,255,0.7)"} style={{ marginTop: 4 }}>{s.label}</Txt>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ---------------- REVIEWS ---------------- */}
        <View onLayout={registerSection("reviews")}>
          <View style={[styles.section, { paddingBottom: spacing.md }]}>
            <SectionHeader eyebrow="05" title={t.reviews.title} subtitle={t.reviews.subtitle} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.md }}
            snapToInterval={296}
            decelerationRate="fast"
          >
            {t.reviews.items.map((r) => (
              <View key={r.name} style={[styles.reviewCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={styles.stars}>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Ionicons key={k} name="star" size={14} color={colors.brand} />
                  ))}
                </View>
                <Txt variant="caption" style={{ marginTop: spacing.md, flex: 1 }}>{r.text}</Txt>
                <View style={styles.reviewFooter}>
                  <View style={[styles.avatar, { backgroundColor: colors.brandSecondary }]}>
                    <Ionicons name="person" size={18} color={colors.brand} />
                  </View>
                  <View style={{ marginLeft: spacing.sm }}>
                    <Txt variant="label" weight="bold">{r.name}</Txt>
                    <Txt variant="label" color={colors.muted} weight="medium">{r.role}</Txt>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ---------------- SECURITY ---------------- */}
        <View style={styles.section} onLayout={registerSection("security")}>
          <SectionHeader eyebrow="06" title={t.security.title} subtitle={t.security.subtitle} />
          <View style={{ gap: spacing.md }}>
            {t.security.items.map((s) => (
              <Reveal key={s.title} style={[styles.securityRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={[styles.iconBadge, { backgroundColor: colors.brandSecondary }]}>
                  <Ionicons name={s.icon as any} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Txt variant="h3" style={{ fontSize: fontSize.lg }}>{s.title}</Txt>
                  <Txt variant="caption" color={colors.muted} style={{ marginTop: 2 }}>{s.desc}</Txt>
                </View>
              </Reveal>
            ))}
          </View>
        </View>

        {/* ---------------- FAQ ---------------- */}
        <View style={styles.section} onLayout={registerSection("faq")}>
          <SectionHeader eyebrow="07" title={t.faq.title} subtitle={t.faq.subtitle} />
          <View style={{ gap: spacing.sm }}>
            {t.faq.items.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} index={i} />
            ))}
          </View>
        </View>

        {/* ---------------- FINAL CTA ---------------- */}
        <View style={styles.section}>
          <View style={[styles.ctaCard, { backgroundColor: colors.brand }, shadow(colors.brand)]}>
            <DNAHelixMini />
            <Txt variant="h1" color={colors.onBrandPrimary} center>{t.finalCta.title}</Txt>
            <Txt variant="body" color="rgba(255,255,255,0.85)" center style={{ marginTop: spacing.md }}>
              {t.finalCta.subtitle}
            </Txt>
            <View style={{ alignSelf: "stretch", marginTop: spacing.xl }}>
              <Pressable
                testID="final-cta-button"
                onPress={() => goAuth("register")}
                style={[styles.ctaButton, { backgroundColor: colors.onBrandPrimary }]}
              >
                <Txt variant="h3" color={colors.brand} style={{ fontSize: fontSize.lg }}>{t.common.startFree}</Txt>
                <Ionicons name="arrow-forward" size={18} color={colors.brand} style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ---------------- FOOTER ---------------- */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.brandRow}>
            <View style={[styles.logoDot, { backgroundColor: colors.brand }]}>
              <Ionicons name="pulse" size={16} color={colors.onBrandPrimary} />
            </View>
            <Txt variant="h3" weight="extrabold">{t.brand}</Txt>
          </View>
          <Txt variant="caption" color={colors.muted} style={{ marginTop: spacing.sm }}>{t.footer.tagline}</Txt>
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <FooterLink label={t.footer.privacy} onPress={() => router.push("/privacy-policy")} testID="footer-privacy" />
            <FooterLink label={t.footer.terms} onPress={() => router.push("/terms")} testID="footer-terms" />
            <FooterLink label={t.footer.contacts} onPress={openContacts} testID="footer-contacts" />
          </View>
          <Txt variant="label" color={colors.muted} weight="medium" style={{ marginTop: spacing.xl }}>{t.footer.rights}</Txt>
        </View>
        </View>
      </ScrollView>
    </View>
    </RevealProvider>
  );
}

/* ---------------- sub components ---------------- */

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const { colors } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      testID={`faq-item-${index}`}
      onPress={() => {
        Haptics.selectionAsync();
        setOpen((o) => !o);
      }}
      style={[styles.faqItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={styles.faqHead}>
        <Txt variant="h3" style={{ fontSize: fontSize.lg, flex: 1, paddingRight: spacing.md }}>{q}</Txt>
        <Ionicons name={open ? "remove" : "add"} size={22} color={colors.brand} />
      </View>
      {open ? <Txt variant="caption" color={colors.muted} style={{ marginTop: spacing.md }}>{a}</Txt> : null}
    </Pressable>
  );
}

function FooterLink({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { colors } = useApp();
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.footerLink} hitSlop={6}>
      <Txt variant="caption" weight="semibold">{label}</Txt>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function DNAHelixMini() {
  return (
    <View style={{ opacity: 0.4, marginBottom: spacing.md }}>
      <DNAHelix size={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 },
  headerGlass: { paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    height: 48,
    width: "100%",
    maxWidth: CONTENT_MAX,
    alignSelf: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoDot: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  headerControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  loginPill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  navScroll: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },
  navRowContent: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingTop: spacing.sm },
  navChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexShrink: 0,
  },

  section: { paddingHorizontal: spacing.xl, paddingTop: spacing["3xl"] },
  contentWrap: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },

  heroVisual: { marginTop: spacing.xl, alignItems: "center" },
  heroVisualBg: {
    width: "100%",
    height: 260,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  demoCard: {
    position: "absolute",
    bottom: -28,
    left: spacing.md,
    right: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    overflow: "hidden",
  },
  demoCardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  demoCardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tagChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  demoMetricsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  demoMetric: { flex: 1, borderRadius: radius.md, padding: spacing.md },

  grid2: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  benefitCard: {
    width: "47%",
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  iconBadge: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },

  compareRow: { gap: spacing.md },
  compareCol: { borderRadius: radius.lg, padding: spacing.xl },
  compareItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  compareTxt: { flex: 1 },

  stepRow: { flexDirection: "row", gap: spacing.md },
  stepRail: { alignItems: "center", width: 32 },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
  stepCard: {
    flex: 1,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },

  featureCard: {
    width: "47%",
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },

  statsWrap: { borderRadius: radius.lg, padding: spacing.xl },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.xl, rowGap: spacing.xl },
  statCell: { width: "50%", paddingRight: spacing.sm },

  showcase: {
    height: 320,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  showcaseContent: { padding: spacing.xl },
  showcaseChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  reviewCard: {
    width: 280,
    minHeight: 200,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  stars: { flexDirection: "row", gap: 2 },
  reviewFooter: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },

  faqItem: { borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  faqHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  ctaCard: { borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", overflow: "hidden" },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: radius.pill,
  },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing["3xl"], marginTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  footerLink: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});

