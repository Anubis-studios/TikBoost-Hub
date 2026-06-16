import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface AdminOrder {
  id: string;
  user_id: string;
  package_id: string;
  label: string;
  boost_type: string;
  reach: string;
  stars_spent: number;
  status: string;
  progress: number;
  video_url: string | null;
  expires_at: string | null;
  created_at: string;
  user_profiles?: { tiktok_username: string; email: string };
}

const STATUS_OPTS = ['active', 'completed', 'pending', 'failed'];
const STATUS_COLORS: Record<string, string> = {
  active: Colors.success,
  completed: Colors.info,
  pending: Colors.warning,
  failed: Colors.error,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminOrdersScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    let q = supabase
      .from('boost_orders')
      .select('*, user_profiles!inner(tiktok_username, email)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setOrders(data || []);
    setIsLoading(false);
  }, [supabase, filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (order: AdminOrder, status: string) => {
    setSaving(true);
    try {
      const updates: any = { status, progress: status === 'completed' ? 100 : order.progress };
      await supabase.from('boost_orders').update(updates).eq('id', order.id);
      await supabase.from('admin_logs').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'update_order_status',
        target_type: 'order', target_id: order.id,
        details: { old_status: order.status, new_status: status },
      });

      if (status === 'completed') {
        await supabase.from('notifications').insert({
          user_id: order.user_id,
          title: 'Boost Completed!',
          body: `Your "${order.label}" boost has finished delivering. Check your TikTok for results!`,
          type: 'boost', is_read: false,
        });
      }

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updates } : o));
      setSelectedOrder(null);
      showAlert('Updated', `Order status set to "${status}".`);
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderOrder = ({ item: o }: { item: AdminOrder }) => {
    const color = STATUS_COLORS[o.status] || Colors.textMuted;
    return (
      <TouchableOpacity onPress={() => setSelectedOrder(o)} activeOpacity={0.85}>
        <View style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={[styles.orderIcon, { backgroundColor: color + '22' }]}>
              <MaterialIcons name={o.boost_type === 'profile' ? 'person' : 'videocam'} size={18} color={color} />
            </View>
            <View style={styles.orderInfo}>
              <Text style={styles.orderLabel} numberOfLines={1}>{o.label}</Text>
              <Text style={styles.orderUser} numberOfLines={1}>
                {o.user_profiles?.tiktok_username || o.user_profiles?.email || 'Unknown'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
              <Text style={[styles.statusText, { color }]}>{o.status.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.orderMeta}>
            <View style={styles.metaTag}>
              <MaterialIcons name="people" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{o.reach}</Text>
            </View>
            <View style={styles.metaTag}>
              <MaterialIcons name="star" size={12} color={Colors.gold} />
              <Text style={styles.metaText}>{o.stars_spent.toLocaleString()} ★</Text>
            </View>
            <View style={styles.metaTag}>
              <MaterialIcons name="calendar-today" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{formatDate(o.created_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Boost Orders</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{orders.length}</Text>
        </View>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
        {['all', ...STATUS_OPTS].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            {filter === f && f !== 'all' && (
              <View style={[styles.filterDot, { backgroundColor: STATUS_COLORS[f] || Colors.primary }]} />
            )}
            <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          )}
        />
      )}

      {/* Order Detail Modal */}
      <Modal visible={!!selectedOrder} transparent animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <LinearGradient colors={['#2A0A14', '#1A1A1A']} style={styles.detailCard}>
                  <Text style={styles.detailLabel}>{selectedOrder.label}</Text>
                  <Text style={styles.detailUser}>
                    {selectedOrder.user_profiles?.tiktok_username || selectedOrder.user_profiles?.email}
                  </Text>
                </LinearGradient>

                {[
                  { label: 'Order ID', value: selectedOrder.id.slice(0, 20) + '...', icon: 'tag' },
                  { label: 'Type', value: selectedOrder.boost_type === 'video' ? 'Video Boost' : 'Profile Boost', icon: 'category' },
                  { label: 'Reach', value: selectedOrder.reach, icon: 'people' },
                  { label: 'Stars Spent', value: selectedOrder.stars_spent.toLocaleString() + ' ★', icon: 'star' },
                  { label: 'Progress', value: selectedOrder.progress + '%', icon: 'trending-up' },
                  { label: 'Created', value: formatDate(selectedOrder.created_at), icon: 'calendar-today' },
                  { label: 'Expires', value: selectedOrder.expires_at ? formatDate(selectedOrder.expires_at) : 'N/A', icon: 'access-time' },
                  { label: 'Video URL', value: selectedOrder.video_url || 'N/A', icon: 'link' },
                ].map(({ label, value, icon }) => (
                  <View key={label} style={styles.detailRow}>
                    <MaterialIcons name={icon as any} size={16} color={Colors.textMuted} />
                    <Text style={styles.detailRowLabel}>{label}</Text>
                    <Text style={styles.detailRowVal} numberOfLines={1}>{value}</Text>
                  </View>
                ))}

                <Text style={styles.sectionLabel}>Update Status</Text>
                <View style={styles.statusGrid}>
                  {STATUS_OPTS.map((s) => {
                    const color = STATUS_COLORS[s];
                    const isActive = selectedOrder.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => updateStatus(selectedOrder, s)}
                        disabled={saving || isActive}
                        style={[styles.statusBtn, { borderColor: isActive ? color : Colors.surfaceBorder, backgroundColor: isActive ? color + '22' : Colors.surfaceElevated }]}
                      >
                        {saving && isActive ? (
                          <ActivityIndicator size="small" color={color} />
                        ) : (
                          <Text style={[styles.statusBtnText, { color: isActive ? color : Colors.textSecondary }]}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ height: Spacing.xxl }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  countBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  countText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary },
  filterBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  orderCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  orderIcon: { width: 40, height: 40, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  orderInfo: { flex: 1 },
  orderLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  orderUser: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: {
    borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '800' },
  orderMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metaTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  empty: { alignItems: 'center', marginTop: 60, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  detailCard: {
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  detailLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  detailUser: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  detailRowLabel: { width: 80, fontSize: FontSize.sm, color: Colors.textSecondary },
  detailRowVal: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  sectionLabel: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary,
    marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statusBtn: {
    flex: 1, minWidth: '45%', paddingVertical: 12,
    borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  statusBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
});
