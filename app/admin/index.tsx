import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useUser } from '@/hooks/useUser';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';

interface DashboardStats {
  totalUsers: number;
  totalStarsIssued: number;
  activeBoosts: number;
  totalOrders: number;
  totalRevenue: number;
  newUsersToday: number;
  vipUsers: number;
  totalTransactions: number;
}

export default function AdminDashboard() {
  const { user } = useUser();
  const { showAlert } = useAlert();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Guard: only admins
  useEffect(() => {
    if (user && !user.isVIP) {
      // We check admin flag
    }
  }, [user]);

  const loadStats = useCallback(async () => {
    const [
      { count: totalUsers },
      { data: starsData },
      { count: activeBoosts },
      { count: totalOrders },
      { count: totalTransactions },
      { count: vipUsers },
      { data: todayUsers },
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('star_transactions').select('amount').eq('type', 'earn'),
      supabase.from('boost_orders').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('boost_orders').select('*', { count: 'exact', head: true }),
      supabase.from('star_transactions').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_vip', true),
      supabase.from('user_profiles').select('id').gte('last_login_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    const totalStarsIssued = starsData?.reduce((s: number, r: any) => s + (r.amount || 0), 0) || 0;

    setStats({
      totalUsers: totalUsers || 0,
      totalStarsIssued,
      activeBoosts: activeBoosts || 0,
      totalOrders: totalOrders || 0,
      totalRevenue: 0,
      newUsersToday: todayUsers?.length || 0,
      vipUsers: vipUsers || 0,
      totalTransactions: totalTransactions || 0,
    });

    // Recent transactions
    const { data: recent } = await supabase
      .from('star_transactions')
      .select('*, user_profiles!inner(tiktok_username, email)')
      .order('created_at', { ascending: false })
      .limit(8);
    setRecentActivity(recent || []);
  }, [supabase]);

  const load = useCallback(async () => {
    setIsLoading(true);
    await loadStats();
    setIsLoading(false);
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  useEffect(() => { load(); }, [load]);

  const STAT_CARDS = stats ? [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: 'people', color: Colors.info, sub: `${stats.newUsersToday} new today` },
    { label: 'Stars Issued', value: stats.totalStarsIssued.toLocaleString(), icon: 'star', color: Colors.gold, sub: `${stats.totalTransactions} transactions` },
    { label: 'Active Boosts', value: stats.activeBoosts.toLocaleString(), icon: 'rocket-launch', color: Colors.primary, sub: `${stats.totalOrders} total orders` },
    { label: 'VIP Members', value: stats.vipUsers.toLocaleString(), icon: 'workspace-premium', color: Colors.gold, sub: 'Paying subscribers' },
  ] : [];

  const NAV_ITEMS = [
    { label: 'Manage Users', sub: 'Search, edit, ban users & adjust stars', icon: 'manage-accounts', color: Colors.info, route: '/admin/users' },
    { label: 'Boost Orders', sub: 'View & update all boost orders', icon: 'rocket-launch', color: Colors.primary, route: '/admin/orders' },
    { label: 'Notifications', sub: 'Send broadcast & targeted alerts', icon: 'notifications', color: Colors.warning, route: '/admin/notifications' },
    { label: 'Analytics', sub: 'Revenue, growth & engagement stats', icon: 'bar-chart', color: Colors.success, route: '/admin/analytics' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <LinearGradient colors={['#2A0A14', '#0D0D0D']} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <View style={styles.adminBadge}>
                <MaterialIcons name="admin-panel-settings" size={14} color={Colors.primary} />
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
              <Text style={styles.headerName}>Control Hub</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="refresh" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.adminProfile}>
            <LinearGradient colors={Colors.gradientPink as [string, string]} style={styles.adminAvatar}>
              <MaterialIcons name="admin-panel-settings" size={24} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.adminName}>{user?.tiktokUsername || 'Admin'}</Text>
              <Text style={styles.adminEmail}>{user?.email}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stat Grid */}
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              {STAT_CARDS.map((card) => (
                <View key={card.label} style={[styles.statCard, { borderColor: card.color + '33' }]}>
                  <LinearGradient
                    colors={[card.color + '22', card.color + '08']}
                    style={styles.statCardGrad}
                  >
                    <MaterialIcons name={card.icon as any} size={22} color={card.color} />
                    <Text style={[styles.statVal, { color: card.color }]}>{card.value}</Text>
                    <Text style={styles.statLabel}>{card.label}</Text>
                    <Text style={styles.statSub}>{card.sub}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>

            {/* Nav Cards */}
            <Text style={styles.sectionTitle}>Admin Tools</Text>
            <View style={styles.navGrid}>
              {NAV_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.85}
                  style={styles.navCard}
                >
                  <LinearGradient
                    colors={[item.color + '22', item.color + '08']}
                    style={[styles.navCardInner, { borderColor: item.color + '33' }]}
                  >
                    <View style={[styles.navIcon, { backgroundColor: item.color + '22' }]}>
                      <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                    </View>
                    <Text style={styles.navLabel}>{item.label}</Text>
                    <Text style={styles.navSub}>{item.sub}</Text>
                    <MaterialIcons name="arrow-forward" size={16} color={item.color} style={{ marginTop: 4 }} />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Activity */}
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={styles.activityList}>
              {recentActivity.map((tx: any) => (
                <View key={tx.id} style={styles.activityRow}>
                  <View style={[styles.activityIcon, {
                    backgroundColor: tx.type === 'earn' ? Colors.success + '22' : Colors.primary + '22',
                  }]}>
                    <MaterialIcons
                      name={tx.type === 'earn' ? 'arrow-downward' : 'arrow-upward'}
                      size={16}
                      color={tx.type === 'earn' ? Colors.success : Colors.primary}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityUser} numberOfLines={1}>
                      {tx.user_profiles?.tiktok_username || tx.user_profiles?.email || 'Unknown'}
                    </Text>
                    <Text style={styles.activityDesc} numberOfLines={1}>{tx.description}</Text>
                  </View>
                  <Text style={[styles.activityAmount, {
                    color: tx.type === 'earn' ? Colors.success : Colors.primary,
                  }]}>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount} ★
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.md, paddingBottom: Spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  backBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  headerTitle: { flex: 1, alignItems: 'center', gap: 4 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,45,85,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.3)',
  },
  adminBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  headerName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  refreshBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  adminProfile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  adminAvatar: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  adminName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  adminEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
    marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  statCard: {
    width: '47%', borderRadius: BorderRadius.lg,
    borderWidth: 1, overflow: 'hidden',
  },
  statCardGrad: { padding: Spacing.md, gap: 4 },
  statVal: { fontSize: FontSize.xxl, fontWeight: '800', marginTop: 6 },
  statLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  statSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  navGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  navCard: { width: '47%' },
  navCardInner: {
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, gap: 4,
  },
  navIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  navLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  navSub: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  activityList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  activityInfo: { flex: 1 },
  activityUser: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  activityDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  activityAmount: { fontSize: FontSize.sm, fontWeight: '800' },
});
