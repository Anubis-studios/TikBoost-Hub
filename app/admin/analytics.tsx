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
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface AnalyticsData {
  totalUsers: number;
  vipUsers: number;
  totalStarsEarned: number;
  totalStarsSpent: number;
  totalBoostOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalTransactions: number;
  referralTransactions: number;
  earnTransactions: number;
  spendTransactions: number;
  topEarners: any[];
  categoryBreakdown: Record<string, number>;
  boostTypeBreakdown: { video: number; profile: number };
  recentGrowth: { day: string; users: number }[];
}

const BAR_COLORS = [Colors.primary, Colors.info, Colors.success, Colors.warning, Colors.purple, Colors.gold];

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label} numberOfLines={1}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.value, { color }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 10 },
  label: { width: 80, fontSize: FontSize.xs, color: Colors.textSecondary },
  track: { flex: 1, height: 8, backgroundColor: Colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 48, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'right' },
});

export default function AdminAnalyticsScreen() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [
      { count: totalUsers },
      { count: vipUsers },
      { data: earnData },
      { data: spendData },
      { count: totalOrders },
      { count: activeOrders },
      { count: completedOrders },
      { count: totalTransactions },
      { count: referralTx },
      { data: categoryData },
      { data: boostTypeData },
      { data: topEarners },
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_vip', true),
      supabase.from('star_transactions').select('amount').eq('type', 'earn'),
      supabase.from('star_transactions').select('amount').eq('type', 'spend'),
      supabase.from('boost_orders').select('*', { count: 'exact', head: true }),
      supabase.from('boost_orders').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('boost_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('star_transactions').select('*', { count: 'exact', head: true }),
      supabase.from('star_transactions').select('*', { count: 'exact', head: true }).eq('category', 'referral'),
      supabase.from('star_transactions').select('category, amount'),
      supabase.from('boost_orders').select('boost_type'),
      supabase.from('user_profiles').select('tiktok_username, total_stars_earned, stars, is_vip').order('total_stars_earned', { ascending: false }).limit(5),
    ]);

    const totalStarsEarned = earnData?.reduce((s: number, r: any) => s + (r.amount || 0), 0) || 0;
    const totalStarsSpent = spendData?.reduce((s: number, r: any) => s + (r.amount || 0), 0) || 0;

    // Category breakdown
    const catBreak: Record<string, number> = {};
    for (const row of (categoryData || []) as any[]) {
      catBreak[row.category] = (catBreak[row.category] || 0) + row.amount;
    }

    // Boost type breakdown
    const btBreak = { video: 0, profile: 0 };
    for (const row of (boostTypeData || []) as any[]) {
      if (row.boost_type === 'video') btBreak.video++;
      else if (row.boost_type === 'profile') btBreak.profile++;
    }

    setData({
      totalUsers: totalUsers || 0,
      vipUsers: vipUsers || 0,
      totalStarsEarned,
      totalStarsSpent,
      totalBoostOrders: totalOrders || 0,
      activeOrders: activeOrders || 0,
      completedOrders: completedOrders || 0,
      totalTransactions: totalTransactions || 0,
      referralTransactions: referralTx || 0,
      earnTransactions: earnData?.length || 0,
      spendTransactions: spendData?.length || 0,
      topEarners: topEarners || [],
      categoryBreakdown: catBreak,
      boostTypeBreakdown: btBreak,
      recentGrowth: [],
    });
    setIsLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const KPI = ({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color: string }) => (
    <View style={[styles.kpiCard, { borderColor: color + '33' }]}>
      <LinearGradient colors={[color + '22', color + '08']} style={styles.kpiGrad}>
        <MaterialIcons name={icon as any} size={20} color={color} />
        <Text style={[styles.kpiValue, { color }]}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
        {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
      </LinearGradient>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Analytics</Text>
          <TouchableOpacity onPress={onRefresh}>
            <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
        ) : data ? (
          <>
            {/* KPI Grid */}
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <View style={styles.kpiGrid}>
              <KPI label="Total Users" value={data.totalUsers.toLocaleString()} icon="people" color={Colors.info} sub={`${data.vipUsers} VIP`} />
              <KPI label="Stars Issued" value={data.totalStarsEarned.toLocaleString()} icon="star" color={Colors.gold} sub="All time" />
              <KPI label="Stars Spent" value={data.totalStarsSpent.toLocaleString()} icon="shopping-cart" color={Colors.primary} sub="On boosts" />
              <KPI label="Boost Orders" value={data.totalBoostOrders.toLocaleString()} icon="rocket-launch" color={Colors.success} sub={`${data.activeOrders} active`} />
              <KPI label="Transactions" value={data.totalTransactions.toLocaleString()} icon="swap-horiz" color={Colors.purple} />
              <KPI label="Referrals" value={data.referralTransactions.toLocaleString()} icon="share" color={Colors.warning} />
            </View>

            {/* Stars Economy */}
            <Text style={styles.sectionTitle}>Stars Economy</Text>
            <View style={styles.card}>
              <View style={styles.economyRow}>
                <View style={[styles.economyBar, { flex: data.totalStarsEarned, backgroundColor: Colors.success + '44' }]} />
                <View style={[styles.economyBar, { flex: data.totalStarsSpent, backgroundColor: Colors.primary + '44' }]} />
              </View>
              <View style={styles.economyLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.legendText}>Earned: {data.totalStarsEarned.toLocaleString()} ★</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.legendText}>Spent: {data.totalStarsSpent.toLocaleString()} ★</Text>
                </View>
              </View>
              <View style={styles.retentionRow}>
                <MaterialIcons name="account-balance-wallet" size={16} color={Colors.gold} />
                <Text style={styles.retentionText}>
                  Circulating: {Math.max(0, data.totalStarsEarned - data.totalStarsSpent).toLocaleString()} ★ in wallets
                </Text>
              </View>
            </View>

            {/* Category Breakdown */}
            {Object.keys(data.categoryBreakdown).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Stars by Category</Text>
                <View style={styles.card}>
                  {Object.entries(data.categoryBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, val], i) => (
                      <MiniBar
                        key={cat}
                        label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                        value={val}
                        max={Math.max(...Object.values(data.categoryBreakdown))}
                        color={BAR_COLORS[i % BAR_COLORS.length]}
                      />
                    ))}
                </View>
              </>
            )}

            {/* Boost Split */}
            <Text style={styles.sectionTitle}>Boost Type Split</Text>
            <View style={styles.card}>
              <View style={styles.boostSplitRow}>
                <View style={styles.boostSplitItem}>
                  <MaterialIcons name="videocam" size={28} color={Colors.primary} />
                  <Text style={[styles.boostSplitVal, { color: Colors.primary }]}>{data.boostTypeBreakdown.video}</Text>
                  <Text style={styles.boostSplitLabel}>Video Boosts</Text>
                </View>
                <View style={styles.boostDivider} />
                <View style={styles.boostSplitItem}>
                  <MaterialIcons name="person" size={28} color={Colors.info} />
                  <Text style={[styles.boostSplitVal, { color: Colors.info }]}>{data.boostTypeBreakdown.profile}</Text>
                  <Text style={styles.boostSplitLabel}>Profile Boosts</Text>
                </View>
              </View>
            </View>

            {/* Top Earners */}
            <Text style={styles.sectionTitle}>Top 5 Earners</Text>
            <View style={styles.card}>
              {data.topEarners.map((u: any, i: number) => (
                <View key={i} style={[styles.earnerRow, i < data.topEarners.length - 1 && styles.earnerSep]}>
                  <Text style={[styles.earnerRank, { color: i < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : Colors.textMuted }]}>
                    #{i + 1}
                  </Text>
                  <View style={[styles.earnerAvatar, { backgroundColor: Colors.primary + '22' }]}>
                    <Text style={styles.earnerAvatarText}>
                      {(u.tiktok_username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.earnerInfo}>
                    <Text style={styles.earnerName} numberOfLines={1}>{u.tiktok_username || 'Unknown'}</Text>
                    {u.is_vip && <MaterialIcons name="workspace-premium" size={10} color={Colors.gold} />}
                  </View>
                  <Text style={styles.earnerStars}>{(u.total_stars_earned || 0).toLocaleString()} ★</Text>
                </View>
              ))}
            </View>

            {/* VIP Stats */}
            <Text style={styles.sectionTitle}>VIP Adoption</Text>
            <View style={styles.card}>
              <View style={styles.vipStats}>
                <View style={styles.vipStatItem}>
                  <Text style={[styles.vipStatVal, { color: Colors.gold }]}>{data.vipUsers}</Text>
                  <Text style={styles.vipStatLabel}>VIP Users</Text>
                </View>
                <View style={styles.vipDivider} />
                <View style={styles.vipStatItem}>
                  <Text style={[styles.vipStatVal, { color: Colors.textPrimary }]}>{data.totalUsers - data.vipUsers}</Text>
                  <Text style={styles.vipStatLabel}>Free Users</Text>
                </View>
                <View style={styles.vipDivider} />
                <View style={styles.vipStatItem}>
                  <Text style={[styles.vipStatVal, { color: Colors.success }]}>
                    {data.totalUsers > 0 ? Math.round((data.vipUsers / data.totalUsers) * 100) : 0}%
                  </Text>
                  <Text style={styles.vipStatLabel}>Conversion</Text>
                </View>
              </View>
              <View style={styles.vipBarTrack}>
                <View style={[styles.vipBarFill, {
                  width: data.totalUsers > 0 ? `${(data.vipUsers / data.totalUsers) * 100}%` as any : '0%',
                }]} />
              </View>
            </View>
          </>
        ) : null}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  title: { flex: 1, fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  kpiCard: { width: '30%', borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden' },
  kpiGrad: { padding: Spacing.sm, gap: 2, alignItems: 'flex-start' },
  kpiValue: { fontSize: FontSize.lg, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 10, fontWeight: '600', color: Colors.textPrimary },
  kpiSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  card: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  economyRow: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: Spacing.sm },
  economyBar: { height: '100%' },
  economyLegend: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  retentionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  retentionText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  boostSplitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  boostSplitItem: { flex: 1, alignItems: 'center', gap: 6 },
  boostDivider: { width: 1, height: 60, backgroundColor: Colors.surfaceBorder },
  boostSplitVal: { fontSize: FontSize.xxl, fontWeight: '800' },
  boostSplitLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  earnerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  earnerSep: { borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  earnerRank: { width: 28, fontSize: FontSize.sm, fontWeight: '800', textAlign: 'center' },
  earnerAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  earnerAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  earnerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  earnerName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, maxWidth: '85%' },
  earnerStars: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gold },
  vipStats: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  vipStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  vipDivider: { width: 1, height: 50, backgroundColor: Colors.surfaceBorder },
  vipStatVal: { fontSize: FontSize.xxl, fontWeight: '800' },
  vipStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  vipBarTrack: { height: 8, backgroundColor: Colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  vipBarFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 4 },
});
