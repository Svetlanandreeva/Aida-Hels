import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { Muted, PrimaryButton, Chip } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useLog } from "@/src/components/LogProvider";
import { api, Task } from "@/src/api";
import { scheduleTaskReminder, cancelTaskReminder } from "@/src/notifications";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const TYPE_ICON: Record<string, any> = {
  medication: "medkit-outline",
  pressure: "heart-outline",
  lab: "water-outline",
  upload: "cloud-upload-outline",
  diary: "create-outline",
  visit: "medical-outline",
  measurement: "fitness-outline",
  custom: "ellipse-outline",
};

const ACTION_ROUTES: Record<string, string | undefined> = {
  medication: "/medications",
  pressure: "/pressure",
  diary: "/mind",
  lab: "/labs",
  upload: "/documents",
  visit: "/medical-card",
  measurement: "/measurements",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();
  const { toast } = useLog();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("custom");
  const [due, setDue] = useState(todayStr());
  const [reminderTime, setReminderTime] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) {
      setTasks([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    try {
      setLoadError(false);
      setTasks(await api.listTasks(activeId));
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = async (id: string) => {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;

    const optimisticDone = !current.done;
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, done: optimisticDone, status: optimisticDone ? "done" : "pending" } : x)));

    try {
      const updated = await api.toggleTask(id);
      if (updated.done) {
        await cancelTaskReminder(current.notification_id);
      } else if (updated.reminder_at && new Date(updated.reminder_at).getTime() > Date.now()) {
        const notificationId = await scheduleTaskReminder({
          title: updated.title,
          reminderAt: updated.reminder_at,
          route: updated.action_route || ACTION_ROUTES[updated.kind],
          taskId: updated.id,
        });
        if (notificationId) {
          await api.updateTask(updated.id, { notification_id: notificationId });
        }
      }
      await load();
    } catch (_) {
      await load();
    }
    bumpRefresh();
  };

  const del = async (id: string) => {
    const current = tasks.find((task) => task.id === id);
    setTasks((prev) => prev.filter((x) => x.id !== id));
    await cancelTaskReminder(current?.notification_id);
    await api.deleteTask(id).catch(() => {});
  };

  const openAction = (task: Task) => {
    const route = task.action_route || ACTION_ROUTES[task.kind];
    if (route) router.push(route as any);
  };

  const save = async () => {
    if (!title.trim() || !activeId || !isIsoDate(due)) return;
    if (reminderTime && !isTime(reminderTime)) return;

    const reminderAt = reminderTime ? `${due}T${reminderTime}:00` : null;
    const actionRoute = ACTION_ROUTES[kind] || null;

    setSaving(true);
    try {
      const created = await api.createTask({
        profile_id: activeId,
        title: title.trim(),
        kind,
        due,
        reminder_at: reminderAt,
        action_route: actionRoute,
      });

      if (reminderAt) {
        const notificationId = await scheduleTaskReminder({
          title: created.title,
          reminderAt,
          route: created.action_route || actionRoute,
          taskId: created.id,
        });
        if (notificationId) {
          await api.updateTask(created.id, { notification_id: notificationId });
        } else {
          toast(lang === "ru" ? "Задача сохранена, но системное напоминание не включено" : "Task saved, but system reminder is not enabled");
        }
      }

      setTitle("");
      setKind("custom");
      setDue(todayStr());
      setReminderTime("");
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const td = todayStr();
  const active = tasks.filter((x) => !x.done && x.status !== "cancelled");
  const today = active.filter((x) => (x.due || td).slice(0, 10) <= td);
  const upcoming = active.filter((x) => (x.due || td).slice(0, 10) > td);
  const done = tasks.filter((x) => x.done || x.status === "done");

  const renderTask = (task: Task) => {
    const actionable = Boolean(task.action_route || ACTION_ROUTES[task.kind]);
    return (
      <View key={task.id} style={styles.taskRow} testID={`task-${task.id}`}>
        <Pressable onPress={() => toggle(task.id)} hitSlop={8} testID={`toggle-task-${task.id}`}>
          <Ionicons name={task.done ? "checkmark-circle" : "ellipse-outline"} size={26} color={task.done ? colors.success : colors.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.taskIcon}>
          <Ionicons name={TYPE_ICON[task.kind] || TYPE_ICON.custom} size={16} color={colors.onSurface} />
        </View>
        <Pressable style={styles.taskCopy} disabled={!actionable || task.done} onPress={() => openAction(task)} testID={`open-task-${task.id}`}>
          <View style={styles.taskTitleRow}>
            <Text style={[styles.taskTitle, task.done && styles.taskDone]} numberOfLines={2}>{task.title}</Text>
            {actionable && !task.done ? <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /> : null}
          </View>
          <View style={styles.metaRow}>
            {task.due ? <View style={styles.metaChip}><Ionicons name="calendar-outline" size={12} color={colors.onSurfaceSecondary} /><Text style={styles.metaText}>{task.due.slice(0, 10)}</Text></View> : null}
            {task.reminder_at ? <View style={styles.metaChip}><Ionicons name="notifications-outline" size={12} color={colors.onSurfaceSecondary} /><Text style={styles.metaText}>{task.reminder_at.slice(11, 16)}</Text></View> : null}
          </View>
        </Pressable>
        <Pressable onPress={() => del(task.id)} hitSlop={8} testID={`delete-task-${task.id}`}>
          <Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>
    );
  };

  const Section: React.FC<{ label: string; items: Task[] }> = ({ label, items }) =>
    items.length ? (
      <View style={{ marginBottom: spacing.xl }}>
        <Text style={styles.sectionLabel}>{label} · {items.length}</Text>
        <View style={styles.sectionCard}>{items.map(renderTask)}</View>
      </View>
    ) : null;

  const dueValid = isIsoDate(due);
  const reminderValid = !reminderTime || isTime(reminderTime);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TopBar subtitle={t("tab_tasks")} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
        >
          <Pressable style={styles.addCard} onPress={() => setOpen(true)} testID="add-task-button">
            <View style={styles.addIcon}><Ionicons name="add" size={24} color={colors.surfaceSecondary} /></View>
            <View style={styles.addCopy}>
              <Text style={styles.addTitle}>{t("add_task")}</Text>
              <Text style={styles.addSubtitle}>{lang === "ru" ? "Задача откроет нужное действие и может напомнить в заданное время" : "A task opens the right action and can remind you at a chosen time"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.surfaceSecondary} />
          </Pressable>

          {loadError ? (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={52} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyTitle}>{lang === "ru" ? "Не удалось загрузить задачи" : "Couldn't load tasks"}</Text>
              <Muted style={{ marginTop: spacing.sm, textAlign: "center" }}>{lang === "ru" ? "Проверьте соединение и потяните экран вниз, чтобы повторить." : "Check your connection and pull down to retry."}</Muted>
            </View>
          ) : !activeId ? (
            <View style={styles.empty}>
              <Ionicons name="person-circle-outline" size={52} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyTitle}>{lang === "ru" ? "Сначала создайте профиль" : "Create a profile first"}</Text>
              <Muted style={{ marginTop: spacing.sm, textAlign: "center" }}>{lang === "ru" ? "Задачи будут привязаны к выбранному профилю." : "Tasks will be linked to the selected profile."}</Muted>
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: spacing.md }}>{t("tasks_empty")}</Muted>
            </View>
          ) : (
            <>
              <Section label={t("tasks_today")} items={today} />
              <Section label={t("tasks_upcoming")} items={upcoming} />
              <Section label={t("tasks_done")} items={done} />
            </>
          )}
        </ScrollView>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="task-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("add_task")}</Text>
        <Text style={styles.fieldLabel}>{t("task_title")}</Text>
        <TextInput testID="task-title-input" value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={colors.onSurfaceSecondary} />

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{t("task_type")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {[
            { k: "medication", l: t("m_meds") },
            { k: "pressure", l: t("measure_pressure") },
            { k: "diary", l: t("fill_diary") },
            { k: "measurement", l: lang === "ru" ? "Измерение" : "Measurement" },
            { k: "lab", l: t("m_labs") },
            { k: "visit", l: lang === "ru" ? "Приём врача" : "Doctor visit" },
            { k: "custom", l: lang === "ru" ? "Другое" : "Other" },
          ].map((o) => <Chip key={o.k} label={o.l} active={kind === o.k} onPress={() => setKind(o.k)} testID={`task-kind-${o.k}`} />)}
        </ScrollView>

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{lang === "ru" ? "Дата" : "Date"}</Text>
        <TextInput testID="task-due-input" value={due} onChangeText={setDue} style={[styles.input, !dueValid && styles.inputError]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" />
        {!dueValid ? <Text style={styles.errorText}>{lang === "ru" ? "Формат: YYYY-MM-DD" : "Use YYYY-MM-DD"}</Text> : null}

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{lang === "ru" ? "Напомнить в" : "Remind at"}</Text>
        <TextInput testID="task-reminder-input" value={reminderTime} onChangeText={setReminderTime} style={[styles.input, !reminderValid && styles.inputError]} placeholder="HH:MM" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" />
        <Muted style={{ marginTop: spacing.sm }}>{lang === "ru" ? "Можно оставить пустым. При первом напоминании приложение попросит разрешение на уведомления." : "Optional. The app will ask for notification permission when needed."}</Muted>
        {!reminderValid ? <Text style={styles.errorText}>{lang === "ru" ? "Формат: 09:30" : "Use a time like 09:30"}</Text> : null}

        <PrimaryButton label={t("save")} onPress={save} loading={saving} disabled={!title.trim() || !dueValid || !reminderValid} testID="save-task" style={{ marginTop: spacing.lg }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addCard: { minHeight: 82, borderRadius: radius.xl, backgroundColor: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  addCopy: { flex: 1 },
  addTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.surfaceSecondary, fontFamily: fonts.text },
  addSubtitle: { marginTop: 3, fontSize: fontSize.sm, lineHeight: 18, color: "rgba(255,255,255,0.68)", fontFamily: fonts.text },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing["3xl"], paddingHorizontal: spacing.xl },
  emptyTitle: { marginTop: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text, textAlign: "center" },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, fontFamily: fonts.text },
  sectionCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: spacing.lg },
  taskRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  taskIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  taskCopy: { flex: 1 },
  taskTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  taskTitle: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500", fontFamily: fonts.text },
  taskDone: { color: colors.onSurfaceSecondary, textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 5 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surface },
  metaText: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  input: { height: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.text },
  inputError: { borderColor: colors.error },
  errorText: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.error, fontFamily: fonts.text },
});