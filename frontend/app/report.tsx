import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Muted } from "@/src/components/ui";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, statusColor } from "@/src/theme";

const PERIODS = [
  { days: 30, key: "days_30" },
  { days: 90, key: "days_90" },
  { days: 365, key: "days_365" },
];

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { t, lang } = useI18n();

  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const r = await api.report(profileId, days, lang);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }, [profileId, days, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const p = report?.profile;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("report_title")}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="close-report">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((per) => (
          <Pressable
            key={per.days}
            testID={`period-${per.days}`}
            onPress={() => setDays(per.days)}
            style={[styles.periodChip, days === per.days ? styles.periodActive : styles.periodInactive]}
          >
            <Text style={[styles.periodText, days === per.days && { color: colors.onBrandPrimary }]}>{t(per.key)}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.onSurface} />
          <Muted style={{ marginTop: spacing.md }}>{t("report_generating")}</Muted>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {p && (
            <Card>
              <Text style={styles.profileName}>{p.name}</Text>
              <Muted>
                {t("period")}: {report.since} → {t("today").toLowerCase()}
              </Muted>
              <View style={styles.chipWrap}>
                {(p.allergies || []).length > 0 && (
                  <Text style={styles.metaText}>{t("allergies")}: {p.allergies.join(", ")}</Text>
                )}
                {(p.chronic_conditions || []).length > 0 && (
                  <Text style={styles.metaText}>{t("chronic")}: {p.chronic_conditions.join(", ")}</Text>
                )}
              </View>
            </Card>
          )}

          {report?.ai_summary ? (
            <Card style={styles.aiCard}>
              <View style={styles.aiHead}>
                <Ionicons name="sparkles" size={16} color={colors.onSurface} />
                <Text style={styles.aiTitle}>{t("ai_observations")}</Text>
              </View>
              <Text style={styles.aiText}>{report.ai_summary}</Text>
            </Card>
          ) : null}

          <Text style={styles.factsLabel}>{t("facts")}</Text>

          <Section icon="medkit-outline" title={t("medications")}>
            {report?.medications?.length ? (
              report.medications.map((m: any) => (
                <Row key={m.id} left={m.name} right={[m.dose, m.schedule].filter(Boolean).join(" · ") || "—"} />
              ))
            ) : (
              <Muted>{t("no_records")}</Muted>
            )}
          </Section>

          <Section icon="pulse-outline" title={t("symptoms")}>
            {report?.symptoms?.length ? (
              report.symptoms.map((s: any) => (
                <Row key={s.id} left={s.name} right={`${s.severity}/10 · ${s.date}`} />
              ))
            ) : (
              <Muted>{t("no_records")}</Muted>
            )}
          </Section>

          <Section icon="water-outline" title={t("labs")}>
            {report?.labs?.length ? (
              report.labs.map((l: any) => (
                <View key={l.id} style={styles.labBlock}>
                  <Text style={styles.labTitle}>{l.title} · {l.date}</Text>
                  {l.biomarkers.map((b: any, i: number) => (
                    <View key={i} style={styles.bioRow}>
                      <Text style={styles.bioName}>{b.name}</Text>
                      <Text style={[styles.bioVal, { color: statusColor(b.status) }]}>
                        {b.value} {b.unit || ""}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <Muted>{t("no_records")}</Muted>
            )}
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

const Section: React.FC<{ icon: any; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card>
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={18} color={colors.onSurface} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={{ gap: spacing.sm }}>{children}</View>
  </Card>
);

const Row: React.FC<{ left: string; right: string }> = ({ left, right }) => (
  <View style={styles.row}>
    <Text style={styles.rowLeft}>{left}</Text>
    <Text style={styles.rowRight}>{right}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5, fontFamily: fonts.display },
  periodRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  periodChip: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  periodActive: { backgroundColor: colors.brandPrimary },
  periodInactive: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  periodText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  chipWrap: { marginTop: spacing.sm, gap: 4 },
  metaText: { fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  aiCard: { backgroundColor: colors.accent, borderColor: colors.accent },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  aiTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  aiText: { fontSize: fontSize.base, color: colors.onSurface, lineHeight: 21, fontFamily: fonts.text },
  factsLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    fontFamily: fonts.text,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  rowLeft: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "600", fontFamily: fonts.text },
  rowRight: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  labBlock: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  labTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm, fontFamily: fonts.text },
  bioRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bioName: { fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  bioVal: { fontSize: fontSize.base, fontWeight: "700", fontFamily: fonts.text },
});
