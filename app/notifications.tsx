import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function NotificationsScreen() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useUser();
  const router = useRouter();

  const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
    boost: { icon: 'rocket-launch', color: Colors.primary },
    referral: { icon: 'share', color: Colors.purple },
    streak: { icon: 'local-fire-department', color: Colors.warning },
    vip: { icon: 'workspace-premium', color: Colors.gold },
    general: { icon: 'notifications', color: Colors.info },
  };

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  const renderItem = ({ item }: { item: typeof notifications[0] }) => {
    const cfg = TYPE_ICONS[item.type] || TYPE_ICONS.general;
    return (
      <TouchableOpacity
        onPress={() => markNotificationRead(item.id)}
        style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
        activeOpacity={0.8}
      >
        {!item.isRead && <View style={styles.unreadDot} />}
        <View style={[styles.notifIcon, { backgroundColor: cfg.color + '22' }]}>
          <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>{item.title}</Text>
          <Text style={styles.notifBody}>{item.body}</Text>
          <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllNotificationsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="notifications-none" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySub}>Complete tasks and boost your profile to receive updates</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  markAllBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  markAllText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  list: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    position: 'relative',
  },
  notifCardUnread: {
    backgroundColor: 'rgba(255,45,85,0.04)',
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  unreadDot: {
    position: 'absolute',
    top: Spacing.md + 8,
    left: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  notifTitleUnread: { color: Colors.textPrimary, fontWeight: '700' },
  notifBody: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: Colors.textMuted },
  separator: { height: 1, backgroundColor: Colors.surfaceBorder },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
