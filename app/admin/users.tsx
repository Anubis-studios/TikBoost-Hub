import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface AdminUser {
  id: string;
  email: string;
  tiktok_username: string;
  stars: number;
  total_stars_earned: number;
  is_vip: boolean;
  is_admin: boolean;
  login_streak: number;
  referral_code: string;
  last_login_at: string | null;
  completed_task_ids: string[];
  created_at?: string;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editStars, setEditStars] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q = '') => {
    setIsLoading(true);
    let query = supabase
      .from('user_profiles')
      .select('*')
      .order('total_stars_earned', { ascending: false })
      .limit(50);
    if (q.trim()) {
      query = query.or(`tiktok_username.ilike.%${q}%,email.ilike.%${q}%`);
    }
    const { data } = await query;
    setUsers(data || []);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    const timer = setTimeout(() => load(text), 500);
    return () => clearTimeout(timer);
  }, [load]);

  const openUser = (u: AdminUser) => {
    setSelectedUser(u);
    setEditStars(String(u.stars));
    setEditTiktok(u.tiktok_username || '');
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const updates: any = {
        stars: parseInt(editStars) || 0,
        tiktok_username: editTiktok.trim(),
      };
      const { error } = await supabase.from('user_profiles').update(updates).eq('id', selectedUser.id);
      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'update_user',
        target_type: 'user',
        target_id: selectedUser.id,
        details: { stars: updates.stars, tiktok_username: updates.tiktok_username },
      });

      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
      setSelectedUser(null);
      showAlert('Saved', 'User profile updated successfully.');
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVIP = async (u: AdminUser) => {
    const newVip = !u.is_vip;
    showAlert(
      newVip ? 'Grant VIP' : 'Revoke VIP',
      `${newVip ? 'Grant' : 'Revoke'} VIP status for ${u.tiktok_username || u.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const expiresAt = newVip ? new Date(Date.now() + 30 * 86400000).toISOString() : null;
            await supabase.from('user_profiles').update({ is_vip: newVip, vip_expires_at: expiresAt }).eq('id', u.id);
            await supabase.from('admin_logs').insert({
              admin_id: (await supabase.auth.getUser()).data.user?.id,
              action: newVip ? 'grant_vip' : 'revoke_vip',
              target_type: 'user', target_id: u.id,
            });
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_vip: newVip } : x));
            showAlert('Done', `VIP ${newVip ? 'granted' : 'revoked'} for 30 days.`);
          },
        },
      ]
    );
  };

  const toggleAdmin = async (u: AdminUser) => {
    const newAdmin = !u.is_admin;
    showAlert(
      newAdmin ? 'Grant Admin' : 'Revoke Admin',
      `${newAdmin ? 'Grant' : 'Revoke'} admin access for ${u.tiktok_username || u.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newAdmin ? 'default' : 'destructive',
          onPress: async () => {
            await supabase.from('user_profiles').update({ is_admin: newAdmin }).eq('id', u.id);
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: newAdmin } : x));
            showAlert('Done', `Admin ${newAdmin ? 'granted' : 'revoked'}.`);
          },
        },
      ]
    );
  };

  const awardStars = async (u: AdminUser) => {
    showAlert(
      'Award Stars',
      'How many stars to award this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Award 500',
          onPress: async () => {
            await supabase.from('user_profiles').update({
              stars: (u.stars || 0) + 500,
              total_stars_earned: (u.total_stars_earned || 0) + 500,
            }).eq('id', u.id);
            await supabase.from('star_transactions').insert({
              user_id: u.id, type: 'earn', amount: 500,
              description: 'Admin award', category: 'admin',
            });
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, stars: x.stars + 500 } : x));
            showAlert('Done', '500 stars awarded!');
          },
        },
        {
          text: 'Award 1000',
          onPress: async () => {
            await supabase.from('user_profiles').update({
              stars: (u.stars || 0) + 1000,
              total_stars_earned: (u.total_stars_earned || 0) + 1000,
            }).eq('id', u.id);
            await supabase.from('star_transactions').insert({
              user_id: u.id, type: 'earn', amount: 1000,
              description: 'Admin award', category: 'admin',
            });
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, stars: x.stars + 1000 } : x));
            showAlert('Done', '1000 stars awarded!');
          },
        },
      ]
    );
  };

  const renderUser = ({ item: u }: { item: AdminUser }) => (
    <TouchableOpacity onPress={() => openUser(u)} activeOpacity={0.85}>
      <View style={styles.userCard}>
        <LinearGradient colors={Colors.gradientPink as [string, string]} style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(u.tiktok_username || u.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>{u.tiktok_username || '—'}</Text>
            {u.is_vip && <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />}
            {u.is_admin && (
              <View style={styles.adminChip}>
                <Text style={styles.adminChipText}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
        </View>
        <View style={styles.userStars}>
          <MaterialIcons name="star" size={14} color={Colors.gold} />
          <Text style={styles.userStarsText}>{(u.stars || 0).toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Users</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{users.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or email..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => { setSearch(''); load(); }}>
            <MaterialIcons name="clear" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* User Edit Modal */}
      <Modal visible={!!selectedUser} transparent animationType="slide" onRequestClose={() => setSelectedUser(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile summary */}
                <LinearGradient colors={['#2A0A14', '#1A1A1A']} style={styles.modalProfileCard}>
                  <LinearGradient colors={Colors.gradientPink as [string, string]} style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {(selectedUser.tiktok_username || selectedUser.email || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <View>
                    <Text style={styles.modalUserName}>{selectedUser.tiktok_username || '—'}</Text>
                    <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                    <Text style={styles.modalUserId}>ID: {selectedUser.id.slice(0, 16)}...</Text>
                  </View>
                </LinearGradient>

                {/* Editable fields */}
                <Text style={styles.fieldLabel}>TikTok Username</Text>
                <View style={styles.field}>
                  <MaterialIcons name="alternate-email" size={18} color={Colors.textSecondary} />
                  <TextInput
                    style={styles.fieldInput}
                    value={editTiktok}
                    onChangeText={setEditTiktok}
                    placeholder="@username"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>

                <Text style={styles.fieldLabel}>Stars Balance</Text>
                <View style={styles.field}>
                  <MaterialIcons name="star" size={18} color={Colors.gold} />
                  <TextInput
                    style={styles.fieldInput}
                    value={editStars}
                    onChangeText={setEditStars}
                    keyboardType="numeric"
                    placeholder="Stars"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Info rows */}
                <View style={styles.infoGrid}>
                  {[
                    { label: 'Total Earned', value: (selectedUser.total_stars_earned || 0).toLocaleString() + ' ★', icon: 'trending-up', color: Colors.gold },
                    { label: 'Login Streak', value: `${selectedUser.login_streak || 0} days`, icon: 'local-fire-department', color: Colors.warning },
                    { label: 'Tasks Done', value: (selectedUser.completed_task_ids?.length || 0).toString(), icon: 'check-circle', color: Colors.success },
                    { label: 'Referral Code', value: selectedUser.referral_code || '—', icon: 'share', color: Colors.purple },
                  ].map((row) => (
                    <View key={row.label} style={styles.infoRow}>
                      <MaterialIcons name={row.icon as any} size={16} color={row.color} />
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={[styles.infoValue, { color: row.color }]}>{row.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Toggles */}
                <View style={styles.toggleRow}>
                  <MaterialIcons name="workspace-premium" size={18} color={Colors.gold} />
                  <Text style={styles.toggleLabel}>VIP Status</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={() => toggleVIP(selectedUser)}
                    style={[styles.toggleBtn, { backgroundColor: selectedUser.is_vip ? Colors.gold + '22' : Colors.surfaceElevated }]}
                  >
                    <Text style={[styles.toggleBtnText, { color: selectedUser.is_vip ? Colors.gold : Colors.textSecondary }]}>
                      {selectedUser.is_vip ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.toggleRow}>
                  <MaterialIcons name="admin-panel-settings" size={18} color={Colors.primary} />
                  <Text style={styles.toggleLabel}>Admin Access</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={() => toggleAdmin(selectedUser)}
                    style={[styles.toggleBtn, { backgroundColor: selectedUser.is_admin ? Colors.primary + '22' : Colors.surfaceElevated }]}
                  >
                    <Text style={[styles.toggleBtnText, { color: selectedUser.is_admin ? Colors.primary : Colors.textSecondary }]}>
                      {selectedUser.is_admin ? 'ADMIN' : 'NONE'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Actions */}
                <Text style={styles.fieldLabel}>Quick Actions</Text>
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={[styles.quickBtn, { borderColor: Colors.gold + '44' }]}
                    onPress={() => awardStars(selectedUser)}
                  >
                    <MaterialIcons name="star" size={16} color={Colors.gold} />
                    <Text style={[styles.quickBtnText, { color: Colors.gold }]}>Award Stars</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickBtn, { borderColor: Colors.info + '44' }]}
                    onPress={() => {
                      setSelectedUser(null);
                      router.push(`/admin/notifications?userId=${selectedUser.id}`);
                    }}
                  >
                    <MaterialIcons name="notifications" size={16} color={Colors.info} />
                    <Text style={[styles.quickBtnText, { color: Colors.info }]}>Send Alert</Text>
                  </TouchableOpacity>
                </View>

                {/* Save */}
                <TouchableOpacity onPress={saveUser} disabled={saving} activeOpacity={0.85}>
                  <LinearGradient
                    colors={Colors.gradientPink as [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.saveBtn}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="save" size={18} color="#fff" />
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

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
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  searchInput: { flex: 1, height: 44, color: Colors.textPrimary, fontSize: FontSize.sm },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  separator: { height: 1, backgroundColor: Colors.surfaceBorder },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, maxWidth: '70%' },
  adminChip: {
    backgroundColor: Colors.primary + '22', borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  adminChipText: { fontSize: 9, fontWeight: '800', color: Colors.primary },
  userEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  userStars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  userStarsText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalProfileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  modalAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { fontSize: FontSize.xl, fontWeight: '700', color: '#fff' },
  modalUserName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  modalUserEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  modalUserId: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.sm,
  },
  fieldInput: { flex: 1, height: 46, color: Colors.textPrimary, fontSize: FontSize.sm },
  infoGrid: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  infoLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, marginBottom: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  toggleBtn: {
    borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  toggleBtnText: { fontSize: 11, fontWeight: '800' },
  quickActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: BorderRadius.md, paddingVertical: 12,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1,
  },
  quickBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  saveBtn: {
    height: 52, borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: Spacing.sm,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});
