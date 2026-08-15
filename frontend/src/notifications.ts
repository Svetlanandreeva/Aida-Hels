import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "aida-reminders";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Aida reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleTaskReminder(input: {
  title: string;
  reminderAt: string;
  route?: string | null;
  taskId?: string | null;
}): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const date = new Date(input.reminderAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  if (!(await ensureReminderPermission())) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Аида · Напоминание",
      body: input.title,
      data: {
        url: input.route || "/(tabs)/tasks",
        taskId: input.taskId || undefined,
      },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

export async function cancelTaskReminder(notificationId?: string | null) {
  if (!notificationId || Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
