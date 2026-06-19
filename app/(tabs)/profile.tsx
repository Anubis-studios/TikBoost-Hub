import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import { getUserLevel, LEVELS } from '@/services/mockData';
import { Share, Clipboard, Platform } from 'react-native';
import { VIP_PLAN, connectIAP, purchaseProduct, completePurchase } from '@/services/iapService';

export default function ProfileScreen() {
  const { user, signOut, upgradeVIP, refreshUser } = useUser();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [vipLoading, setVipLoading] = useState(false);
  const supabase = getSupabaseClient();

  const { currentLevel, nextLevel } = getUserLevel(user?.totalStarsEarned ?? 0);

  const handleShare = async () => {
    try {
      const deepLink = `onspaceapp://ref/${user.referralCode}`;
      const webLink = `https://tikboost.app/ref/${user.referralCode}`;
      await Share.share({
        message: `Join TikBoost and grow your TikTok! Use my referral code: ${user.referralCode} to get +150 bonus stars!\n\nApp link: ${deepLink}\nWeb: ${webLink}`,
        title: 'Join TikBoost',
      });
    } catch (e) {
      showAlert('Share Failed', 'Could not open share dialog.');
    }
  };

  const copyReferralCode = () => {
    Clipboard.setString(user.referralCode);
    showAlert('Copied!', `Referral code ${user.referralCode} copied to clipboard.`);
  };

  const handleSignOut = () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  // Handle deep link return — no longer needed with IAP
  if (!user) return null;

  const handleVIP = async () => {
    if (user.isVIP) {
      const expires = user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleDateString() : 'N/A';
      showAlert('VIP Active', `Your VIP membership is active until ${expires}. Enjoy 2x stars and priority boost!`);
      return;
    }
    showAlert(
      `Upgrade to VIP — ${VIP_PLAN.price}`,
      `VIP Benefits for ${VIP_PLAN.days} days:\n\n• +${VIP_PLAN.bonusStars} bonus stars instantly\n• 2x star earning on all tasks\n• Priority boost placement\n• Exclusive VIP profile badge\n\nPurchase via ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy ${VIP_PLAN.price}`,
          onPress: async () => {
            setVipLoading(true);
            try {
              await connectIAP();
              const purchase = await purchaseProduct(VIP_PLAN.productId);
              if (!purchase) { setVipLoading(false); return; }

              // Verify with backend
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              if (token) {
                await supabase.functions.invoke('verify-iap-purchase', {
                  body: {
                    product_id: VIP_PLAN.productId,
                    purchase_token: purchase.purchaseToken || purchase.transactionId,
                    platform: Platform.OS,
                  },
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
              }

              await completePurchase(purchase);
              await upgradeVIP();
              await refreshUser();
              showAlert('VIP Activated!', `You received ${VIP_PLAN.bonusStars} bonus stars and ${VIP_PLAN.days} days of VIP access!`);
            } catch (err: any) {
              showAlert('Purchase Error', err.message || 'Could not complete purchase. Please try again.');
            } finally {
              setVipLoading(false);
            }
          },
        },
      ]
    );
  };

  const completedCount = user.completedTaskIds.length;
  const referralBonus = 150;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={handleSignOut}>
            <MaterialIcons name="logout" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <LinearGradient colors={['#2A0A14', '#1A0A10', '#0D0D0D']} style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <LinearGradient colors={Colors.gradientPink as [string, string]} style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.tiktokUsername || 'U').replace('@', '').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
            {user.isVIP && (
              <View style={styles.vipBadgeAvatar}>
                <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />
              </View>
            )}
          </View>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{user.tiktokUsername || 'Creator'}</Text>
            <TouchableOpacity onPress={() => router.push('/edit-profile')} style={styles.editBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="edit" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="star" size={20} color={Colors.gold} />
              <Text style={styles.statValue}>{user.stars.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Stars</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="local-fire-department" size={20} color={Colors.warning} />
              <Text style={styles.statValue}>{user.loginStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>Tasks Done</Text>
            </View>
          </View>

          <View style={[styles.levelBadge, { borderColor: currentLevel.color + '44' }]}>
            <MaterialIcons name="emoji-events" size={18} color={currentLevel.color} />
            <Text style={[styles.levelText, { color: currentLevel.color }]}>
              {currentLevel.name} — Level {currentLevel.level}
            </Text>
          </View>
        </LinearGradient>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/transactions')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.gold + '22' }]}>
              <MaterialIcons name="history" size={20} color={Colors.gold} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Transaction History</Text>
              <Text style={styles.quickLinkSub}>Star earn & spend log</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/orders')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.primary + '22' }]}>
              <MaterialIcons name="rocket-launch" size={20} color={Colors.primary} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Boost Orders</Text>
              <Text style={styles.quickLinkSub}>Track all your boosts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.info + '22' }]}>
              <MaterialIcons name="notifications" size={20} color={Colors.info} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Notifications</Text>
              <Text style={styles.quickLinkSub}>Alerts and updates</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/buy-stars')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.gold + '22' }]}>
              <MaterialIcons name="star" size={20} color={Colors.gold} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Buy Stars</Text>
              <Text style={styles.quickLinkSub}>Top up your star balance instantly</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/redeem-gift')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.warning + '22' }]}>
              <MaterialIcons name="card-giftcard" size={20} color={Colors.warning} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Redeem Gift Code</Text>
              <Text style={styles.quickLinkSub}>Enter a code to claim free stars</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/rewards')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.gold + '22' }]}>
              <MaterialIcons name="emoji-events" size={20} color={Colors.gold} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Rewards</Text>
              <Text style={styles.quickLinkSub}>Win TikTok followers — monthly and weekly</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/subscription')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.gold + '22' }]}>
              <MaterialIcons name="workspace-premium" size={20} color={Colors.gold} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Subscription Plans</Text>
              <Text style={styles.quickLinkSub}>
                {user.subscriptionTier && user.subscriptionTier !== 'free'
                  ? `Active: ${user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1)} plan`
                  : 'Upgrade for 1.5x–2x star multiplier'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          {user.isAdmin && (
            <>
              <View style={styles.quickLinkDivider} />
              <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/admin')} activeOpacity={0.8}>
                <View style={[styles.quickLinkIcon, { backgroundColor: Colors.primary + '22' }]}>
                  <MaterialIcons name="admin-panel-settings" size={20} color={Colors.primary} />
                </View>
                <View style={styles.quickLinkInfo}>
                  <Text style={styles.quickLinkTitle}>Admin Control Hub</Text>
                  <Text style={styles.quickLinkSub}>Manage users, orders & analytics</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/notification-settings')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.success + '22' }]}>
              <MaterialIcons name="notifications-active" size={20} color={Colors.success} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Notification Settings</Text>
              <Text style={styles.quickLinkSub}>Manage what alerts you receive</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/help')} activeOpacity={0.8}>
            <View style={[styles.quickLinkIcon, { backgroundColor: Colors.success + '22' }]}>
              <MaterialIcons name="help-outline" size={20} color={Colors.success} />
            </View>
            <View style={styles.quickLinkInfo}>
              <Text style={styles.quickLinkTitle}>Help & FAQ</Text>
              <Text style={styles.quickLinkSub}>Answers to common questions</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* VIP */}
        <TouchableOpacity onPress={handleVIP} activeOpacity={0.85}>
          <LinearGradient
            colors={user.isVIP ? ['#2A1A00', '#1A1200'] : ['#2A1A00', '#1A0A00']}
            style={styles.vipCard}
          >
            <View style={styles.vipLeft}>
              <MaterialIcons name="workspace-premium" size={28} color={Colors.gold} />
              <View>
                <Text style={styles.vipTitle}>{user.isVIP ? 'VIP Active' : 'Upgrade to VIP'}</Text>
                <Text style={styles.vipSub}>
                  {user.isVIP ? 'Enjoying 2x stars and priority boost' : '+500 stars • 2x earning • Priority boost'}
                </Text>
              </View>
            </View>
            <View style={[styles.vipStatus, { backgroundColor: user.isVIP ? Colors.gold + '22' : Colors.surface }]}>
              {vipLoading ? (
                <ActivityIndicator size="small" color={Colors.gold} />
              ) : (
                <Text style={[styles.vipStatusText, { color: user.isVIP ? Colors.gold : Colors.textSecondary }]}>
                  {user.isVIP ? 'ACTIVE' : VIP_PLAN.price}
                </Text>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Referral */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral Program</Text>
          <View style={styles.referralCard}>
            <LinearGradient colors={['rgba(139,92,246,0.15)', 'transparent']} style={styles.referralGlow} />
            <View style={styles.referralHeader}>
              <MaterialIcons name="share" size={20} color={Colors.purple} />
              <Text style={styles.referralTitle}>Earn {referralBonus} stars per friend</Text>
            </View>
            <Text style={styles.referralDesc}>
              Share your referral code with friends. When they sign up and complete their first task, you both earn bonus stars!
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{user.referralCode || 'Loading...'}</Text>
                <TouchableOpacity onPress={copyReferralCode} style={styles.copyCodeBtn}>
                  <MaterialIcons name="content-copy" size={16} color={Colors.purple} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={handleShare} activeOpacity={0.85}>
              <LinearGradient colors={['#4C1D95', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shareBtn}>
                <MaterialIcons name="share" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share Referral Link</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Level Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Level Progress</Text>
          <View style={styles.levelsCard}>
            {LEVELS.map((level) => {
              const isCurrentLevel = level.level === currentLevel.level;
              const isUnlocked = user.totalStarsEarned >= level.minStars;
              return (
                <View key={level.level} style={styles.levelRow}>
                  <View style={[styles.levelDot, { backgroundColor: isUnlocked ? level.color : Colors.surfaceElevated }]}>
                    {isUnlocked
                      ? <MaterialIcons name="check" size={14} color="#fff" />
                      : <MaterialIcons name="lock" size={12} color={Colors.textMuted} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.levelRowName, { color: isUnlocked ? level.color : Colors.textMuted }]}>
                      {level.name}{isCurrentLevel ? ' (Current)' : ''}
                    </Text>
                    <Text style={styles.levelRowReq}>{level.minStars.toLocaleString()} total stars</Text>
                  </View>
                  {isCurrentLevel && (
                    <View style={[styles.currentBadge, { backgroundColor: level.color + '22', borderColor: level.color + '44' }]}>
                      <Text style={[styles.currentBadgeText, { color: level.color }]}>NOW</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={18} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  profileCard: {
    margin: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)', ...Shadow.pink,
  },
  avatarContainer: { position: 'relative', marginBottom: Spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  vipBadgeAvatar: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.surfaceElevated, borderRadius: 12,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.gold,
  },
  username: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  editBtn: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: Colors.surfaceBorder },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    width: '100%', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.surfaceBorder },
  statValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: Colors.surface,
  },
  levelText: { fontSize: FontSize.sm, fontWeight: '700' },
  quickLinks: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.surfaceBorder, overflow: 'hidden',
  },
  quickLink: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  quickLinkDivider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md },
  quickLinkIcon: { width: 40, height: 40, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  quickLinkInfo: { flex: 1 },
  quickLinkTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  quickLinkSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  vipCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  vipLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  vipTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  vipSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  vipStatus: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  vipStatusText: { fontSize: FontSize.xs, fontWeight: '800' },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  referralCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
    overflow: 'hidden', position: 'relative',
  },
  referralGlow: { position: 'absolute', top: 0, right: 0, width: 150, height: 150, borderRadius: 75 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  referralTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  referralDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  codeBox: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
  },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.purple, letterSpacing: 2 },
  copyCodeBtn: { backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderRadius: BorderRadius.full, paddingVertical: 14,
  },
  shareBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  levelsCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder, gap: Spacing.md,
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  levelDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  levelRowName: { fontSize: FontSize.sm, fontWeight: '600' },
  levelRowReq: { fontSize: FontSize.xs, color: Colors.textMuted },
  currentBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1 },
  currentBadgeText: { fontSize: 10, fontWeight: '800' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    paddingVertical: 14, borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,69,58,0.1)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.2)',
  },
  signOutText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.error },
});
