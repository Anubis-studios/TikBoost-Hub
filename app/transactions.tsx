import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { fetchTransactions, StarTransaction } from '@/services/supabaseService';

// ─── Category Config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  label: string;
  icon: string;
  color: string;
  isStripe?: boolean;
  isCasino?: boolean;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  task:               { label: 'Reward',             icon: 'card-giftcard',       color: Colors.success },
  follow:             { label: 'Reward',             icon: 'person-add',          color: Colors.info },
  like:               { label: 'Reward',             icon: 'favorite',            color: Colors.primary },
  watch_ad:           { label: 'Reward',             icon: 'play-circle-filled',  color: Colors.warning },
  daily_checkin:      { label: 'Reward',             icon: 'calendar-today',      color: Colors.success },
  streak:             { label: 'Weekly Reward',      icon: 'local-fire-department', color: Colors.warning },
  streak_milestone:   { label: 'Monthly Reward',     icon: 'emoji-events',        color: Colors.gold },
  milestone:          { label: 'Monthly Reward',     icon: 'emoji-events',        color: Colors.gold },
  spin_game:          { label: 'Luck Spin',          icon: 'casino',              color: Colors.purple,   isCasino: true },
  scratch_card:       { label: 'Bonus Credit',       icon: 'credit-card',         color: Colors.info,     isCasino: true },
  boost:              { label: 'New Order',          icon: 'rocket-launch',       color: Colors.primary },
  purchase:           { label: 'Purchase',           icon: 'shopping-cart',       color: Colors.gold,     isStripe: true },
  referral:           { label: 'Subset Commission',  icon: 'share',               color: Colors.purple },
  referral_bonus:     { label: 'Invite Bonus',       icon: 'person-add',          color: Colors.info },
  welcome:            { label: 'Bonus',              icon: 'star',                color: Colors.gold },
  welcome_gift:       { label: 'Welcome Gift',       icon: 'card-giftcard',       color: Colors.warning },
  gift:               { label: 'Gift',               icon: 'card-giftcard',       color: Colors.warning },
  vip:                { label: 'Purchase',           icon: 'workspace-premium',   color: Colors.gold,     isStripe: true },
  general:            { label: 'Bonus',              icon: 'star',                color: Colors.gold },
  bonus:              { label: 'Bonus',              icon: 'stars',               color: Colors.gold },
  purchase_refund:    { label: 'Purchase Refund',    icon: 'replay',              color: Colors.success },
  order_cancellation: { label: 'Order Cancellation', icon: 'remove-shopping-cart', color: Colors.error },
  partial_refund:     { label: 'Partial Refund',     icon: 'undo',                color: Colors.warning },
  commission:         { label: 'Commission',         icon: 'trending-up',         color: Colors.info },
  initial_balance:    { label: 'Initial Balance',    icon: 'account-balance',     color: Colors.success },
  quiz:               { label: 'Quiz Reward',        icon: 'quiz',                color: Colors.purple },
};

// Map each category label filter to which `category` values it matches
const FILTER_CATEGORIES: Record<string, string[]> = {
  'All':                [],
  'Purchase':           ['purchase', 'vip'],
  'Purchase Refund':    ['purchase_refund'],
  'Bonus':              ['bonus', 'welcome', 'general'],
  'Order Cancellation': ['order_cancellation'],
  'Partial Refund':     ['partial_refund'],
  'New Order':          ['boost'],
  'Subset Commission':  ['referral'],
  'Gift':               ['gift'],
  'Reward':             ['task', 'follow', 'like', 'watch_ad', 'daily_checkin'],
  'Invite Bonus':       ['referral_bonus'],
  'Welcome Gift':       ['welcome_gift'],
  'Commission':         ['commission'],
  'Initial Balance':    ['initial_balance'],
  'Luck Spin':          ['spin_game'],
  'Bonus Credit':       ['scratch_card'],
  'Weekly Reward':      ['streak'],
  'Monthly Reward':     ['streak_milestone', 'milestone'],
  'Quiz Reward':        ['quiz'],
};

const FILTER_LABELS = Object.keys(FILTER_CATEGORIES);

