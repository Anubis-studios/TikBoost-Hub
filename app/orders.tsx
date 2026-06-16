import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { fetchBoostOrders, BoostOrder } from '@/services/supabaseService';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeUntil(iso?: string) {
  if (!iso) return 'Expired';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/** Calculate time-based progress 0–100 from createdAt → expiresAt */
function calcTimeProgress(createdAt: string, expiresAt?: string): number {
  if (!expiresAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.min(100, Math.max(5, Math.round(((now - start) / (end - start)) * 100)));
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  active: { color: Colors.success, icon: 'play-circle-filled', label: 'LIVE' },
  completed: { color: Colors.info, icon: 'check-circle', label: 'DONE' },
  pending: { color: Colors.warning, icon: 'access-time', label: 'PENDING' },
};

/** Animated progress bar that fills to target width on mount */
function AnimatedProgressBar({
  progress,
  status,
  height = 5,
}: {
  progress: number;
  status: string;
  height?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 900,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const isActive = status === 'active';
  const isCompleted = status === 'completed';

  const widthInterpolated = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[pbStyles.bg, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          pbStyles.fill,
          { width: widthInterpolated, height, borderRadius: height / 2 },
          isCompleted && pbStyles.fillCompleted,
          !isActive && !isCompleted && pbStyles.fillPending,
        ]}
      >
        {(isActive || isCompleted) && (
          <LinearGradient
            colors={(isCompleted ? ['#0A84FF', '#0060D0'] : Colors.gradientPink) as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
      </Animated.View>
    </View>
  );
}

const pbStyles = StyleSheet.create({
  bg: {
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    overflow: 'hidden',
  },
  fillCompleted: {},
  fillPending: {
    backgroundColor: Colors.surfaceBorder,
  },
});

export default function OrdersScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [orders, setOrders] = useState<BoostOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'pending'>('all');
  const [selectedOrder, setSelectedOrder] = useState<BoostOrder | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const data = await fetchBoostOrders(user.id);
    setOrders(data);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const activeCount = orders.filter((o) => o.status === 'active').length;
  const totalStarsSpent = orders.reduce((s, o) => s + o.starsSent, 0);

  const renderOrder = ({ item }: { item: BoostOrder }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const progress =
      item.status === 'completed'
        ? 100
        : item.status === 'active'
        ? calcTimeProgress(item.createdAt, item.expiresAt)
        : 5;

    return (
      <TouchableOpacity onPress={() => setSelectedOrder(item)} activeOpacity={0.8}>
        <View style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={[styles.orderTypeIcon, { backgroundColor: Colors.primary + '22' }]}>
              <MaterialIcons
                name={item.boostType === 'profile' ? 'person' : 'videocam'}
                size={20}
                color={Colors.primary}
              />
            </View>
            <View style={styles.orderInfo}>
              <Text style={styles.orderLabel}>{item.label}</Text>
              <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '44' }]}>
              <MaterialIcons name={cfg.icon as any} size={12} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={styles.orderStats}>
            <View style={styles.orderStat}>
              <MaterialIcons name="people" size={14} color={Colors.textSecondary} />
              <Text style={styles.orderStatText}>{item.reach}</Text>
            </View>
            <View style={styles.orderStat}>
              <MaterialIcons name="star" size={14} color={Colors.gold} />
              <Text style={styles.orderStatText}>{item.starsSent.toLocaleString()} stars</Text>
            </View>
            {item.status === 'active' && item.expiresAt && (
              <View style={styles.orderStat}>
                <MaterialIcons name="access-time" size={14} color={Colors.warning} />
                <Text style={[styles.orderStatText, { color: Colors.warning }]}>{timeUntil(item.expiresAt)}</Text>
              </View>
            )}
          </View>

          {/* Progress row */}
          <View style={styles.progressRow}>
            <AnimatedProgressBar progress={progress} status={item.status} height={5} />
            <Text style={[styles.progressLabel, { color: cfg.color }]}>{progress}%</Text>
          </View>
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
        <Text style={styles.title}>Boost Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: Colors.success }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: Colors.info }]}>{orders.filter(o => o.status === 'completed').length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: Colors.gold }]}>{orders.length}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: Colors.primary }]}>{totalStarsSpent.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Stars Spent</Text>
        </View>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
        {(['all', 'active', 'completed', 'pending'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="rocket-launch" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySub}>Boost your TikTok profile or video to get started!</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/boost')} style={styles.emptyBtn}>
            <LinearGradient colors={Colors.gradientPink as [string, string]} style={styles.emptyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.emptyBtnText}>Boost Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Order Detail Modal */}
      <Modal visible={!!selectedOrder} transparent animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Detail</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {selectedOrder && (() => {
              const cfg = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.pending;
              const detailProgress =
                selectedOrder.status === 'completed'
                  ? 100
                  : selectedOrder.status === 'active'
                  ? calcTimeProgress(selectedOrder.createdAt, selectedOrder.expiresAt)
                  : 5;
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <LinearGradient colors={['#2A0A14', '#1A1A1A']} style={styles.detailCard}>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '44', alignSelf: 'flex-start', marginBottom: Spacing.sm }]}>
                      <MaterialIcons name={cfg.icon as any} size={14} color={cfg.color} />
                      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.detailLabel}>{selectedOrder.label}</Text>
                    <Text style={styles.detailType}>{selectedOrder.boostType === 'profile' ? 'Profile Boost' : 'Video Boost'}</Text>
                  </LinearGradient>

                  <View style={styles.detailRows}>
                    {[
                      { icon: 'people', label: 'Reach', value: selectedOrder.reach, color: Colors.info },
                      { icon: 'star', label: 'Stars Spent', value: `${selectedOrder.starsSent.toLocaleString()} ★`, color: Colors.gold },
                      { icon: 'calendar-today', label: 'Created', value: formatDate(selectedOrder.createdAt), color: Colors.textSecondary },
                      { icon: 'access-time', label: 'Expires', value: selectedOrder.expiresAt ? formatDate(selectedOrder.expiresAt) : 'N/A', color: Colors.textSecondary },
                    ].map(({ icon, label, value, color }) => (
                      <View key={label} style={styles.detailRow}>
                        <View style={styles.detailRowLeft}>
                          <MaterialIcons name={icon as any} size={16} color={Colors.textMuted} />
                          <Text style={styles.detailRowLabel}>{label}</Text>
                        </View>
                        <Text style={[styles.detailRowVal, { color }]}>{value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Animated progress in modal */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressTitle}>Delivery Progress</Text>
                      <Text style={[styles.progressPct, { color: cfg.color }]}>{detailProgress}%</Text>
                    </View>
                    <AnimatedProgressBar progress={detailProgress} status={selectedOrder.status} height={8} />
                    {selectedOrder.status === 'active' && selectedOrder.expiresAt && (
                      <View style={styles.progressMeta}>
                        <MaterialIcons name="access-time" size={13} color={Colors.warning} />
                        <Text style={styles.progressNote}>{timeUntil(selectedOrder.expiresAt)} remaining</Text>
                      </View>
                    )}
                    {selectedOrder.status === 'completed' && (
                      <View style={styles.progressMeta}>
                        <MaterialIcons name="check-circle" size={13} color={Colors.success} />
                        <Text style={[styles.progressNote, { color: Colors.success }]}>Boost completed successfully</Text>
                      </View>
                    )}
                    {selectedOrder.status === 'active' && (
                      <View style={styles.progressMeta}>
                        <MaterialIcons name="play-circle-outline" size={13} color={Colors.success} />
                        <Text style={[styles.progressNote, { color: Colors.success }]}>Actively reaching TikTok users</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
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
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statVal: { fontSize: FontSize.lg, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  orderTypeIcon: { width: 40, height: 40, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  orderInfo: { flex: 1 },
  orderLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  orderDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '800' },
  orderStats: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  orderStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderStatText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  emptyBtn: { marginTop: Spacing.md, borderRadius: BorderRadius.full, overflow: 'hidden' },
  emptyBtnGrad: { paddingHorizontal: Spacing.xl, paddingVertical: 14 },
  emptyBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  detailCard: {
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  detailLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  detailType: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  detailRows: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  detailRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailRowLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  detailRowVal: { fontSize: FontSize.sm, fontWeight: '600' },
  progressSection: { marginBottom: Spacing.xl },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  progressPct: { fontSize: FontSize.sm, fontWeight: '800' },
  progressMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  progressNote: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
