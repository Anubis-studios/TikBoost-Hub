import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface GiftCode {
  id: string;
  code: string;
  stars: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Create Code Modal ────────────────────────────────────────────────────────

function CreateCodeModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: { code: string; stars: number; maxUses: number; expiresAt: string | null }) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [stars, setStars] = useState('100');
  const [maxUses, setMaxUses] = useState('100');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const { showAlert } = useAlert();

  const randomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const generated = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setCode(generated);
  };

  const handleCreate = async () => {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode || trimCode.length < 4) {
      showAlert('Invalid Code', 'Code must be at least 4 characters.');
      return;
    }
    const starsNum = parseInt(stars);
    const maxNum = parseInt(maxUses);
    if (!starsNum || starsNum <= 0) {
      showAlert('Invalid Stars', 'Stars must be a positive number.');
      return;
    }
    if (!maxNum || maxNum <= 0) {
      showAlert('Invalid Max Uses', 'Max uses must be a positive number.');
      return;
    }

    let expiresAt: string | null = null;
    if (expiry.trim()) {
      const d = new Date(expiry.trim());
      if (isNaN(d.getTime())) {
        showAlert('Invalid Date', 'Use format YYYY-MM-DD for expiry.');
        return;
      }
      expiresAt = d.toISOString();
    }

    setSaving(true);
    try {
      await onCreate({ code: trimCode, stars: starsNum, maxUses: maxNum, expiresAt });
      setCode('');
      setStars('100');
      setMaxUses('100');
      setExpiry('');
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.overlay}
      >
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Create Gift Code</Text>

          {/* Code */}
          <Text style={modalStyles.label}>Code *</Text>
          <View style={modalStyles.inputRow}>
            <MaterialIcons name="confirmation-number" size={18} color={Colors.warning} />
            <TextInput
              style={modalStyles.input}
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              placeholder="e.g. SUMMER50"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={randomCode} style={modalStyles.genBtn}>
              <MaterialIcons name="auto-awesome" size={16} color={Colors.primary} />
              <Text style={modalStyles.genBtnText}>Auto</Text>
            </TouchableOpacity>
          </View>

          {/* Stars */}
          <Text style={modalStyles.label}>Stars to Award *</Text>
          <View style={modalStyles.inputRow}>
            <MaterialIcons name="star" size={18} color={Colors.gold} />
            <TextInput
              style={modalStyles.input}
              value={stars}
              onChangeText={setStars}
              placeholder="100"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          {/* Max Uses */}
          <Text style={modalStyles.label}>Max Uses *</Text>
          <View style={modalStyles.inputRow}>
            <MaterialIcons name="people" size={18} color={Colors.info} />
            <TextInput
              style={modalStyles.input}
              value={maxUses}
              onChangeText={setMaxUses}
              placeholder="100"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          {/* Expiry */}
          <Text style={modalStyles.label}>Expiry Date (optional)</Text>
          <View style={modalStyles.inputRow}>
            <MaterialIcons name="event" size={18} color={Colors.textSecondary} />
            <TextInput
              style={modalStyles.input}
              value={expiry}
              onChangeText={setExpiry}
              placeholder="YYYY-MM-DD (leave blank = no expiry)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="default"
            />
          </View>

          {/* Preview */}
          {code.trim().length >= 4 && (
            <View style={modalStyles.preview}>
              <MaterialIcons name="info-outline" size={14} color={Colors.info} />
              <Text style={modalStyles.previewText}>
                Code <Text style={{ color: Colors.warning, fontWeight: '800' }}>{code.trim().toUpperCase()}</Text>{' '}
                will award <Text style={{ color: Colors.gold, fontWeight: '800' }}>{stars || 0} ★</Text> to up to{' '}
                <Text style={{ color: Colors.info, fontWeight: '700' }}>{maxUses || 0} users</Text>
                {expiry ? ` until ${expiry}` : ', no expiry'}.
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[modalStyles.createBtn, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={modalStyles.createBtnText}>Create Code</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
            <Text style={modalStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: Spacing.xxl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.surfaceBorder,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  input: { flex: 1, height: 48, color: Colors.textPrimary, fontSize: FontSize.md },
  genBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  genBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  preview: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(10,132,255,0.1)', borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(10,132,255,0.2)',
  },
  previewText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  createBtn: {
    height: 52, borderRadius: BorderRadius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  createBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  cancelBtn: { height: 44, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
});

// ─── Code Card ────────────────────────────────────────────────────────────────

function CodeCard({
  code,
  onToggle,
  onCopy,
}: {
  code: GiftCode;
  onToggle: (id: string, current: boolean) => void;
  onCopy: (text: string) => void;
}) {
  const usagePct = code.maxUses > 0 ? Math.min(code.usedCount / code.maxUses, 1) : 0;
  const isExpired = code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
  const isExhausted = code.usedCount >= code.maxUses;
  const effectivelyActive = code.isActive && !isExpired && !isExhausted;

  return (
    <View style={[codeStyles.card, !effectivelyActive && codeStyles.cardInactive]}>
      {/* Top Row */}
      <View style={codeStyles.topRow}>
        <View style={codeStyles.codePill}>
          <MaterialIcons name="confirmation-number" size={14} color={Colors.warning} />
          <Text style={codeStyles.codeText}>{code.code}</Text>
        </View>
        <View style={codeStyles.actions}>
          <TouchableOpacity
            onPress={() => onCopy(code.code)}
            style={codeStyles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="content-copy" size={16} color={Colors.info} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onToggle(code.id, code.isActive)}
            style={[
              codeStyles.actionBtn,
              { backgroundColor: effectivelyActive ? 'rgba(255,69,58,0.15)' : 'rgba(0,209,126,0.15)' },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name={effectivelyActive ? 'pause-circle' : 'play-circle'}
              size={18}
              color={effectivelyActive ? Colors.error : Colors.success}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={codeStyles.statsRow}>
        <View style={codeStyles.stat}>
          <MaterialIcons name="star" size={13} color={Colors.gold} />
          <Text style={codeStyles.statVal}>{code.stars.toLocaleString()} ★</Text>
        </View>
        <View style={codeStyles.stat}>
          <MaterialIcons name="people" size={13} color={Colors.info} />
          <Text style={codeStyles.statVal}>{code.usedCount}/{code.maxUses}</Text>
        </View>
        <View style={[
          codeStyles.statusBadge,
          {
            backgroundColor: effectivelyActive
              ? 'rgba(0,209,126,0.15)'
              : isExpired ? 'rgba(255,184,0,0.15)' : 'rgba(255,69,58,0.15)',
          },
        ]}>
          <Text style={[
            codeStyles.statusText,
            { color: effectivelyActive ? Colors.success : isExpired ? Colors.warning : Colors.error },
          ]}>
            {isExpired ? 'EXPIRED' : isExhausted ? 'EXHAUSTED' : effectivelyActive ? 'ACTIVE' : 'PAUSED'}
          </Text>
        </View>
      </View>

      {/* Usage Bar */}
      <View style={codeStyles.barBg}>
        <View style={[codeStyles.barFill, {
          width: `${Math.round(usagePct * 100)}%` as any,
          backgroundColor: usagePct > 0.9 ? Colors.error : usagePct > 0.6 ? Colors.warning : Colors.success,
        }]} />
      </View>
      <Text style={codeStyles.barLabel}>{Math.round(usagePct * 100)}% used</Text>

      {/* Expiry */}
      {code.expiresAt && (
        <Text style={codeStyles.expiry}>
          Expires: {new Date(code.expiresAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

const codeStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  cardInactive: { opacity: 0.6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  codePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,184,0,0.12)', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)',
  },
  codeText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.warning, letterSpacing: 1.5 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statVal: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  statusBadge: { marginLeft: 'auto', borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  barBg: {
    height: 4, backgroundColor: Colors.surfaceElevated,
    borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  barFill: { height: '100%', borderRadius: 2 },
  barLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  expiry: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminGiftCodesScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [codes, setCodes] = useState<GiftCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  const loadCodes = useCallback(async () => {
    const { data, error } = await supabase
      .from('gift_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showAlert('Error', error.message);
      return;
    }

    setCodes((data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      stars: row.stars,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      createdAt: row.created_at,
    })));
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    loadCodes().finally(() => setLoading(false));
  }, [loadCodes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCodes();
    setRefreshing(false);
  }, [loadCodes]);

  const handleCreate = async (data: {
    code: string;
    stars: number;
    maxUses: number;
    expiresAt: string | null;
  }) => {
    const { error } = await supabase.from('gift_codes').insert({
      code: data.code,
      stars: data.stars,
      max_uses: data.maxUses,
      used_count: 0,
      expires_at: data.expiresAt,
      is_active: true,
    });

    if (error) {
      if (error.message.includes('unique')) {
        showAlert('Duplicate Code', `Code "${data.code}" already exists. Choose a different code.`);
      } else {
        showAlert('Error', error.message);
      }
      throw error;
    }

    await loadCodes();
    showAlert('Created!', `Gift code "${data.code}" is now active and ready to use.`);
  };

  const handleToggle = (id: string, currentActive: boolean) => {
    const action = currentActive ? 'Deactivate' : 'Activate';
    showAlert(
      `${action} Code`,
      `Are you sure you want to ${action.toLowerCase()} this gift code?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: currentActive ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase
              .from('gift_codes')
              .update({ is_active: !currentActive })
              .eq('id', id);

            if (error) {
              showAlert('Error', error.message);
              return;
            }
            setCodes(prev => prev.map(c => c.id === id ? { ...c, isActive: !currentActive } : c));
          },
        },
      ]
    );
  };

  const handleCopy = (text: string) => {
    const { Clipboard } = require('react-native');
    try { Clipboard.setString(text); } catch {}
    showAlert('Copied!', `Code "${text}" copied to clipboard.`);
  };

  const filteredCodes = codes.filter(c => {
    const matchSearch = !search.trim() || c.code.includes(search.trim().toUpperCase());
    if (!matchSearch) return false;
    if (filter === 'active') return c.isActive;
    if (filter === 'inactive') return !c.isActive;
    return true;
  });

  const totalCodes = codes.length;
  const activeCodes = codes.filter(c => c.isActive).length;
  const totalRedemptions = codes.reduce((s, c) => s + c.usedCount, 0);
  const totalStarsGiven = codes.reduce((s, c) => s + c.usedCount * c.stars, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Gift Codes</Text>
            <Text style={styles.subtitle}>Create and manage promo codes</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={styles.createBtn}
            activeOpacity={0.85}
          >
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Codes', value: totalCodes, icon: 'confirmation-number', color: Colors.warning },
            { label: 'Active', value: activeCodes, icon: 'check-circle', color: Colors.success },
            { label: 'Redeemed', value: totalRedemptions, icon: 'people', color: Colors.info },
            { label: 'Stars Sent', value: totalStarsGiven.toLocaleString(), icon: 'star', color: Colors.gold },
          ].map(stat => (
            <View key={stat.label} style={[styles.statCard, { borderColor: stat.color + '33' }]}>
              <MaterialIcons name={stat.icon as any} size={18} color={stat.color} />
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by code..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialIcons name="close" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        <View style={styles.list}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : filteredCodes.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="confirmation-number" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {search ? 'No codes match your search' : 'No gift codes yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {search ? 'Try a different search term' : 'Tap "New" to create your first gift code'}
              </Text>
              {!search && (
                <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.emptyCreateBtn} activeOpacity={0.85}>
                  <LinearGradient
                    colors={Colors.gradientPink as [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.emptyCreateGrad}
                  >
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.emptyCreateText}>Create Gift Code</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredCodes.map(code => (
              <CodeCard
                key={code.id}
                code={code}
                onToggle={handleToggle}
                onCopy={handleCopy}
              />
            ))
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <CreateCodeModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
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
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  createBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.sm, alignItems: 'center', gap: 4,
    borderWidth: 1,
  },
  statVal: { fontSize: FontSize.md, fontWeight: '800' },
  statLabel: { fontSize: 9, color: Colors.textSecondary, textAlign: 'center' },
  searchRow: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  searchInput: { flex: 1, height: 44, color: Colors.textPrimary, fontSize: FontSize.sm },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyCreateBtn: { marginTop: Spacing.md },
  emptyCreateGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: 12, borderRadius: BorderRadius.full,
  },
  emptyCreateText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});
