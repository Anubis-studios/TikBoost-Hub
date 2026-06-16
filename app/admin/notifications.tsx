import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const NOTIFICATION_TEMPLATES = [
  { title: 'New Feature Alert!', body: 'We just launched something amazing. Check it out in the app now!', type: 'general' },
  { title: 'Double Stars Weekend!', body: 'Earn 2x stars on all tasks this weekend only. Start earning now!', type: 'promo' },
  { title: 'VIP Sale — 50% Off!', body: 'Upgrade to VIP now and enjoy all premium features at half price!', type: 'promo' },
  { title: 'Maintenance Notice', body: 'We will have a brief maintenance window tonight at 2 AM UTC.', type: 'system' },
  { title: 'Referral Bonus Increased!', body: 'Earn 200 stars (up from 150) per friend you refer. Share now!', type: 'promo' },
];

const NOTIFICATION_TYPES = [
  { key: 'general', label: 'General', color: Colors.info },
  { key: 'promo', label: 'Promo', color: Colors.gold },
  { key: 'system', label: 'System', color: Colors.warning },
  { key: 'referral', label: 'Referral', color: Colors.purple },
  { key: 'boost', label: 'Boost', color: Colors.primary },
  { key: 'vip', label: 'VIP', color: Colors.gold },
];

interface SentNotif {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
}

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('general');
  const [targetMode, setTargetMode] = useState<'all' | 'vip' | 'single'>(userId ? 'single' : 'all');
  const [targetUserId, setTargetUserId] = useState(userId || '');
  const [targetUsername, setTargetUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<SentNotif[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentNotifs(data || []);
    setLoadingHistory(false);
  }, [supabase]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const resolveTargetUsers = async (): Promise<string[]> => {
    if (targetMode === 'single') {
      if (targetUserId.trim()) return [targetUserId.trim()];
      if (targetUsername.trim()) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('tiktok_username', targetUsername.trim())
          .limit(1);
        return data?.map((u: any) => u.id) || [];
      }
      return [];
    }
    if (targetMode === 'vip') {
      const { data } = await supabase.from('user_profiles').select('id').eq('is_vip', true);
      return data?.map((u: any) => u.id) || [];
    }
    // All
    const { data } = await supabase.from('user_profiles').select('id');
    return data?.map((u: any) => u.id) || [];
  };

  const [sendProgress, setSendProgress] = useState<{ total: number; inserted: number } | null>(null);

  const sendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Missing Fields', 'Please enter a title and message body.');
      return;
    }
    setSending(true);
    setSendProgress(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { FunctionsHttpError } = await import('@supabase/supabase-js');
      const { data, error } = await supabase.functions.invoke('admin-broadcast', {
        body: {
          title: title.trim(),
          body: body.trim(),
          type,
          target_mode: targetMode,
          target_user_id: targetMode === 'single' ? targetUserId.trim() : undefined,
          target_username: targetMode === 'single' ? targetUsername.trim() : undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text(); } catch {}
        }
        throw new Error(msg);
      }

      if (data?.inserted !== undefined) {
        setSendProgress({ total: data.total, inserted: data.inserted });
      }

      showAlert(
        'Broadcast Sent!',
        `Notification delivered to ${data?.inserted ?? '?'} of ${data?.total ?? '?'} users.`
      );
      setTitle('');
      setBody('');
      await loadHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  };

  const typeColor = NOTIFICATION_TYPES.find(t => t.key === type)?.color || Colors.info;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Send Notifications</Text>
        </View>

        {/* Target Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Audience</Text>
          <View style={styles.targetRow}>
            {[
              { key: 'all', label: 'All Users', icon: 'people' },
              { key: 'vip', label: 'VIP Only', icon: 'workspace-premium' },
              { key: 'single', label: 'One User', icon: 'person' },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.targetBtn, targetMode === m.key && styles.targetBtnActive]}
                onPress={() => setTargetMode(m.key as any)}
              >
                <MaterialIcons name={m.icon as any} size={16} color={targetMode === m.key ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.targetBtnText, targetMode === m.key && styles.targetBtnTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {targetMode === 'single' && (
            <>
              <Text style={styles.fieldLabel}>User ID or @username</Text>
              <View style={styles.field}>
                <MaterialIcons name="search" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="@username or user UUID"
                  placeholderTextColor={Colors.textMuted}
                  value={targetUsername}
                  onChangeText={setTargetUsername}
                  autoCapitalize="none"
                />
              </View>
            </>
          )}
        </View>

        {/* Templates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateBar}>
            {NOTIFICATION_TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t.title}
                style={styles.templateChip}
                onPress={() => { setTitle(t.title); setBody(t.body); setType(t.type); }}
              >
                <Text style={styles.templateChipText} numberOfLines={1}>{t.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Compose */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compose</Text>

          {/* Type selector */}
          <Text style={styles.fieldLabel}>Notification Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeBar}>
            {NOTIFICATION_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, { borderColor: type === t.key ? t.color : Colors.surfaceBorder, backgroundColor: type === t.key ? t.color + '22' : Colors.surface }]}
                onPress={() => setType(t.key)}
              >
                <Text style={[styles.typeChipText, { color: type === t.key ? t.color : Colors.textSecondary }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Title</Text>
          <View style={styles.field}>
            <MaterialIcons name="title" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Notification title..."
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <Text style={styles.fieldLabel}>Message</Text>
          <View style={[styles.field, styles.fieldMultiline]}>
            <TextInput
              style={[styles.fieldInput, styles.messageInput]}
              placeholder="Write your notification message here..."
              placeholderTextColor={Colors.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Preview */}
          {(title || body) && (
            <View style={[styles.preview, { borderColor: typeColor + '44' }]}>
              <View style={styles.previewHeader}>
                <MaterialIcons name="notifications" size={16} color={typeColor} />
                <Text style={[styles.previewApp, { color: typeColor }]}>TikBoost · {type}</Text>
              </View>
              <Text style={styles.previewTitle}>{title || 'Notification Title'}</Text>
              <Text style={styles.previewBody} numberOfLines={3}>{body || 'Your message will appear here.'}</Text>
            </View>
          )}

          {/* Progress result */}
          {sendProgress && (
            <View style={styles.progressCard}>
              <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.progressTitle}>Broadcast Complete</Text>
                <Text style={styles.progressSub}>
                  {sendProgress.inserted} / {sendProgress.total} notifications delivered
                </Text>
              </View>
              <View style={[styles.progressBadge, { backgroundColor: Colors.success + '22' }]}>
                <Text style={[styles.progressBadgeText, { color: Colors.success }]}>
                  {Math.round((sendProgress.inserted / Math.max(sendProgress.total, 1)) * 100)}%
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity onPress={sendNotification} disabled={sending} activeOpacity={0.85}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.sendBtn}
            >
              {sending ? (
                <View style={styles.sendingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.sendBtnText}>Sending broadcast...</Text>
                </View>
              ) : (
                <>
                  <MaterialIcons name="campaign" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>
                    Broadcast to {targetMode === 'all' ? 'All Users' : targetMode === 'vip' ? 'VIP Users' : 'User'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          {loadingHistory ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <View style={styles.historyList}>
              {recentNotifs.map((n) => {
                const color = NOTIFICATION_TYPES.find(t => t.key === n.type)?.color || Colors.info;
                return (
                  <View key={n.id} style={styles.historyRow}>
                    <View style={[styles.historyDot, { backgroundColor: color }]} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{n.title}</Text>
                      <Text style={styles.historyBody} numberOfLines={1}>{n.body}</Text>
                    </View>
                    <Text style={styles.historyDate}>
                      {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

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
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  targetRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  targetBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  targetBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  targetBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  targetBtnTextActive: { color: '#fff' },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.sm,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: Spacing.sm },
  fieldInput: { flex: 1, height: 46, color: Colors.textPrimary, fontSize: FontSize.sm },
  messageInput: { height: 96, paddingTop: 4 },
  templateBar: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.md },
  templateChip: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder, maxWidth: 200,
  },
  templateChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  typeBar: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm },
  typeChip: {
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md,
    paddingVertical: 7, borderWidth: 1,
  },
  typeChipText: { fontSize: FontSize.xs, fontWeight: '700' },
  preview: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md,
    gap: 4,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  previewApp: { fontSize: 11, fontWeight: '700' },
  previewTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  previewBody: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  sendBtn: {
    height: 52, borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: Spacing.sm,
  },
  sendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sendBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  progressCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(0,209,126,0.3)',
  },
  progressTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  progressSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  progressBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 5 },
  progressBadgeText: { fontSize: FontSize.sm, fontWeight: '800' },
  historyList: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.surfaceBorder, overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  historyBody: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  historyDate: { fontSize: FontSize.xs, color: Colors.textMuted },
});
