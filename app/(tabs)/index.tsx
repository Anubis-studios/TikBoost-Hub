import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import { getUserLevel } from '@/services/mockData';

// ─── Streak Milestones ──────────────────────────────────────────────────────────

const STREAK_MILESTONES = [
  { day: 7, stars: 500, label: '7-Day Streak', icon: 'local-fire-department', color: Colors.warning, taskId: 'streak_milestone_7' },
  { day: 14, stars: 1000, label: '14-Day Streak', icon: 'whatshot', color: Colors.primary, taskId: 'streak_milestone_14' },
  { day: 30, stars: 3000, label: '30-Day VIP', icon: 'workspace-premium', color: Colors.gold, taskId: 'streak_milestone_30', grantsVIP: true },
];

function StreakMilestoneCard({ loginStreak, completedTaskIds, onMilestoneClaim }: {
  loginStreak: number;
  completedTaskIds: string[];
  onMilestoneClaim: (milestone: typeof STREAK_MILESTONES[0]) => void;
}) {
  const nextMilestone = STREAK_MILESTONES.find(m => loginStreak < m.day && !completedTaskIds.includes(m.taskId));
  const allClaimed = STREAK_MILESTONES.every(m => completedTaskIds.includes(m.taskId));

  if (allClaimed) return null;

  return (
    <View style={milestoneStyles.card}>
      <View style={milestoneStyles.header}>
        <MaterialIcons name="emoji-events" size={18} color={Colors.gold} />
        <Text style={milestoneStyles.title}>Streak Milestones</Text>
      </View>

      {STREAK_MILESTONES.map((m) => {
        const claimed = completedTaskIds.includes(m.taskId);
        const reached = loginStreak >= m.day;
        const claimable = reached && !claimed;
        const progress = Math.min(loginStreak / m.day, 1);

        return (
          <View key={m.taskId} style={milestoneStyles.milestone}>
            <View style={[milestoneStyles.milestoneIcon, {
              backgroundColor: claimed ? m.color + '22' : claimable ? m.color + '33' : Colors.surfaceElevated,
            }]}>
              <MaterialIcons
                name={m.icon as any}
                size={18}
                color={claimed ? m.color : claimable ? m.color : Colors.textMuted}
              />
            </View>
            <View style={milestoneStyles.milestoneInfo}>
              <View style={milestoneStyles.milestoneRow}>
                <Text style={[milestoneStyles.milestoneLabel, claimed && { color: Colors.textMuted }]}>{m.label}</Text>
                <Text style={[milestoneStyles.milestoneReward, { color: m.color }]}>+{m.stars.toLocaleString()} ★{m.grantsVIP ? ' + VIP' : ''}</Text>
              </View>
              <View style={milestoneStyles.progressTrack}>
                <View style={[milestoneStyles.progressFill, {
                  width: `${progress * 100}%` as any,
                  backgroundColor: claimed ? Colors.success : m.color,
                }]} />
              </View>
              <Text style={milestoneStyles.progressLabel}>
                {claimed ? 'Claimed!' : `Day ${loginStreak} / ${m.day}`}
              </Text>
            </View>
            {claimable && (
              <TouchableOpacity onPress={() => onMilestoneClaim(m)} style={[milestoneStyles.claimBtn, { backgroundColor: m.color }]}>
                <Text style={milestoneStyles.claimBtnText}>CLAIM</Text>
              </TouchableOpacity>
            )}
            {claimed && (
              <MaterialIcons name="check-circle" size={22} color={Colors.success} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const milestoneStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  milestoneIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  milestoneInfo: { flex: 1 },
  milestoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  milestoneLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  milestoneReward: { fontSize: FontSize.xs, fontWeight: '700' },
  progressTrack: {
    height: 5, backgroundColor: Colors.surfaceElevated, borderRadius: 3,
    overflow: 'hidden', marginBottom: 3,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 10, color: Colors.textMuted },
  claimBtn: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  claimBtnText: { fontSize: 11, fontWeight: '800', color: '#fff' },
});

// ─── Celebration Overlay ────────────────────────────────────────────────────────

function CelebrationOverlay({ visible, stars, label, onDone }: {
  visible: boolean;
  stars: number;
  label: string;
  onDone: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(onDone);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[celebStyles.overlay, { opacity: fadeAnim }]}>
      <Animated.View style={[celebStyles.card, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient colors={['#2A1A00', '#1A0D00']} style={celebStyles.cardInner}>
          <Text style={celebStyles.emoji}>🎉</Text>
          <Text style={celebStyles.title}>Milestone Unlocked!</Text>
          <Text style={celebStyles.label}>{label}</Text>
          <LinearGradient colors={Colors.gradientGold as [string, string]} style={celebStyles.starsBadge}>
            <MaterialIcons name="star" size={20} color="#000" />
            <Text style={celebStyles.starsText}>+{stars.toLocaleString()} Stars</Text>
          </LinearGradient>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const celebStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999,
  },
  card: { width: 280, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,215,0,0.4)' },
  cardInner: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 52 },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  starsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.lg, paddingVertical: 12, marginTop: Spacing.sm,
  },
  starsText: { fontSize: FontSize.xl, fontWeight: '800', color: '#000' },
});

// ─── Main Home Screen ───────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, checkDailyStreak, upgradeVIP, unreadCount, addStars, markTaskComplete, addNotification } = useUser();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [streakChecked, setStreakChecked] = useState(false);
  const [celebration, setCelebration] = useState<{ visible: boolean; stars: number; label: string }>({
    visible: false, stars: 0, label: '',
  });

  useEffect(() => {
    if (user && !streakChecked) {
      setStreakChecked(true);
      checkDailyStreak().then(({ streakContinued, bonusStars }) => {
        if (bonusStars > 0) {
          showAlert(
            streakContinued ? `Day ${user.loginStreak + 1} Streak!` : 'Welcome Back!',
            `You earned +${bonusStars} bonus stars for your daily login!`
          );
        }
      });
    }
  }, [user]);

  const handleMilestoneClaim = useCallback(async (milestone: typeof STREAK_MILESTONES[0]) => {
    if (!user) return;
    try {
      await addStars(milestone.stars, `Streak milestone: ${milestone.label}`, 'streak_milestone');
      await markTaskComplete(milestone.taskId);

      if (milestone.grantsVIP) {
        await upgradeVIP();
      }

      await addNotification(
        'Milestone Unlocked!',
        `You reached ${milestone.label} and earned +${milestone.stars} stars!${milestone.grantsVIP ? ' Plus 7 days VIP!' : ''}`,
        'milestone'
      );

      setCelebration({ visible: true, stars: milestone.stars, label: milestone.label });
    } catch (err) {
      showAlert('Error', 'Could not claim milestone. Please try again.');
    }
  }, [user, addStars, markTaskComplete, upgradeVIP, addNotification]);

  if (!user) return null;

  const { currentLevel, nextLevel } = getUserLevel(user.totalStarsEarned);
  const progressToNext = nextLevel
    ? (user.totalStarsEarned - currentLevel.minStars) / (nextLevel.minStars - currentLevel.minStars)
    : 1;

  const handleVIP = () => {
    if (user.isVIP) {
      showAlert('VIP Active', 'You already have VIP membership. Enjoy your benefits!');
      return;
    }
    showAlert(
      'Upgrade to VIP',
      'Get VIP for 30 days and receive:\n\n• 500 bonus stars instantly\n• 2x star earning rate\n• Priority boost placement\n• Exclusive VIP badge',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate VIP',
          onPress: async () => {
            await upgradeVIP();
            showAlert('VIP Activated!', 'You got 500 bonus stars and 30 days VIP access!');
          },
        },
      ]
    );
  };

  const streakDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIndex = new Date().getDay();
  const adjustedToday = todayIndex === 0 ? 6 : todayIndex - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Celebration overlay */}
      <CelebrationOverlay
        visible={celebration.visible}
        stars={celebration.stars}
        label={celebration.label}
        onDone={() => setCelebration(prev => ({ ...prev, visible: false }))}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, {user.tiktokUsername || 'Creator'}</Text>
            <Text style={styles.subGreeting}>Keep growing your TikTok!</Text>
          </View>
          <View style={styles.headerRight}>
            {user.isVIP && (
              <View style={styles.vipBadge}>
                <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />
                <Text style={styles.vipText}>VIP</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.bellBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="notifications-none" size={24} color={Colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stars Card */}
        <Pressable onPress={() => router.push('/transactions')} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
          <LinearGradient
            colors={['#2A0A14', '#1A0A10', '#0D0D0D']}
            style={styles.starsCard}
          >
            <LinearGradient
              colors={['rgba(255,45,85,0.3)', 'transparent']}
              style={styles.starsGlow}
            />
            <View style={styles.starsRow}>
              <View>
                <Text style={styles.starsLabel}>Your Stars</Text>
                <View style={styles.starsValueRow}>
                  <MaterialIcons name="star" size={32} color={Colors.gold} />
                  <Text style={styles.starsValue}>{user.stars.toLocaleString()}</Text>
                </View>
                <View style={styles.historyHint}>
                  <MaterialIcons name="history" size={12} color={Colors.textMuted} />
                  <Text style={styles.starsEarned}>View transaction history</Text>
                </View>
              </View>
              <View style={styles.levelBadge}>
                <MaterialIcons name="emoji-events" size={28} color={currentLevel.color} />
                <Text style={[styles.levelName, { color: currentLevel.color }]}>{currentLevel.name}</Text>
                <Text style={styles.levelNum}>Lv.{currentLevel.level}</Text>
              </View>
            </View>
            {nextLevel && (
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Progress to {nextLevel.name}</Text>
                  <Text style={styles.progressPct}>{Math.round(progressToNext * 100)}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={Colors.gradientPink as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.max(2, Math.round(progressToNext * 100))}%` }]}
                  />
                </View>
                <Text style={styles.progressHint}>
                  {(nextLevel.minStars - user.totalStarsEarned).toLocaleString()} stars to {nextLevel.name}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/earn')} activeOpacity={0.8}>
            <LinearGradient colors={['#2A1A00', '#1A1A1A']} style={styles.quickCardGrad}>
              <MaterialIcons name="star" size={28} color={Colors.gold} />
              <Text style={styles.quickLabel}>Earn Stars</Text>
              <Text style={styles.quickSub}>Tasks & games</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/boost')} activeOpacity={0.8}>
            <LinearGradient colors={['#1A001A', '#1A1A1A']} style={styles.quickCardGrad}>
              <MaterialIcons name="rocket-launch" size={28} color={Colors.primary} />
              <Text style={styles.quickLabel}>Boost Now</Text>
              <Text style={styles.quickSub}>Spend stars</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/leaderboard')} activeOpacity={0.8}>
            <LinearGradient colors={['#1A1000', '#1A1A1A']} style={styles.quickCardGrad}>
              <MaterialIcons name="emoji-events" size={28} color={Colors.gold} />
              <Text style={styles.quickLabel}>Leaderboard</Text>
              <Text style={styles.quickSub}>Top creators</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/tools')} activeOpacity={0.8}>
            <LinearGradient colors={['#001A1A', '#1A1A1A']} style={styles.quickCardGrad}>
              <MaterialIcons name="auto-awesome" size={28} color="#00D97E" />
              <Text style={styles.quickLabel}>AI Caption</Text>
              <Text style={styles.quickSub}>Go viral</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Streak Milestones */}
        <Text style={styles.sectionTitle}>Streak Milestones</Text>
        <StreakMilestoneCard
          loginStreak={user.loginStreak}
          completedTaskIds={user.completedTaskIds}
          onMilestoneClaim={handleMilestoneClaim}
        />

        {/* Login Streak */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <TouchableOpacity onPress={() => router.push('/login-calendar')}>
            <Text style={styles.seeAll}>View Calendar →</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push('/login-calendar')} activeOpacity={0.85}>
        <View style={styles.streakCard}>
          <View style={styles.streakHeader}>
            <View style={styles.streakInfo}>
              <MaterialIcons name="local-fire-department" size={24} color={Colors.warning} />
              <Text style={styles.streakCount}>{user.loginStreak} Day Streak</Text>
            </View>
            <Text style={styles.streakNote}>+{Math.min(user.loginStreak * 25, 300)} stars/day</Text>
          </View>
          <View style={styles.streakDays}>
            {streakDays.map((day, i) => {
              const isCurrent = i === adjustedToday;
              const isPast = i < adjustedToday;
              return (
                <View key={i} style={styles.streakDayItem}>
                  <View style={[
                    styles.streakDot,
                    isCurrent && styles.streakDotCurrent,
                    isPast && styles.streakDotPast,
                  ]}>
                    {(isPast || isCurrent) ? (
                      <MaterialIcons name="star" size={12} color={isCurrent ? '#fff' : Colors.gold} />
                    ) : null}
                  </View>
                  <Text style={[styles.streakDayText, isCurrent && styles.streakDayTextActive]}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>
        </TouchableOpacity>

        {/* VIP Expiry Warning Banner */}
        {user.isVIP && user.vipExpiresAt && (() => {
          const expiryDate = new Date(user.vipExpiresAt);
          const now = new Date();
          const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 0 && daysLeft <= 3) {
            return (
              <TouchableOpacity
                onPress={async () => {
                  const { FunctionsHttpError } = await import('@supabase/supabase-js');
                  const { getSupabaseClient } = await import('@/template');
                  const supabase = getSupabaseClient();
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData?.session?.access_token;
                  if (!token) return;
                  const { data, error } = await supabase.functions.invoke('create-vip-payment', {
                    body: {},
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!error && data?.url) {
                    const { Linking } = await import('react-native');
                    await Linking.openURL(data.url);
                  }
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(255,184,0,0.2)', 'rgba(255,184,0,0.08)']}
                  style={styles.vipExpiryBanner}
                >
                  <MaterialIcons name="warning-amber" size={20} color={Colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vipExpiryTitle}>VIP Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}!</Text>
                    <Text style={styles.vipExpirySub}>Tap to renew VIP — £4.99 for 30 more days</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.warning} />
                </LinearGradient>
              </TouchableOpacity>
            );
          }
          return null;
        })()}

        {/* Active Boosts */}
        {user.activeBoosts.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Active Boosts</Text>
              <TouchableOpacity onPress={() => router.push('/orders')}>
                <Text style={styles.seeAll}>See Orders →</Text>
              </TouchableOpacity>
            </View>
            {user.activeBoosts.slice(0, 2).map((boost) => (
              <View key={boost.id} style={styles.boostCard}>
                <MaterialIcons name="rocket-launch" size={20} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={styles.boostLabel}>{boost.label}</Text>
                  <Text style={styles.boostReach}>{boost.reach} reach</Text>
                </View>
                <View style={styles.boostBadge}>
                  <Text style={styles.boostBadgeText}>LIVE</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* VIP Banner */}
        {!user.isVIP && (
          <TouchableOpacity onPress={handleVIP} activeOpacity={0.85}>
            <LinearGradient
              colors={['#2A1A00', '#1A0A00']}
              style={styles.vipBanner}
            >
              <View style={styles.vipBannerLeft}>
                <MaterialIcons name="workspace-premium" size={28} color={Colors.gold} />
                <View>
                  <Text style={styles.vipBannerTitle}>Upgrade to VIP</Text>
                  <Text style={styles.vipBannerSub}>+500 stars • 2x earning • Priority boost</Text>
                </View>
              </View>
              <LinearGradient
                colors={Colors.gradientGold as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.vipBannerBtn}
              >
                <Text style={styles.vipBannerBtnText}>GO VIP</Text>
              </LinearGradient>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  greeting: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  subGreeting: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  vipBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  vipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.gold },
  bellBtn: { position: 'relative', padding: 4 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: Colors.primary, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  starsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.2)',
    overflow: 'hidden',
    position: 'relative',
    ...Shadow.pink,
  },
  starsGlow: { position: 'absolute', top: 0, right: 0, width: 200, height: 200, borderRadius: 100 },
  starsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  starsLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  starsValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  starsValue: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary },
  historyHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  starsEarned: { fontSize: FontSize.xs, color: Colors.textMuted },
  levelBadge: {
    alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  levelName: { fontSize: FontSize.xs, fontWeight: '700', marginTop: 4 },
  levelNum: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  progressSection: { marginTop: Spacing.xs },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressPct: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: BorderRadius.full },
  progressHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  seeAll: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  quickCard: { width: '47.5%', borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.surfaceBorder },
  quickCardGrad: { padding: Spacing.md, gap: 6 },
  quickLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  quickSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  streakCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  streakInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  streakCount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  streakNote: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: '600' },
  streakDays: { flexDirection: 'row', justifyContent: 'space-between' },
  streakDayItem: { alignItems: 'center', gap: 4 },
  streakDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  streakDotCurrent: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  streakDotPast: { backgroundColor: 'rgba(255,215,0,0.15)', borderColor: 'rgba(255,215,0,0.3)' },
  streakDayText: { fontSize: 10, color: Colors.textMuted },
  streakDayTextActive: { color: Colors.primary, fontWeight: '700' },
  boostCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  boostLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  boostReach: { fontSize: FontSize.xs, color: Colors.textSecondary },
  boostBadge: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  boostBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  vipBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  vipBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  vipBannerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  vipBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  vipBannerBtn: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  vipBannerBtnText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textInverse },
  vipExpiryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.4)',
  },
  vipExpiryTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.warning, marginBottom: 2 },
  vipExpirySub: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
