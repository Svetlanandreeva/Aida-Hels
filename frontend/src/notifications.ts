import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "aida-reminders";

export type NotificationPermissionState = "granted" | "denied" | "undetermined" | "unavailable";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: "Aida reminders", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200] });
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === "web") return "unavailable";
  await ensureAndroidChannel();
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return "granted";
  if (permission.status === Notifications.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === "web") return "unavailable";
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) return "granted";
  if (requested.status === Notifications.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

async function ensureReminderPermission(): Promise<boolean> {
  return (await requestNotificationPermission()) === "granted";
}

export async function scheduleTaskReminder(input: { title: string; reminderAt: string; route?: string | null; taskId?: string | null; showDetails?: boolean }): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const date = new Date(input.reminderAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  if (!(await ensureReminderPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: "Аида · Напоминание", body: input.showDetails ? input.title : "Откройте Аиду, чтобы посмотреть напоминание", data: { url: input.route || "/(tabs)/tasks", taskId: input.taskId || undefined }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}) },
  });
}

export async function scheduleBedtimeReminder(input: { date: string; time: string }): Promise<string | null> {
  if (Platform.OS === "web" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return null;
  const at = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return null;
  if (!(await ensureReminderPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: "Аида · Пора готовиться ко сну", body: "Вы планировали лечь спать сейчас. Отметить отход ко сну?", data: { url: "/sleep-rhythm", rhythmAction: "bedtime" }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}) },
  });
}

export async function schedulePersonalSleepWindowReminder(input: { date: string; time: string; windowStart?: string | null; windowEnd: string }): Promise<string | null> {
  if (Platform.OS === "web" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return null;
  let at = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() <= Date.now()) {
    at = new Date(at.getTime() + 24 * 60 * 60 * 1000);
  }
  if (!(await ensureReminderPermission())) return null;
  const window = input.windowStart ? `${input.windowStart}–${input.windowEnd}` : input.windowEnd;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Аида · Ваш ритм сна",
      body: `По вашим данным самочувствие чаще было лучше, когда сон начинался примерно в ${window}. Если вам комфортно, можно постепенно завершать день.`,
      data: { url: "/sleep-rhythm", personalizedSleep: true },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}) },
  });
}

export async function scheduleMedicationDoseAt(input: { medicationId: string; name: string; dose?: string | null; date: string; time: string; showDetails?: boolean }): Promise<string | null> {
  if (Platform.OS === "web" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return null;
  const at = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return null;
  if (!(await ensureReminderPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Аида · Лекарство",
      body: input.showDetails ? [input.name, input.dose].filter(Boolean).join(" · ") : "Откройте Аиду, чтобы посмотреть напоминание",
      data: { url: "/medications", medicationId: input.medicationId, scheduledTime: input.time, adaptive: true },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}) },
  });
}

export async function scheduleMedicationReminders(input: { medicationId: string; name: string; dose?: string | null; times: string[]; showDetails?: boolean }): Promise<string[]> {
  if (Platform.OS === "web") return [];
  const validTimes = [...new Set((input.times || []).filter((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))];
  if (!validTimes.length || !(await ensureReminderPermission())) return [];
  const ids: string[] = [];
  for (const time of validTimes) {
    const [hour, minute] = time.split(":").map(Number);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: "Аида · Лекарство", body: input.showDetails ? [input.name, input.dose].filter(Boolean).join(" · ") : "Откройте Аиду, чтобы посмотреть напоминание", data: { url: "/medications", medicationId: input.medicationId, scheduledTime: time }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}) },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelNotificationIds(ids?: string[] | null) {
  if (Platform.OS === "web") return;
  await Promise.all((ids || []).filter(Boolean).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

export async function cancelTaskReminder(notificationId?: string | null) {
  if (!notificationId || Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

export async function cancelAllAidaReminders() {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
