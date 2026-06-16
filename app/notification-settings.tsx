import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelAllScheduledNotifications, scheduleDailyStreakReminder } from '@/services/notificationService';

export const NOTIF_PREFS_KEY = 'tikboost_notif_prefs';

export interface NotifPreferences {
  daily_streak: boolean;
  boost_complete: boolean;
  referral_bonus: boolean;
  admin_broadcast: boolean;
  vip_expiry: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPreferences = {
  daily_streak: true,
  boost_complete: true,
  referral_bonus: true,
  admin_broadcast: true,
  vip_expiry: true,
};

export async function getNotifPrefs(): Promise<NotifPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTIF_PREFS };
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

export async function saveNotifPrefs(prefs: NotifPreferences): Promise<void> {
  await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
}

interface SettingItem {
  key: keyof NotifPreferences;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
}

const SETTINGS: SettingItem[] = [
  {
    key: 'daily_streak',
    title: 'Daily Streak Reminder',
    description: 'Reminder at 8 PM to log in and keep your streak alive',
    icon: 'local-fire-department',
    iconColor: Colors.warning,
  },
  {
    key: 'boost_complete',
    title: 'Boost Complete Alerts',
    description: 'Notified when your active boosts finish delivering',
    icon: 'rocket-launch',
    iconColor: Colors.primary,
  },
  {
    key: 'referral_bonus',
    title: 'Referral Bonuses',
    description: 'Alert when a friend joins using your referral code',
    icon: 'people',
    iconColor: Colors.info,
  },
  {
    key: 'admin_broadcast',
    title: 'Admin Broadcasts',
    description: 'Important announcements and updates from TikBoost team',
    icon: 'campaign',
    iconColor: Colors.purple,
  },
  {
    key: 'vip_expiry',
    title: 'VIP Expiry Warnings',
    description: 'Reminder 3 days before your VIP membership expires',
    icon: 'workspace-premium',
    iconColor: Colors.gold,
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [prefs, setPrefs] = useState<NotifPreferences>({ ...DEFAULT_NOTIF_PREFS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getNotifPrefs().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const handleToggle = async (key: keyof NotifPreferences, value: boolean) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setSaving(true);
    await saveNotifPrefs(newPrefs);

    // Re-schedule or cancel daily streak based on toggle
    if (key === 'daily_streak') {
      if (value) {
        await scheduleDailyStreakReminder();
      } else {
        // Cancel only the streak notification
        const { default: Notifications } = await import('expo-notifications');
        try {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          for (const n of scheduled) {
            if (n.content.data?.type === 'daily_streak') {
              await Notifications.cancelScheduledNotificationAsync(n.identifier);
            }
          }
        } catch {}
      }
    }

    setSaving(false);
  };

  const handleDisableAll = async () => {
    showAlert(
      'Disable All Notifications',
      'This will turn off all TikBoost notifications. You can re-enable them anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable All',
          style: 'destructive',
          onPress: async () => {
            const allOff: NotifPreferences = {
              daily_streak: false,
              boost_complete: false,
              referral_bonus: false,
              admin_broadcast: false,
              vip_expiry: false,
            };
            setPrefs(allOff);
            await saveNotifPrefs(allOff);
            await cancelAllScheduledNotifications();
          },
        },
      ]
    );
  };

  const handleEnableAll = async () => {
    const allOn: NotifPreferences = {
      daily_streak: true,
      boost_complete: true,
      referral_bonus: true,
      admin_broadcast: true,
      vip_expiry: true,
    };
    setPrefs(allOn);
    setSaving(true);
    await saveNotifPrefs(allOn);
    await scheduleDailyStreakReminder();
    setSaving(false);
    showAlert('All Enabled', 'All notification types have been turned on.');
  };

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notification Settings</Text>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ alignSelf: 'flex-start', marginTop: 2 }} />
          ) : (
            <Text style={styles.subtitle}>{enabledCount} of {SETTINGS.length} enabled</Text>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Status card */}
          <LinearGradient
            colors={enabledCount > 0 ? ['rgba(0,209,126,0.12)', 'transparent'] : ['rgba(255,69,58,0.12)', 'transparent']}
            style={styles.statusCard}
          >
            <MaterialIcons
              name={enabledCount > 0 ? 'notifications-active' : 'notifications-off'}
              size={24}
              color={enabledCount > 0 ? Colors.success : Colors.error}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: enabledCount > 0 ? Colors.success : Colors.error }]}>
                {enabledCount > 0 ? 'Notifications Active' : 'All Notifications Off'}
              </Text>
              <Text style={styles.statusSub}>
                {enabledCount > 0
                  ? `${enabledCount} type${enabledCount !== 1 ? 's' : ''} will send alerts to your device`
                  : 'Re-enable notification types below to stay informed'}
              </Text>
            </View>
          </LinearGradient>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity onPress={handleEnableAll} style={styles.quickBtn} activeOpacity={0.8}>
              <MaterialIcons name="notifications-active" size={16} color={Colors.success} />
              <Text style={[styles.quickBtnText, { color: Colors.success }]}>Enable All</Text>
            </TouchableOpacity>
            <View style={styles.quickDivider} />
            <TouchableOpacity onPress={handleDisableAll} style={styles.quickBtn} activeOpacity={0.8}>
              <MaterialIcons name="notifications-off" size={16} color={Colors.error} />
              <Text style={[styles.quickBtnText, { color: Colors.error }]}>Disable All</Text>
            </TouchableOpacity>
          </View>

          {/* Settings list */}
          <Text style={styles.sectionTitle}>Notification Types</Text>
          <View style={styles.settingsList}>
            {SETTINGS.map((item, index) => {
              const isEnabled = prefs[item.key];
              return (
                <View key={item.key}>
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: item.iconColor + '22' }]}>
                      <MaterialIcons name={item.icon as any} size={20} color={item.iconColor} />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingTitle}>{item.title}</Text>
                      <Text style={styles.settingDesc}>{item.description}</Text>
                    </View>
                    <Switch
                      value={isEnabled}
                      onValueChange={(val) => handleToggle(item.key, val)}
                      trackColor={{ false: Colors.surfaceBorder, true: Colors.primary + '88' }}
                      thumbColor={isEnabled ? Colors.primary : Colors.textMuted}
                      ios_backgroundColor={Colors.surfaceBorder}
                    />
                  </View>
                  {index < SETTINGS.length - 1 && (
                    <View style={styles.settingDivider} />
                  )}
                </View>
              );
            })}
          </View>

          {/* Info note */}
          <View style={styles.infoNote}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoNoteText}>
              Notification delivery depends on your device permissions. If no notifications arrive, check your device settings for TikBoost.
            </Text>
          </View>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  scroll: { padding: Spacing.md },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.xl, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statusTitle: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 2 },
  statusSub: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  quickActions: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.surfaceBorder, overflow: 'hidden',
  },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, paddingVertical: Spacing.md,
  },
  quickDivider: { width: 1, backgroundColor: Colors.surfaceBorder },
  quickBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  settingsList: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    overflow: 'hidden', marginBottom: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm,
  },
  settingDivider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md },
  settingIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  settingDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  infoNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
});
