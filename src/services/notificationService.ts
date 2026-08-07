/**
 * Service for Browser Web Notifications (Notification API) & Sound Cues
 */

import { Reminder } from '../types';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// Set of triggered reminder keys for the current day/time slot: `${reminderId}_${date}_${timeSlot}`
const triggeredRemindersSet = new Set<string>();

/**
 * Sound synthesis helper using Web Audio API
 */
export function playNotificationSound(type: 'chime' | 'gentle' | 'pulse' | 'complete' = 'chime') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'complete') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else if (type === 'pulse') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.2); // D6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    } else if (type === 'gentle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.2); // C#5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    } else {
      // chime (default)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.45);
  } catch {
    // Audio context play silently blocked or unsupported
  }
}

/**
 * Returns current browser notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Requests notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      sendBrowserNotification('Уведомления включены! 🎉', {
        body: 'Вы будете получать своевременные напоминания о приёме лекарств и нутрицевтиков.',
        sound: 'chime',
      });
    }
    return permission as NotificationPermissionState;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return getNotificationPermissionStatus();
  }
}

interface CustomNotificationOptions extends NotificationOptions {
  sound?: 'chime' | 'gentle' | 'pulse' | 'complete';
  onClick?: () => void;
}

/**
 * Sends a browser notification if granted
 */
export function sendBrowserNotification(title: string, options: CustomNotificationOptions = {}): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  // Play sound regardless if possible
  playNotificationSound(options.sound || 'chime');

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notificationOptions: any = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'health-assistant-reminder',
      renotify: true,
      requireInteraction: true,
      body: options.body,
      ...options,
    };
    const notification = new Notification(title, notificationOptions);

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.error('Error instantiating Notification:', err);
    return false;
  }
}

/**
 * Sends a test notification to verify audio & browser popups
 */
export function sendTestNotification(): boolean {
  const status = getNotificationPermissionStatus();
  if (status !== 'granted') {
    requestNotificationPermission();
    return false;
  }

  return sendBrowserNotification('💊 Напоминание приёма: Витамин D3', {
    body: 'Тестовое уведомление Health Assistant. Приём 1 капсулы (5000 ME) запланирован прямо сейчас.',
    sound: 'chime',
    tag: `test-notif-${Date.now()}`,
  });
}

/**
 * Checks active reminders against current local time and triggers browser notifications
 */
export function checkAndTriggerReminders(
  reminders: Reminder[],
  onTrigger?: (reminder: Reminder, slotTime: string) => void
) {
  if (!Array.isArray(reminders) || reminders.length === 0) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`; // "08:00"

  const dateYYYYMMDD = now.toISOString().split('T')[0];
  const dayIndex = now.getDay(); // 0 = Sun, 1 = Mon ...
  const russianDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const currentDayRu = russianDays[dayIndex];

  reminders.forEach((r) => {
    if (!r.isEnabled) return;

    // Check frequency matching
    if (r.frequency === 'once' && r.lastCompletedDate === dateYYYYMMDD) {
      return;
    }

    if (r.frequency === 'weekdays' && (dayIndex === 0 || dayIndex === 6)) {
      return;
    }

    if (r.frequency === 'weekly' || (r.days && r.days.length > 0)) {
      if (r.days && !r.days.includes(currentDayRu)) {
        return;
      }
    }

    // Collect all schedule time slots for this reminder
    const timeSlots: string[] = [];
    if (r.time) timeSlots.push(r.time);

    if (r.schedule) {
      if (r.schedule.morning?.enabled && r.schedule.morning.time) {
        timeSlots.push(r.schedule.morning.time);
      }
      if (r.schedule.afternoon?.enabled && r.schedule.afternoon.time) {
        timeSlots.push(r.schedule.afternoon.time);
      }
      if (r.schedule.evening?.enabled && r.schedule.evening.time) {
        timeSlots.push(r.schedule.evening.time);
      }
    }

    timeSlots.forEach((slotTime) => {
      if (slotTime === currentTimeStr) {
        const triggerKey = `${r.id}_${dateYYYYMMDD}_${slotTime}`;
        if (!triggeredRemindersSet.has(triggerKey)) {
          triggeredRemindersSet.add(triggerKey);

          const title = `💊 Время приёма: ${r.title}`;
          const dosageInfo = r.dosage ? `Дозировка: ${r.dosage}` : (r.notes || 'Запланированный приём');
          const bodyText = `Запланировано на ${slotTime}. ${dosageInfo}`;

          sendBrowserNotification(title, {
            body: bodyText,
            sound: r.sound || 'chime',
            tag: `reminder-${triggerKey}`,
          });

          if (onTrigger) {
            onTrigger(r, slotTime);
          }
        }
      }
    });
  });
}
