import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useApp } from "@/src/emergent/AppContext";
import { radius, spacing } from "@/src/emergent/tokens";
import { Badge, Glass, LangToggle, PillButton, ThemeToggle, Txt } from "@/src/emergent/ui";

const DESKTOP_MAX = 1280;
const HERO_IMG_DARK = "https://images.pexels.com/photos/9665187/pexels-photo-9665187.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1200";
const HERO_IMG_LIGHT = "https://images.unsplash.com/photo-1738300332814-225c81707b1b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function LandingDesktop() {
  const { colors, theme, t } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const compact = width < 1180;

  const navItems = [
    ["benefits", t.nav.benefits],
    ["difference", t.nav.difference],
    ["how", t.nav.how],
    ["features", t.nav.features],
    ["stats", t.nav.stats],
    ["reviews", t.nav.reviews],
    ["security", t.nav.security],
    ["faq", t.nav.faq],
  ] as const;

  const register = (key: string) => (e: any) => {
    positions.current[key] = e.nativeEvent.layout.y;
  };
  const jump = (key: string) => scrollRef.current?.scrollTo({ y: Math.max((positions.current[key] || 0) - 86, 0), animated: true });

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Glass intensity={70} style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerInner}>
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: colors.brand }]}><Ionicons name="pulse" size={18} color={colors.onBrandPrimary} /></View>
            <Txt variant="h3" weight="extrabold">{t.brand}</Txt>
          </View>
          <View style={[styles.nav, compact && styles.navCompact]}>
            {navItems.map(([key, label]) => (
              <Pressable key={key} onPress={() => jump(key)} style={[styles.navItem, { borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}>
                <Txt variant="label" weight="semibold">{label}</Txt>
              </Pressable>
            ))}
          </View>
          <View style={styles.controls}>
            <LangToggle />
            <ThemeToggle />
            <Pressable onPress={() => router.push("/auth")} style={[styles.login, { borderColor: colors.borderStrong }]}>
              <Txt variant="label" weight="bold">{t.common.login}</Txt>
            </Pressable>
          </View>
        </View>
      </Glass>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Badge label={t.hero.badge} icon="sparkles" />
              <Txt variant="display" style={styles.heroTitle}>{t.hero.title}</Txt>
              <Txt variant="body" color={colors.muted} style={styles.heroDescription}>{t.hero.description}</Txt>
              <View style={styles.heroActions}>
                <View style={{ width: 240 }}><PillButton label={t.common.startFree} onPress={() => router.push("/register")} size="lg" icon="arrow-forward" full /></View>
                <View style={{ width: 230 }}><PillButton label={t.common.tryDemo} variant="secondary" onPress={() => router.push("/demo" as any)} size="lg" full /></View>
              </View>
              <View style={styles.heroProof}>
                {t.stats.items.slice(0, 3).map((item) => (
                  <View key={item.label} style={styles.proofCell}>
                    <Txt variant="h2" weight="extrabold" color={colors.brand}>{item.value}</Txt>
                    <Txt variant="label" color={colors.muted}>{item.label}</Txt>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.heroMedia}>
              <Image source={{ uri: theme === "dark" ? HERO_IMG_DARK : HERO_IMG_LIGHT }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme === "dark" ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.2)" }]} />
              <Glass intensity={70} style={[styles.aiCard, { borderColor: colors.border }]}>
                <View style={styles.aiHead}>
                  <View style={[styles.aiIcon, { backgroundColor: colors.brand }]}><Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="label" weight="bold">{t.hero.demoCardTitle}</Txt>
                    <Txt variant="label" color={colors.muted}>{t.hero.demoCardSubtitle}</Txt>
                  </View>
                  <Badge label={t.hero.demoTag} />
                </View>
                <Txt variant="body" style={{ marginTop: spacing.md }}>{t.hero.demoInsight}</Txt>
                <View style={styles.metrics}>
                  <View style={[styles.metric, { backgroundColor: colors.surfaceTertiary }]}><Txt variant="label" color={colors.muted}>{t.hero.demoMetricA}</Txt><Txt variant="h2" color={colors.brand}>68 bpm</Txt></View>
                  <View style={[styles.metric, { backgroundColor: colors.surfaceTertiary }]}><Txt variant="label" color={colors.muted}>{t.hero.demoMetricB}</Txt><Txt variant="h2" color={colors.info}>5.4 h</Txt></View>
                </View>
              </Glass>
            </View>
          </View>

          <SectionBlock onLayout={register("benefits")} eyebrow="01" title={t.benefits.title} subtitle={t.benefits.subtitle} colors={colors}>
            <View style={styles.grid4}>{t.benefits.items.map((x) => <InfoCard key={x.title} item={x} colors={colors} />)}</View>
          </SectionBlock>

          <SectionBlock onLayout={register("difference")} eyebrow="02" title={t.difference.title} subtitle={t.difference.subtitle} colors={colors}>
            <View style={styles.grid2}>
              <View style={[styles.compare, { backgroundColor: colors.brand }]}><Txt variant="h2" color={colors.onBrandPrimary}>{t.difference.aida}</Txt>{t.difference.points.map((p) => <Point key={p} text={p} good colors={colors} />)}</View>
              <View style={[styles.compare, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Txt variant="h2" color={colors.muted}>{t.difference.others}</Txt>{t.difference.othersPoints.map((p) => <Point key={p} text={p} colors={colors} />)}</View>
            </View>
          </SectionBlock>

          <SectionBlock onLayout={register("how")} eyebrow="03" title={t.how.title} subtitle={t.how.subtitle} colors={colors}>
            <View style={styles.grid3}>{t.how.steps.map((s, i) => <View key={s.title} style={[styles.step, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={[styles.stepNum, { backgroundColor: colors.brand }]}><Txt variant="h3" color={colors.onBrandPrimary}>{i + 1}</Txt></View><Txt variant="h3">{s.title}</Txt><Txt variant="caption" color={colors.muted}>{s.desc}</Txt></View>)}</View>
          </SectionBlock>

          <SectionBlock onLayout={register("features")} eyebrow="04" title={t.features.title} subtitle={t.features.subtitle} colors={colors}>
            <View style={styles.grid3}>{t.features.items.map((x) => <InfoCard key={x.title} item={x} colors={colors} />)}</View>
          </SectionBlock>

          <SectionBlock onLayout={register("stats")} eyebrow="05" title={t.stats.title} subtitle={t.stats.subtitle} colors={colors}>
            <View style={[styles.stats, { backgroundColor: colors.surfaceSecondary }]}>{t.stats.items.map((s) => <View key={s.label} style={styles.stat}><Txt variant="display" color={colors.brand}>{s.value}</Txt><Txt variant="body" color={colors.muted}>{s.label}</Txt></View>)}</View>
          </SectionBlock>

          <SectionBlock onLayout={register("reviews")} eyebrow="06" title={t.reviews.title} subtitle={t.reviews.subtitle} colors={colors}>
            <View style={styles.grid3}>{t.reviews.items.slice(0, 3).map((r) => <View key={r.name} style={[styles.review, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={styles.stars}>{[0,1,2,3,4].map((n) => <Ionicons key={n} name="star" size={16} color={colors.brand} />)}</View><Txt variant="body">{r.text}</Txt><Txt variant="label" weight="bold">{r.name}</Txt><Txt variant="label" color={colors.muted}>{r.role}</Txt></View>)}</View>
          </SectionBlock>

          <SectionBlock onLayout={register("security")} eyebrow="07" title={t.security.title} subtitle={t.security.subtitle} colors={colors}>
            <View style={styles.grid3}>{t.security.items.map((x) => <InfoCard key={x.title} item={x} colors={colors} />)}</View>
          </SectionBlock>

          <SectionBlock onLayout={register("faq")} eyebrow="08" title={t.faq.title} subtitle={t.faq.subtitle} colors={colors}>
            <View style={styles.grid2}>{t.faq.items.map((f) => <View key={f.q} style={[styles.faq, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Txt variant="h3">{f.q}</Txt><Txt variant="caption" color={colors.muted}>{f.a}</Txt></View>)}</View>
          </SectionBlock>

          <View style={[styles.cta, { backgroundColor: colors.brand }]}>
            <View><Txt variant="display" color={colors.onBrandPrimary}>{t.finalCta.title}</Txt><Txt variant="body" color="rgba(255,255,255,.82)" style={{ marginTop: 10 }}>{t.finalCta.subtitle}</Txt></View>
            <View style={{ width: 260 }}><PillButton label={t.common.startFree} variant="secondary" onPress={() => router.push("/register")} size="lg" full /></View>
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}><View style={styles.brand}><View style={[styles.logo, { backgroundColor: colors.brand }]}><Ionicons name="pulse" size={18} color={colors.onBrandPrimary} /></View><Txt variant="h3" weight="extrabold">{t.brand}</Txt></View><Txt variant="caption" color={colors.muted}>{t.footer.tagline}</Txt><Txt variant="label" color={colors.muted}>{t.footer.rights}</Txt></View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionBlock({ children, eyebrow, title, subtitle, onLayout, colors }: any) {
  return <View style={styles.section} onLayout={onLayout}><Txt variant="label" weight="bold" color={colors.brand}>{eyebrow}</Txt><View style={styles.sectionHead}><Txt variant="h1" style={styles.sectionTitle}>{title}</Txt><Txt variant="body" color={colors.muted} style={styles.sectionSubtitle}>{subtitle}</Txt></View>{children}</View>;
}
function InfoCard({ item, colors }: any) { return <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={[styles.cardIcon, { backgroundColor: colors.brandSecondary }]}><Ionicons name={item.icon as any} size={24} color={colors.brand} /></View><Txt variant="h3">{item.title}</Txt><Txt variant="caption" color={colors.muted}>{item.desc}</Txt></View>; }
function Point({ text, good, colors }: any) { return <View style={styles.point}><Ionicons name={good ? "checkmark-circle" : "close-circle"} size={20} color={good ? colors.onBrandPrimary : colors.muted} /><Txt variant="caption" color={good ? colors.onBrandPrimary : colors.muted} style={{ flex: 1 }}>{text}</Txt></View>; }

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  headerInner: { width: "100%", maxWidth: DESKTOP_MAX, alignSelf: "center", minHeight: 82, paddingHorizontal: 32, flexDirection: "row", alignItems: "center", gap: 22 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }, logo: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  nav: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 7 }, navCompact: { gap: 4 }, navItem: { height: 34, paddingHorizontal: 11, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  controls: { flexDirection: "row", gap: 8, alignItems: "center", flexShrink: 0 }, login: { height: 40, paddingHorizontal: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: "center" },
  scroll: { paddingTop: 82, paddingBottom: 60 }, page: { width: "100%", maxWidth: DESKTOP_MAX, alignSelf: "center", paddingHorizontal: 32 },
  hero: { minHeight: 650, paddingVertical: 70, flexDirection: "row", alignItems: "center", gap: 58 }, heroCopy: { flex: 0.94 }, heroTitle: { fontSize: 66, lineHeight: 72, marginTop: 22, maxWidth: 620 }, heroDescription: { fontSize: 20, lineHeight: 30, marginTop: 22, maxWidth: 570 }, heroActions: { flexDirection: "row", gap: 14, marginTop: 32 }, heroProof: { flexDirection: "row", gap: 30, marginTop: 38 }, proofCell: { minWidth: 105, gap: 2 },
  heroMedia: { flex: 1.06, height: 510, borderRadius: 32, overflow: "hidden", justifyContent: "flex-end", padding: 24 }, aiCard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth * 2, padding: 22 }, aiHead: { flexDirection: "row", alignItems: "center", gap: 12 }, aiIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" }, metrics: { flexDirection: "row", gap: 12, marginTop: 16 }, metric: { flex: 1, borderRadius: 16, padding: 16, gap: 4 },
  section: { paddingVertical: 72 }, sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 48, marginTop: 10, marginBottom: 34 }, sectionTitle: { fontSize: 42, lineHeight: 48, maxWidth: 600 }, sectionSubtitle: { maxWidth: 500, fontSize: 17, lineHeight: 25 },
  grid4: { flexDirection: "row", flexWrap: "wrap", gap: 16 }, grid3: { flexDirection: "row", flexWrap: "wrap", gap: 18 }, grid2: { flexDirection: "row", gap: 20 },
  card: { flexGrow: 1, flexBasis: 260, minHeight: 190, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, gap: 12 }, cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compare: { flex: 1, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth * 2, padding: 32, gap: 18 }, point: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  step: { flex: 1, minWidth: 290, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth * 2, padding: 26, gap: 14 }, stepNum: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", borderRadius: 28, padding: 34 }, stat: { flex: 1, gap: 8, alignItems: "center" },
  review: { flex: 1, minWidth: 300, minHeight: 220, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, gap: 14 }, stars: { flexDirection: "row", gap: 3 },
  faq: { flex: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, gap: 10 },
  cta: { marginTop: 60, borderRadius: 32, padding: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 30 },
  footer: { marginTop: 60, paddingVertical: 34, borderTopWidth: StyleSheet.hairlineWidth * 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
});