function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TxRow({ item }: { item: StarTransaction }) {
  const cfg = getCategoryConfig(item.category);
  const isEarn = item.type === 'earn';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconWrap, { backgroundColor: cfg.color + '22' }]}>
        <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
        {/* Stripe badge */}
        {cfg.isStripe && (
          <View style={styles.stripeBadge}>
            <MaterialIcons name="lock" size={8} color={Colors.gold} />
          </View>
        )}
        {/* Casino badge */}
        {cfg.isCasino && (
          <View style={[styles.stripeBadge, { backgroundColor: Colors.purple }]}>
            <MaterialIcons name="casino" size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.txContent}>
        <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
        <View style={styles.txMetaRow}>
          {cfg.isStripe && (
            <>
              <MaterialIcons name="payment" size={10} color={Colors.gold} />
              <Text style={[styles.txMeta, { color: Colors.gold }]}>Stripe</Text>
              <Text style={styles.txDot}>·</Text>
            </>
          )}
          {cfg.isCasino && (
            <>
              <MaterialIcons name="casino" size={10} color={Colors.purple} />
              <Text style={[styles.txMeta, { color: Colors.purple }]}>Game Win</Text>
              <Text style={styles.txDot}>·</Text>
            </>
          )}
          <Text style={styles.txTime}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isEarn ? Colors.success : Colors.error }]}>
        {isEarn ? '+' : '-'}{item.amount}
        <Text style={styles.txStar}> ★</Text>
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TransactionsScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [transactions, setTransactions] = useState<StarTransaction[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'earn' | 'spend'>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const data = await fetchTransactions(user.id);
    setTransactions(data);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Build category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const label of FILTER_LABELS) {
      if (label === 'All') {
        counts[label] = transactions.length;
      } else {
        const cats = FILTER_CATEGORIES[label];
        counts[label] = transactions.filter(t =>
          cats.includes(t.category) &&
          (typeFilter === 'all' || t.type === typeFilter)
        ).length;
      }
    }
    return counts;
  }, [transactions, typeFilter]);

  const filtered = useMemo(() => {
    let list = typeFilter === 'all' ? transactions : transactions.filter((t) => t.type === typeFilter);
    if (categoryFilter !== 'All') {
      const cats = FILTER_CATEGORIES[categoryFilter];
      list = list.filter(t => cats.includes(t.category));
    }
    return list;
  }, [transactions, typeFilter, categoryFilter]);

  const totalEarned = transactions.filter((t) => t.type === 'earn').reduce((s, t) => s + t.amount, 0);
  const totalSpent  = transactions.filter((t) => t.type === 'spend').reduce((s, t) => s + t.amount, 0);

  // Summary stats
  const purchaseTotal = transactions.filter(t => ['purchase', 'vip'].includes(t.category) && t.type === 'earn').reduce((s, t) => s + t.amount, 0);
  const gameTotal     = transactions.filter(t => ['spin_game', 'scratch_card'].includes(t.category)).reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Star Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
        <LinearGradient colors={['#001A00', '#0D0D0D']} style={styles.summaryCard}>
          <MaterialIcons name="arrow-upward" size={16} color={Colors.success} />
          <Text style={styles.summaryLabel}>Earned</Text>
          <Text style={[styles.summaryVal, { color: Colors.success }]}>+{totalEarned.toLocaleString()} ★</Text>
        </LinearGradient>
        <LinearGradient colors={['#1A0000', '#0D0D0D']} style={styles.summaryCard}>
          <MaterialIcons name="arrow-downward" size={16} color={Colors.error} />
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={[styles.summaryVal, { color: Colors.error }]}>-{totalSpent.toLocaleString()} ★</Text>
        </LinearGradient>
        <LinearGradient colors={['#1A1000', '#0D0D0D']} style={styles.summaryCard}>
          <MaterialIcons name="star" size={16} color={Colors.gold} />
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.summaryVal, { color: Colors.gold }]}>{(user?.stars || 0).toLocaleString()} ★</Text>
        </LinearGradient>
        <LinearGradient colors={['#1A001A', '#0D0D0D']} style={styles.summaryCard}>
          <MaterialIcons name="casino" size={16} color={Colors.purple} />
          <Text style={styles.summaryLabel}>Game Wins</Text>
          <Text style={[styles.summaryVal, { color: Colors.purple }]}>+{gameTotal.toLocaleString()} ★</Text>
        </LinearGradient>
        <LinearGradient colors={['#1A1000', '#0D0D0D']} style={styles.summaryCard}>
          <MaterialIcons name="payment" size={16} color={Colors.gold} />
          <Text style={styles.summaryLabel}>Purchased</Text>
          <Text style={[styles.summaryVal, { color: Colors.gold }]}>+{purchaseTotal.toLocaleString()} ★</Text>
        </LinearGradient>
      </ScrollView>

      {/* Type Filter */}
      <View style={styles.typeFilterRow}>
        {(['all', 'earn', 'spend'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.typeChip, typeFilter === f && styles.typeChipActive]}
            onPress={() => setTypeFilter(f)}
          >
            <Text style={[styles.typeChipText, typeFilter === f && styles.typeChipTextActive]}>
              {f === 'all' ? 'All' : f === 'earn' ? '↑ Earned' : '↓ Spent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Filter Chips */}
      <View style={styles.catFilterOuter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catFilterBar}>
          {FILTER_LABELS.map((label) => {
            const count = categoryCounts[label] ?? 0;
            const isActive = categoryFilter === label;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.catChip, isActive && styles.catChipActive]}
                onPress={() => setCategoryFilter(label)}
                activeOpacity={0.8}
              >
                <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>{label}</Text>
                {count > 0 && (
                  <View style={[styles.catCountBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : Colors.surfaceElevated }]}>
                    <Text style={[styles.catCountText, isActive && { color: '#fff' }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="star-border" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No transactions</Text>
          <Text style={styles.emptySub}>
            {categoryFilter !== 'All' ? `No ${categoryFilter} transactions yet` : 'Complete tasks to earn your first stars!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TxRow item={item} />}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  summaryScroll: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  summaryCard: {
    alignItems: 'center', gap: 4, borderRadius: BorderRadius.lg,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.surfaceBorder,
    minWidth: 80,
  },
  summaryLabel: { fontSize: 10, color: Colors.textSecondary },
  summaryVal: { fontSize: FontSize.sm, fontWeight: '800' },
  typeFilterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  typeChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  typeChipTextActive: { color: '#fff' },
  catFilterOuter: { marginBottom: Spacing.sm },
  catFilterBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  catChipTextActive: { color: '#fff' },
  catCountBadge: {
    borderRadius: BorderRadius.full, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  catCountText: { fontSize: 9, fontWeight: '800', color: Colors.textMuted },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  txIconWrap: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  stripeBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: Colors.gold, borderRadius: 8, width: 14, height: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.background,
  },
  txContent: { flex: 1 },
  txDesc: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  txMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txMeta: { fontSize: 10, fontWeight: '600' },
  txDot: { fontSize: 10, color: Colors.textMuted },
  txTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  txAmount: { fontSize: FontSize.md, fontWeight: '800' },
  txStar: { fontSize: FontSize.sm },
  separator: { height: 1, backgroundColor: Colors.surfaceBorder, marginLeft: 56 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
