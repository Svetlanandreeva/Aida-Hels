import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Polyline } from "react-native-svg";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted } from "@/src/components/ui";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { getLabTrends, LabTrendSeries } from "@/src/labTrendsApi";
import { colors, fontSize, fonts, radius, spacing, statusColor } from "@/src/theme";

const CHART_HEIGHT = 118;

function TrendChart({ series, width }: { series: LabTrendSeries; width: number }) {
  const points = series.points;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const padX = 8;
  const padY = 14;
  const usableWidth = Math.max(1, width - padX * 2);
  const usableHeight = CHART_HEIGHT - padY * 2;

  const coords = points.map((p, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * usableWidth;
    const y = range === 0
      ? CHART_HEIGHT / 2
      : padY + ((max - p.value) / range) * usableHeight;
    return { x, y, point: p };
  });

  return (
    <View style={{ marginTop: spacing.md }}>
      <Svg width={width} height={CHART_HEIGHT}>
        <Polyline
          points={coords.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={colors.onSurface}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((p, index) => (
          <Circle
            key={`${p.point.date}-${index}`}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={statusColor(p.point.status)}
            stroke={colors.surfaceSecondary}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View style={styles.chartDates}>
        <Text style={styles.chartDate}>{points[0]?.date || ""}</Text>
        <Text style={styles.chartDate}>{points[points.length - 1]?.date || ""}</Text>
      </View>
    </View>
  );
}

export default function LabTrendsScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const [series, setSeries] = useState<LabTrendSeries[]>([]);
  const [labCount, setLabCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setSeries([]);
      setLabCount(0);
      setLoading(false);
      return;
    }
    setLoadError(false);
    try {
      const data = await getLabTrends(activeId);
      setSeries(data.series || []);
      setLabCount(data.lab_count || 0);
    } catch (_) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const chartWidth = Math.max(220, screenWidth - spacing.lg * 2 - spacing.xl * 2 - 2);

  return (
    <View style={styles.container}>
      <ScreenHeader title={lang === "ru" ? "Тренды показателей" : "Biomarker trends"} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : !activeId ? (
        <State
          icon="person-circle-outline"
          title={lang === "ru" ? "Выберите профиль" : "Choose a profile"}
          text={lang === "ru" ? "Тренды строятся отдельно для каждого профиля." : "Trends are calculated separately for each profile."}
        />
      ) : loadError ? (
        <View style={styles.center}>
          <State
            icon="cloud-offline-outline"
            title={lang === "ru" ? "Не удалось загрузить тренды" : "Could not load trends"}
            text={lang === "ru" ? "Данные анализов не изменены. Попробуйте ещё раз." : "Your lab data is unchanged. Please try again."}
          />
          <Pressable style={styles.retry} onPress={load} testID="lab-trends-retry">
            <Text style={styles.retryText}>{lang === "ru" ? "Повторить" : "Retry"}</Text>
          </Pressable>
        </View>
      ) : series.length === 0 ? (
        <State
          icon="analytics-outline"
          title={lang === "ru" ? "Пока нечего сравнивать" : "Nothing to compare yet"}
          text={
            labCount < 2
              ? (lang === "ru" ? "Нужно минимум два анализа с повторяющимся числовым показателем." : "You need at least two lab reports with the same numeric biomarker.")
              : (lang === "ru" ? "В загруженных анализах пока нет повторяющихся числовых показателей с совместимыми единицами." : "No repeated numeric biomarkers with compatible units were found yet.")
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 36 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={styles.introTitle}>{lang === "ru" ? `${series.length} показателей с историей` : `${series.length} biomarkers with history`}</Text>
            <Muted style={styles.introText}>{lang === "ru" ? "Графики показывают только значения из ваших анализов. Референсы не пересчитываются Аидой." : "Charts use only values from your lab reports. Aida does not recalculate reference ranges."}</Muted>
          </View>

          <View style={{ gap: spacing.md }}>
            {series.map((item) => {
              const deltaText = item.delta === 0
                ? "0"
                : `${item.delta > 0 ? "+" : ""}${item.delta}`;
              return (
                <Card key={item.key} testID={`trend-${item.key}`}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Muted>{item.count} {lang === "ru" ? "измерения" : "measurements"}</Muted>
                    </View>
                    <View style={styles.latestWrap}>
                      <Text style={[styles.latest, { color: statusColor(item.latest.status) }]}>
                        {item.latest.raw_value ?? item.latest.value} {item.unit || ""}
                      </Text>
                      <Text style={styles.delta}>{lang === "ru" ? "к прошлому" : "vs previous"}: {deltaText} {item.unit || ""}</Text>
                    </View>
                  </View>

                  <TrendChart series={item} width={chartWidth} />

                  <View style={styles.infoRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(item.latest.status) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoTitle}>{lang === "ru" ? "Последний результат" : "Latest result"} · {item.latest.date}</Text>
                      <Text style={styles.infoText}>
                        {item.latest.reference
                          ? `${lang === "ru" ? "Референс лаборатории" : "Lab reference"}: ${item.latest.reference}`
                          : (lang === "ru" ? "Референс в анализе не указан" : "No reference range in this report")}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function State({ icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}><Ionicons name={icon} size={30} color={colors.onSurfaceSecondary} /></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Muted style={styles.stateText}>{text}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  stateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  stateTitle: { marginTop: spacing.lg, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, textAlign: "center" },
  stateText: { marginTop: spacing.sm, textAlign: "center", lineHeight: 20 },
  retry: { marginTop: spacing.lg, backgroundColor: colors.onSurface, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  retryText: { color: colors.onSurfaceInverse, fontWeight: "700", fontFamily: fonts.text },
  intro: { marginBottom: spacing.lg },
  introTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  introText: { marginTop: spacing.sm, lineHeight: 20 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  name: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  latestWrap: { alignItems: "flex-end", maxWidth: "48%" },
  latest: { fontSize: fontSize.lg, fontWeight: "800", fontFamily: fonts.text, textAlign: "right" },
  delta: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text, textAlign: "right" },
  chartDates: { flexDirection: "row", justifyContent: "space-between", marginTop: -2 },
  chartDate: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  infoRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  infoTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  infoText: { marginTop: 2, fontSize: fontSize.sm, lineHeight: 18, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
});
