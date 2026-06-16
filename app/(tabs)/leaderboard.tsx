import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { fetchLeaderboard, LeaderboardUser } from '@/services/supabaseService';
import { getUserLevel } from '@/services/mockData';
import { getSupabaseClient } from '@/template';

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface ReferralLeader {
  id: string;
  tiktokUsername: string;
  referralCount: number;
  isVIP: boolean;
}

interface SheetUser {
  id: string;
  tiktokUsername: string;
  totalStarsEarned: number;
  loginStreak: number;
  isVIP: boolean;
  completedTasks?: number;
  rank: number;
}

async function fetchReferralLeaders(): Promise<ReferralLeader[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('star_transactions')
    .select('user_id, user_profiles!inner(tiktokUsername:tiktok_username, isVIP:is_vip)')
    .eq('category', 'referral')
    .eq('type', 'earn');

  if (error || !data) return [];

  const counts: Record<string, { count: number; username: string; isVIP: boolean }> = {};
  for (const row of data as any[]) {
    const uid = row.user_id;
    const username = row.user_profiles?.tiktokUsername || 'Unknown';
    const isVIP = row.user_profiles?.isVIP || false;
    if (!counts[uid]) counts[uid] = { count: 0, username, isVIP };
    counts[uid].count += 1;
  }

  return Object.entries(counts)
    .map(([id, v]) => ({ id, tiktokUsername: v.username, referralCount: v.count, isVIP: v.isVIP }))
    .sort((a, b) => b.referralCount - a.referralCount)
    .slice(0, 10);
}

// ─── Profile Bottom Sheet ────────────────────────────────────────────────────────

