import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import { fetchLeaderboard, LeaderboardUser } from '@/services/supabaseService';

// ─── Countdown ────────────────────────────────────────────────────────────────

function useEndOfPeriodCountdown(period: 'weekly' | 'monthly') {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      let end: Date;

      if (period === 'weekly') {
        // Next Sunday midnight
        end = new Date(now);
        const daysUntilSun = (7 - now.getDay()) % 7 || 7;
        end.setDate(now.getDate() + daysUntilSun);
        end.setHours(0, 0, 0, 0);
      } else {
        // End of month
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      }

      const diff = end.getTime() - now.getTime();
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 }); return; }

      setCountdown({
        days:  Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins:  Math.floor((diff % 3600000) / 60000),
        secs:  Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [period]);

  return countdown;
}

// ─── Rewards Config ───────────────────────────────────────────────────────────

const MONTHLY_REWARDS = [
  {
    rank: 1, title: '15K TikTok Followers',
    desc: 'Win 15,000 TikTok followers and become a social media sensation!',
    medalColor: '#FFD700', bgColor: 'rgba(255,215,0,0.12)',
  },
  {
    rank: 2, title: '10K TikTok Followers',
    desc: 'Grow your TikTok following with 10,000 new followers!',
    medalColor: '#C0C0C0', bgColor: 'rgba(192,192,192,0.1)',
  },
  {
    rank: 3, title: '5K TikTok Followers',
    desc: 'Get a boost of 5,000 new TikTok followers!',
    medalColor: '#CD7F32', bgColor: 'rgba(205,127,50,0.12)',
  },
];

const WEEKLY_REWARDS = [
  {
    rank: 1, title: '5K TikTok Followers',
    desc: 'Gain 5,000 new TikTok followers this week!',
    medalColor: '#FFD700', bgColor: 'rgba(255,215,0,0.12)',
  },
  {
    rank: 2, title: '3K TikTok Followers',
    desc: 'Expand your TikTok reach with 3,000 new followers!',
    medalColor: '#C0C0C0', bgColor: 'rgba(192,192,192,0.1)',
  },
  {
    rank: 3, title: '1K TikTok Followers',
    desc: 'Attract 1,000 new followers to your TikTok account!',
    medalColor: '#CD7F32', bgColor: 'rgba(205,127,50,0.12)',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function MedalBadge({ rank, color }: { rank: number; color: string }) {
  return (
    <LinearGradient
      colors={[color, color + 'CC']}
      style={medalStyles.wrap}
    >
      <Text style={medalStyles.num}>{rank}</Text>
    </LinearGradient>
  );
}

const medalStyles = StyleSheet.create({
  wrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  num: { fontSize: FontSize.lg, fontWeight: '900', color: '#fff' },
});

function RewardCard({ item }: { item: typeof MONTHLY_REWARDS[0] }) {
  return (
    <View style={rewardCardStyles.card}>
      <View style={[rewardCardStyles.left, { backgroundColor: item.bgColor + '22' }]}>
        <MedalBadge rank={item.rank} color={item.medalColor} />
      </View>
      <View style={rewardCardStyles.content}>
        <Text style={rewardCardStyles.title}>{item.title}</Text>
        <Text style={rewardCardStyles.desc}>{item.desc}</Text>
      </View>
    </View>
  );
}

const rewardCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder, overflow: 'hidden',
  },
  left: { width: 72, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md },
  content: { flex: 1, padding: Spacing.md, justifyContent: 'center' },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});

function CountdownBlock({ value, label }: { value: number; label: string }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={countdownBlockStyles.wrap}>
      <Text style={countdownBlockStyles.value}>{pad(value)}</Text>
      <Text style={countdownBlockStyles.label}>{label}</Text>
    </View>
  );
}

const countdownBlockStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    width: 68, height: 72, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  value: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textPrimary },
  label: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RewardsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  const countdown = useEndOfPeriodCountdown(period);
  const rewards = period === 'monthly' ? MONTHLY_REWARDS : WEEKLY_REWARDS;

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard('alltime', 3)
      .then(setLeaders)
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Rewards</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Period Toggle */}
        <View style={styles.periodToggle}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'monthly' && styles.periodBtnActive]}
            onPress={() => setPeriod('monthly')}
          >
            <Text style={[styles.periodBtnText, period === 'monthly' && styles.periodBtnTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'weekly' && styles.periodBtnActive]}
            onPress={() => setPeriod('weekly')}
          >
            <Text style={[styles.periodBtnText, period === 'weekly' && styles.periodBtnTextActive]}>
              Weekly
            </Text>
          </TouchableOpacity>
        </View>

        {/* Prize Cards */}
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
          ) : (
            rewards.map(item => <RewardCard key={item.rank} item={item} />)
          )}
        </View>

        {/* Countdown */}
        <View style={styles.countdownCard}>
          <View style={styles.countdownHeader}>
            <MaterialIcons name="schedule" size={20} color={Colors.textSecondary} />
            <Text style={styles.countdownTitle}>
              Time Left This {period === 'monthly' ? 'Month' : 'Week'}
            </Text>
          </View>
          <Text style={styles.countdownDesc}>
            You still have time to win this {period === 'monthly' ? "month's" : "week's"} rewards!
          </Text>
          <View style={styles.countdownRow}>
            <CountdownBlock value={countdown.days} label="DAY" />
            <CountdownBlock value={countdown.hours} label="HR" />
            <CountdownBlock value={countdown.mins} label="MIN" />
            <CountdownBlock value={countdown.secs} label="SEC" />
          </View>
        </View>

        {/* How to Win */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How to Win</Text>
          {[
            { icon: 'star', color: Colors.gold, text: 'Earn stars by completing tasks, games and challenges' },
            { icon: 'emoji-events', color: Colors.warning, text: 'Top 3 star earners each period win real TikTok followers' },
            { icon: 'people', color: Colors.info, text: 'Invite friends with your referral code for bonus stars' },
            { icon: 'workspace-premium', color: Colors.gold, text: 'VIP members earn 2x stars on all activities' },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <View style={[styles.howIcon, { backgroundColor: item.color + '22' }]}>
                <MaterialIcons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Current Top 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Leaders</Text>
          {leaders.slice(0, 3).map((u, idx) => {
            const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
            return (
              <View key={u.id} style={styles.leaderRow}>
                <MedalBadge rank={idx + 1} color={medalColors[idx]} />
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>@{u.tiktokUsername}</Text>
                  <Text style={styles.leaderStars}>{u.stars.toLocaleString()} stars</Text>
                </View>
                {u.isVIP && (
                  <View style={styles.vipBadge}>
                    <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />
                    <Text style={styles.vipText}>VIP</Text>
                  </View>
                )}
              </View>
            );
          })}
          {leaders.length === 0 && !loading && (
            <Text style={styles.emptyText}>No leaders yet. Be the first!</Text>
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
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  title: { flex: 1, fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { paddingBottom: Spacing.xl },
  periodToggle: {
    flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  periodBtn: {
    flex: 1, paddingVertical: 12, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  periodBtnTextActive: { color: '#fff' },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  countdownCard: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.lg,
    backgroundColor: 'rgba(0,209,126,0.06)', borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(0,209,126,0.2)',
  },
  countdownHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  countdownTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  countdownDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  countdownRow: { flexDirection: 'row', gap: Spacing.sm },
  howCard: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  howIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  howText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  leaderStars: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  vipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  vipText: { fontSize: 10, fontWeight: '700', color: Colors.gold },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },
});
