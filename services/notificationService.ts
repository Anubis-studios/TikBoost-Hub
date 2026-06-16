import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotifPrefs } from '@/app/notification-settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleDailyStreakReminder() {
  try {
    const prefs = await getNotifPrefs();
    if (!prefs.daily_streak) return;

    // Cancel existing streak reminders first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'daily_streak') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Keep Your Streak Alive!',
        body: 'Log in now to maintain your TikBoost daily streak and earn bonus stars!',
        data: { type: 'daily_streak' },
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    });
  } catch (e) {
    // Silently fail if scheduling not supported
  }
}

export async function scheduleBoostCompleteNotification(boostLabel: string, hoursFromNow: number) {
  try {
    const prefs = await getNotifPrefs();
    if (!prefs.boost_complete) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Boost Complete!',
        body: `Your "${boostLabel}" boost has completed! Check your TikTok for new engagement.`,
        data: { type: 'boost_complete' },
      },
      trigger: {
        seconds: hoursFromNow * 3600,
      } as any,
    });
  } catch (e) {
    // Silently fail
  }
}

export async function scheduleVIPExpiryWarning(expiryDate: Date) {
  try {
    const prefs = await getNotifPrefs();
    if (!prefs.vip_expiry) return;

    // Schedule 3 days before expiry
    const warningDate = new Date(expiryDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (warningDate <= new Date()) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'VIP Expiring Soon!',
        body: 'Your TikBoost VIP membership expires in 3 days. Renew now to keep 2x star earning!',
        data: { type: 'vip_expiry' },
      },
      trigger: {
        date: warningDate,
      } as any,
    });
  } catch (e) {
    // Silently fail
  }
}

export async function shouldShowReferralNotification(): Promise<boolean> {
  const prefs = await getNotifPrefs();
  return prefs.referral_bonus;
}

export async function shouldShowAdminBroadcast(): Promise<boolean> {
  const prefs = await getNotifPrefs();
  return prefs.admin_broadcast;
}

export async function sendLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch (e) {
    // Silently fail
  }
}

export async function cancelAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    // Silently fail
  }
}