function ProfileBottomSheet({
  user: sheetUser,
  visible,
  onClose,
  onChallenge,
}: {
  user: SheetUser | null;
  visible: boolean;
  onClose: () => void;
  onChallenge: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!sheetUser) return null;

  const { currentLevel } = getUserLevel(sheetUser.totalStarsEarned);
  const rankColor = sheetUser.rank <= 3 ? RANK_COLORS[sheetUser.rank - 1] : Colors.textMuted;
  const initial = (sheetUser.tiktokUsername || 'U').replace('@', '').charAt(0).toUpperCase();

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sheetStyles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={sheetStyles.handle} />

          {/* Avatar & Rank */}
          <View style={sheetStyles.avatarRow}>
            <LinearGradient colors={Colors.gradientPink as [string, string]} style={sheetStyles.avatar}>
              <Text style={sheetStyles.avatarText}>{initial}</Text>
            </LinearGradient>
            <View style={[sheetStyles.rankBadge, { backgroundColor: rankColor + '22', borderColor: rankColor + '44' }]}>
              <Text style={[sheetStyles.rankBadgeText, { color: rankColor }]}>#{sheetUser.rank}</Text>
            </View>
          </View>

          {/* Username */}
          <Text style={sheetStyles.username}>{sheetUser.tiktokUsername}</Text>

          {/* Level */}
          <View style={[sheetStyles.levelBadge, { borderColor: currentLevel.color + '55' }]}>
            <MaterialIcons name="emoji-events" size={14} color={currentLevel.color} />
            <Text style={[sheetStyles.levelText, { color: currentLevel.color }]}>{currentLevel.name} — Lv.{currentLevel.level}</Text>
            {sheetUser.isVIP && (
              <>
                <View style={sheetStyles.dot} />
                <MaterialIcons name="workspace-premium" size={14} color={Colors.gold} />
                <Text style={[sheetStyles.levelText, { color: Colors.gold }]}>VIP</Text>
              </>
            )}
          </View>

          {/* Stats Grid */}
          <View style={sheetStyles.statsGrid}>
            <View style={sheetStyles.statCell}>
              <MaterialIcons name="star" size={22} color={Colors.gold} />
              <Text style={sheetStyles.statValue}>{sheetUser.totalStarsEarned.toLocaleString()}</Text>
              <Text style={sheetStyles.statLabel}>Total Stars</Text>
            </View>
            <View style={sheetStyles.statDivider} />
            <View style={sheetStyles.statCell}>
              <MaterialIcons name="local-fire-department" size={22} color={Colors.warning} />
              <Text style={sheetStyles.statValue}>{sheetUser.loginStreak}</Text>
              <Text style={sheetStyles.statLabel}>Day Streak</Text>
            </View>
            <View style={sheetStyles.statDivider} />
            <View style={sheetStyles.statCell}>
              <MaterialIcons name="check-circle" size={22} color={Colors.success} />
              <Text style={sheetStyles.statValue}>{sheetUser.completedTasks ?? '—'}</Text>
              <Text style={sheetStyles.statLabel}>Tasks Done</Text>
            </View>
          </View>

          {/* Progress bar to next level */}
          {(() => {
            const { nextLevel } = getUserLevel(sheetUser.totalStarsEarned);
            if (!nextLevel) return null;
            const { currentLevel: cl } = getUserLevel(sheetUser.totalStarsEarned);
            const pct = (sheetUser.totalStarsEarned - cl.minStars) / (nextLevel.minStars - cl.minStars);
            return (
              <View style={sheetStyles.progressSection}>
                <View style={sheetStyles.progressLabelRow}>
                  <Text style={sheetStyles.progressLabel}>Progress to {nextLevel.name}</Text>
                  <Text style={sheetStyles.progressPct}>{Math.round(pct * 100)}%</Text>
                </View>
                <View style={sheetStyles.progressBar}>
                  <LinearGradient
                    colors={Colors.gradientPink as [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[sheetStyles.progressFill, { width: `${Math.max(2, Math.round(pct * 100))}%` }]}
                  />
                </View>
              </View>
            );
          })()}

          {/* Challenge Button */}
          <TouchableOpacity onPress={onChallenge} activeOpacity={0.85} style={{ marginTop: Spacing.md }}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={sheetStyles.challengeBtn}
            >
              <MaterialIcons name="rocket-launch" size={18} color="#fff" />
              <Text style={sheetStyles.challengeBtnText}>Challenge — Boost Your Profile</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
            <Text style={sheetStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, paddingBottom: 36, borderWidth: 1,
    borderColor: Colors.surfaceBorder, alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceBorder, marginBottom: Spacing.lg },
  avatarRow: { position: 'relative', marginBottom: Spacing.sm },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  rankBadge: {
    position: 'absolute', bottom: -4, right: -4,
    borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  rankBadgeText: { fontSize: FontSize.xs, fontWeight: '800' },
  username: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.xs },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated, marginBottom: Spacing.lg,
  },
  levelText: { fontSize: FontSize.xs, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.surfaceBorder },
  statsGrid: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.xl,
    padding: Spacing.md, width: '100%', marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 44, backgroundColor: Colors.surfaceBorder },
  statValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressSection: { width: '100%', gap: 6 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressPct: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  progressBar: { height: 6, backgroundColor: Colors.background, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  challengeBtn: {
    width: '100%', height: 52, borderRadius: BorderRadius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  challengeBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  closeBtn: { marginTop: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.lg },
  closeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
});

// ─── Main Screen ────────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [period, setPeriod] = useState<'alltime' | 'weekly'>('alltime');
  const [activeTab, setActiveTab] = useState<'stars' | 'referrals'>('stars');
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [referralLeaders, setReferralLeaders] = useState<ReferralLeader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReferralLoading, setIsReferralLoading] = useState(false);
  const [sheetUser, setSheetUser] = useState<SheetUser | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchLeaderboard(period);
    setLeaders(data);
    setIsLoading(false);
  }, [period]);

  const loadReferrals = useCallback(async () => {
    setIsReferralLoading(true);
    const data = await fetchReferralLeaders();
    setReferralLeaders(data);
    setIsReferralLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === 'referrals' && referralLeaders.length === 0) {
      loadReferrals();
    }
  }, [activeTab]);

  const myRank = leaders.findIndex((l) => l.id === user?.id) + 1;
  const myReferralRank = referralLeaders.findIndex((l) => l.id === user?.id) + 1;

  const openSheet = (leader: LeaderboardUser, rank: number) => {
    setSheetUser({
      id: leader.id,
      tiktokUsername: leader.tiktokUsername,
      totalStarsEarned: leader.totalStarsEarned,
      loginStreak: leader.loginStreak,
      isVIP: leader.isVIP,
      rank,
    });
    setSheetVisible(true);
  };

  const closeSheet = () => {
    setSheetVisible(false);
    setTimeout(() => setSheetUser(null), 300);
  };

  const handleChallenge = () => {
    closeSheet();
    setTimeout(() => router.push('/(tabs)/boost'), 350);
  };

  const renderTopThree = () => {
    const top = leaders.slice(0, 3);
    while (top.length < 3) top.push({ id: '', tiktokUsername: '---', stars: 0, totalStarsEarned: 0, isVIP: false, loginStreak: 0 });
    const order = [top[1], top[0], top[2]];
    const heights = [80, 110, 70];
    const podiumRanks = [2, 1, 3];
    return (
      <View style={styles.podium}>
        {order.map((leader, i) => {
          const rank = podiumRanks[i];
          const isMe = leader.id === user?.id;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.podiumItem, { justifyContent: 'flex-end' }]}
              onPress={() => leader.id ? openSheet(leader, rank) : null}
              activeOpacity={leader.id ? 0.8 : 1}
            >
              {rank === 1 && (
                <View style={styles.crownRow}>
                  <MaterialIcons name="stars" size={22} color={Colors.gold} />
                </View>
              )}
              <View style={[styles.podiumAvatar, isMe && styles.podiumAvatarMe]}>
                <LinearGradient
                  colors={rank === 1 ? [Colors.gold, '#FFA500'] : rank === 2 ? ['#C0C0C0', '#A0A0A0'] : ['#CD7F32', '#8B4513']}
                  style={styles.podiumAvatarGrad}
                >
                  <Text style={styles.podiumAvatarText}>
                    {leader.tiktokUsername !== '---' ? leader.tiktokUsername.replace('@', '').charAt(0).toUpperCase() : '?'}
                  </Text>
                </LinearGradient>
              </View>
              <Text style={styles.podiumUsername} numberOfLines={1}>
                {leader.tiktokUsername !== '---' ? leader.tiktokUsername.replace('@', '') : '---'}
              </Text>
              <Text style={[styles.podiumStars, { color: RANK_COLORS[rank - 1] }]}>
                {leader.tiktokUsername !== '---' ? `${(period === 'alltime' ? leader.totalStarsEarned : leader.stars).toLocaleString()} ★` : '---'}
              </Text>
              <View style={[styles.podiumBase, { height: heights[i], backgroundColor: RANK_COLORS[rank - 1] + '22', borderColor: RANK_COLORS[rank - 1] + '44' }]}>
                <Text style={[styles.podiumRank, { color: RANK_COLORS[rank - 1] }]}>#{rank}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderLeaderRow = (item: LeaderboardUser, index: number) => {
    const rank = index + 4;
    const isMe = item.id === user?.id;
    const levelInfo = getUserLevel(item.totalStarsEarned).currentLevel;
    return (
      <TouchableOpacity key={item.id} onPress={() => openSheet(item, rank)} activeOpacity={0.7}>
        <View style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
          <Text style={[styles.rankNum, { color: isMe ? Colors.primary : Colors.textMuted }]}>#{rank}</Text>
          <View style={[styles.leaderAvatar, { backgroundColor: Colors.surfaceElevated }]}>
            <Text style={styles.leaderAvatarText}>
              {item.tiktokUsername.replace('@', '').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.leaderInfo}>
            <View style={styles.leaderNameRow}>
              <Text style={[styles.leaderName, isMe && { color: Colors.primary }]} numberOfLines={1}>
                {item.tiktokUsername}
              </Text>
              {item.isVIP && <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />}
            </View>
            <View style={styles.leaderMeta}>
              <MaterialIcons name="emoji-events" size={11} color={levelInfo.color} />
              <Text style={[styles.leaderLevel, { color: levelInfo.color }]}>{levelInfo.name}</Text>
              {item.loginStreak > 0 && (
                <>
                  <Text style={styles.leaderDot}>·</Text>
                  <MaterialIcons name="local-fire-department" size={11} color={Colors.warning} />
                  <Text style={styles.leaderStreak}>{item.loginStreak}d</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.leaderRight}>
            <Text style={[styles.leaderStars, isMe && { color: Colors.primary }]}>
              {(period === 'alltime' ? item.totalStarsEarned : item.stars).toLocaleString()} ★
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
          </View>
        </View>
        <View style={styles.rowSeparator} />
      </TouchableOpacity>
    );
  };

  const renderReferralRow = (item: ReferralLeader, rank: number) => {
    const isMe = item.id === user?.id;
    const isTop3 = rank <= 3;
    const rankColor = isTop3 ? RANK_COLORS[rank - 1] : (isMe ? Colors.primary : Colors.textMuted);
    return (
      <View key={item.id}>
        <View style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
          {isTop3 ? (
            <MaterialIcons name="emoji-events" size={20} color={rankColor} style={styles.rankNum} />
          ) : (
            <Text style={[styles.rankNum, { color: rankColor }]}>#{rank}</Text>
          )}
          <LinearGradient
            colors={isTop3 ? [rankColor + '44', rankColor + '22'] : [Colors.surfaceElevated, Colors.surfaceElevated]}
            style={styles.leaderAvatar}
          >
            <Text style={[styles.leaderAvatarText, isTop3 && { color: rankColor }]}>
              {(item.tiktokUsername || 'U').replace('@', '').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.leaderInfo}>
            <View style={styles.leaderNameRow}>
              <Text style={[styles.leaderName, isMe && { color: Colors.primary }]} numberOfLines={1}>
                {item.tiktokUsername || 'Unknown'}
              </Text>
              {item.isVIP && <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />}
            </View>
            <View style={styles.referralCountRow}>
              <MaterialIcons name="people" size={11} color={Colors.info} />
              <Text style={styles.referralCountLabel}>{item.referralCount} friend{item.referralCount !== 1 ? 's' : ''} referred</Text>
            </View>
          </View>
          <View style={[styles.referralBonusBadge, { backgroundColor: rankColor + '22', borderColor: rankColor + '44' }]}>
            <MaterialIcons name="share" size={12} color={rankColor} />
            <Text style={[styles.referralBonusText, { color: rankColor }]}>{item.referralCount}</Text>
          </View>
        </View>
        <View style={styles.rowSeparator} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ProfileBottomSheet
        user={sheetUser}
        visible={sheetVisible}
        onClose={closeSheet}
        onChallenge={handleChallenge}
      />

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Header */}
        <View style={styles.stickyHeader}>
          <Text style={styles.title}>Leaderboard</Text>
          {activeTab === 'stars' && (
            <View style={styles.periodToggle}>
              <TouchableOpacity
                style={[styles.periodBtn, period === 'alltime' && styles.periodBtnActive]}
                onPress={() => setPeriod('alltime')}
              >
                <Text style={[styles.periodText, period === 'alltime' && styles.periodTextActive]}>All Time</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodBtn, period === 'weekly' && styles.periodBtnActive]}
                onPress={() => setPeriod('weekly')}
              >
                <Text style={[styles.periodText, period === 'weekly' && styles.periodTextActive]}>Weekly</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'stars' && styles.tabBtnActive]}
            onPress={() => setActiveTab('stars')}
          >
            <MaterialIcons name="star" size={15} color={activeTab === 'stars' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.tabBtnText, activeTab === 'stars' && styles.tabBtnTextActive]}>Top Earners</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'referrals' && styles.tabBtnActive]}
            onPress={() => setActiveTab('referrals')}
          >
            <MaterialIcons name="people" size={15} color={activeTab === 'referrals' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.tabBtnText, activeTab === 'referrals' && styles.tabBtnTextActive]}>Most Referrals</Text>
          </TouchableOpacity>
        </View>

        {/* Stars Leaderboard */}
        {activeTab === 'stars' && (
          isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
          ) : leaders.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="emoji-events" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No rankings yet</Text>
              <Text style={styles.emptySub}>Be the first to earn stars and top the leaderboard!</Text>
            </View>
          ) : (
            <>
              {myRank > 0 && (
                <LinearGradient colors={['#2A0A14', '#1A1A1A']} style={styles.myRankBanner}>
                  <MaterialIcons name="person" size={18} color={Colors.primary} />
                  <Text style={styles.myRankText}>Your rank: </Text>
                  <Text style={[styles.myRankNum, { color: Colors.primary }]}>#{myRank}</Text>
                  <View style={{ flex: 1 }} />
                  <MaterialIcons name="star" size={14} color={Colors.gold} />
                  <Text style={styles.myRankStars}>
                    {((period === 'alltime' ? user?.totalStarsEarned : user?.stars) || 0).toLocaleString()} stars
                  </Text>
                </LinearGradient>
              )}
              {renderTopThree()}
              <View style={styles.tapHint}>
                <MaterialIcons name="touch-app" size={14} color={Colors.textMuted} />
                <Text style={styles.tapHintText}>Tap any user to see their profile</Text>
              </View>
              <View style={styles.restList}>
                {leaders.slice(3).map((item, index) => renderLeaderRow(item, index))}
              </View>
            </>
          )
        )}

        {/* Referrals Leaderboard */}
        {activeTab === 'referrals' && (
          isReferralLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
          ) : (
            <>
              {myReferralRank > 0 && (
                <LinearGradient colors={['#1A0A2A', '#1A1A1A']} style={[styles.myRankBanner, { borderColor: 'rgba(139,92,246,0.3)' }]}>
                  <MaterialIcons name="share" size={18} color={Colors.purple} />
                  <Text style={styles.myRankText}>Your rank: </Text>
                  <Text style={[styles.myRankNum, { color: Colors.purple }]}>#{myReferralRank}</Text>
                  <View style={{ flex: 1 }} />
                  <MaterialIcons name="people" size={14} color={Colors.info} />
                  <Text style={[styles.myRankStars, { color: Colors.info }]}>
                    {referralLeaders.find(r => r.id === user?.id)?.referralCount || 0} referrals
                  </Text>
                </LinearGradient>
              )}

              <LinearGradient
                colors={['rgba(139,92,246,0.12)', 'rgba(139,92,246,0.04)']}
                style={styles.referralInfoCard}
              >
                <MaterialIcons name="emoji-events" size={18} color={Colors.purple} />
                <Text style={styles.referralInfoText}>
                  Earn +150 stars per friend you refer. Share your referral code from the Profile tab to climb this board!
                </Text>
              </LinearGradient>

              {referralLeaders.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialIcons name="people-outline" size={56} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No referrals yet</Text>
                  <Text style={styles.emptySub}>Share your referral code to earn bonus stars and top this board!</Text>
                </View>
              ) : (
                <View style={styles.restList}>
                  {referralLeaders.map((item, index) => renderReferralRow(item, index + 1))}
                </View>
              )}
            </>
          )
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  stickyHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  periodBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  periodTextActive: { color: '#fff' },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  tabBtnTextActive: { color: '#fff' },
  myRankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.3)',
  },
  myRankText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  myRankNum: { fontSize: FontSize.md, fontWeight: '800' },
  myRankStars: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: '700' },
  tapHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    justifyContent: 'center', marginBottom: Spacing.sm,
  },
  tapHintText: { fontSize: FontSize.xs, color: Colors.textMuted },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  podiumItem: { flex: 1, alignItems: 'center', gap: 4 },
  crownRow: { marginBottom: 2 },
  podiumAvatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', marginBottom: 4 },
  podiumAvatarMe: { borderWidth: 2, borderColor: Colors.primary },
  podiumAvatarGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  podiumAvatarText: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  podiumUsername: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary, maxWidth: '90%', textAlign: 'center' },
  podiumStars: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  podiumBase: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  podiumRank: { fontSize: FontSize.lg, fontWeight: '800' },
  restList: { paddingHorizontal: Spacing.md },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  leaderRowMe: {
    backgroundColor: 'rgba(255,45,85,0.06)',
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  rankNum: { width: 32, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' },
  leaderAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  leaderAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  leaderInfo: { flex: 1 },
  leaderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leaderName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, maxWidth: '80%' },
  leaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  leaderLevel: { fontSize: 11, fontWeight: '600' },
  leaderDot: { fontSize: 11, color: Colors.textMuted, marginHorizontal: 2 },
  leaderStreak: { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  leaderRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  leaderStars: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gold },
  rowSeparator: { height: 1, backgroundColor: Colors.surfaceBorder },
  referralCountRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  referralCountLabel: { fontSize: 11, color: Colors.info, fontWeight: '600' },
  referralBonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  referralBonusText: { fontSize: FontSize.sm, fontWeight: '800' },
  referralInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  referralInfoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  empty: { marginTop: 60, alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
