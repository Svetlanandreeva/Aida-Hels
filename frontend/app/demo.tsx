import React, { useState } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/src/emergent/AppContext";
import { fontSize, radius, spacing, CONTENT_MAX } from "@/src/emergent/tokens";
import { Txt, PulseDot, shadow, ThemeToggle } from "@/src/emergent/ui";

export default function Demo() {
  const { colors, theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const d = t.demo;
  const [tasks, setTasks] = useState(d.tasks.map((task) => ({ ...task })));

  const toggleTask = (index: number) => {
    void Haptics.selectionAsync();
    setTasks((previous) => previous.map((task, taskIndex) => (
      taskIndex === index ? { ...task, done: !task.done } : task
    )));
  };

  const done = tasks.filter((task) => task.done).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.headerInner}>
          <Pressable testID="demo-back-button" onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Txt variant="h3">{d.title}</Txt>
          <ThemeToggle />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing["3xl"], alignItems: "center" }}>
        <View style={styles.contentWrap}>
          <Animated.View entering={FadeInDown.springify()} style={[styles.profileCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.brandSecondary }]}>
              <Ionicons name="person" size={26} color={colors.brand} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Txt variant="label" color={colors.muted} weight="semibold">{d.profile}</Txt>
              <Txt variant="h3">{d.name}</Txt>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.brandSecondary }]}>
              <PulseDot color={colors.brand} />
            </View>
          </Animated.View>

          <View style={styles.scoreRow}>
            <Animated.View entering={FadeInDown.delay(60).springify()} style={[styles.scoreCard, { backgroundColor: colors.surfaceInverse }]}>
              <View style={[styles.ring, { borderColor: colors.brand }]}>
                <Txt variant="display" color={colors.brand} style={{ fontSize: 34, lineHeight: 38 }}>82</Txt>
              </View>
              <Txt variant="label" color={colors.onSurfaceInverse} weight="bold" style={{ marginTop: spacing.sm }}>{d.healthScore}</Txt>
              <Txt variant="label" color={colors.success} weight="bold">{d.scoreStatus}</Txt>
            </Animated.View>

            <View style={{ flex: 1, gap: spacing.sm }}>
              {d.metrics.map((metric, index) => (
                <Animated.View
                  key={metric.label}
                  entering={FadeInDown.delay(80 + index * 50).springify()}
                  style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Txt variant="label" color={colors.muted} weight="semibold">{metric.label}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                    <Txt variant="h3">{metric.value}</Txt>
                    {metric.unit ? <Txt variant="label" color={colors.muted} style={{ marginLeft: 4 }}>{metric.unit}</Txt> : null}
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>

          <Txt variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>{d.insightsTitle}</Txt>
          <View style={{ gap: spacing.md }}>
            {d.insights.map((insight, index) => (
              <Animated.View
                key={insight.title}
                entering={FadeInDown.delay(index * 60).springify()}
                style={[styles.insightCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, shadow("#000")]}
              >
                <View style={[styles.insightIcon, { backgroundColor: colors.brandSecondary }]}>
                  <Ionicons name={insight.icon as any} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Txt variant="h3" style={{ fontSize: fontSize.lg, flex: 1 }}>{insight.title}</Txt>
                    <View style={[styles.insightTag, { backgroundColor: colors.brandSecondary }]}>
                      <Txt variant="label" weight="bold" color={colors.onBrandSecondary}>{insight.tag}</Txt>
                    </View>
                  </View>
                  <Txt variant="caption" color={colors.muted} style={{ marginTop: 4 }}>{insight.desc}</Txt>
                </View>
              </Animated.View>
            ))}
          </View>

          <View style={styles.tasksHeader}>
            <Txt variant="h2">{d.tasksTitle}</Txt>
            <Txt variant="label" weight="bold" color={colors.brand}>{done}/{tasks.length}</Txt>
          </View>
          <View style={{ gap: spacing.sm }}>
            {tasks.map((task, index) => (
              <Pressable
                key={task.title}
                testID={`demo-task-${index}`}
                onPress={() => toggleTask(index)}
                style={[styles.taskRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.check, { borderColor: task.done ? colors.brand : colors.borderStrong, backgroundColor: task.done ? colors.brand : "transparent" }]}>
                  {task.done ? <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Txt variant="caption" weight="semibold" style={{ textDecorationLine: task.done ? "line-through" : "none", color: task.done ? colors.muted : colors.onSurface }}>
                    {task.title}
                  </Txt>
                </View>
                <View style={[styles.timeChip, { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name="time-outline" size={13} color={colors.muted} />
                  <Txt variant="label" color={colors.muted} weight="semibold" style={{ marginLeft: 4 }}>{task.time}</Txt>
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable testID="demo-back-cta" onPress={() => router.back()} style={[styles.backCta, { borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={16} color={colors.brand} />
            <Txt variant="caption" weight="bold" color={colors.brand} style={{ marginLeft: 8 }}>{t.common.backToLanding}</Txt>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  headerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },
  contentWrap: { width: "100%", maxWidth: CONTENT_MAX, padding: spacing.xl },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  profileCard: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tag: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  scoreRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  scoreCard: { width: 150, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", justifyContent: "center" },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 6, alignItems: "center", justifyContent: "center" },
  metricCard: { flex: 1, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: "center" },
  insightCard: { flexDirection: "row", borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  insightIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  insightTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginLeft: spacing.sm },
  tasksHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  taskRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  timeChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  backCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.xl, paddingVertical: 14, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
});
