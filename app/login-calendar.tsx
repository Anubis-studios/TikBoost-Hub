import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_SIZE = Math.floor((SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2 - 8) / 7);

const STREAK_MILESTONES = [7, 14, 30];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function LoginCalendarScreen() {
  const { user } = useUser();
  const router = useRouter();

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const loginStreak = user?.loginStreak || 0;
  const lastLoginAt = user?.lastLoginAt ? new Date(user.lastLoginAt) : null;
  const dailyBonus = Math.min(loginStreak * 25, 300);

  // Build the current month calendar
  const { days, startOffset } = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    return { days: daysInMonth, startOffset: firstDayOfWeek };
  }, [currentMonth, currentYear]);

  // Determine which days the user "logged in" based on streak
  // We approximate: if streak = N, last N days before today were login days
  const loginDays = useMemo(() => {
    const set = new Set<number>();
    if (!lastLoginAt) return set;

    // The user has a streak — mark days backwards from last login
    const lastDate = new Date(lastLoginAt);
    for (let i = 0; i < loginStreak; i++) {
      const d = new Date(lastDate);
      d.setDate(lastDate.getDate() - i);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        set.add(d.getDate());
      }
    }
    return set;
  }, [lastLoginAt, loginStreak, currentMonth, currentYear]);

  const isMilestoneDay = (dayNum: number) => {
    // Check if this day in the streak sequence is a milestone
    if (!lastLoginAt) return false;
    const lastDate = new Date(lastLoginAt);
    const date = new Date(currentYear, currentMonth, dayNum);
    const diffDays = Math.floor((lastDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const streakDay = loginStreak - diffDays;
    return STREAK_MILESTONES.includes(streakDay);
  };

  const isLoggedIn = (dayNum: number) => loginDays.has(dayNum);
  const isToday = (dayNum: number) => dayNum === currentDay;
  const isFuture = (dayNum: number) => dayNum > currentDay;

  const alreadyLoggedToday = lastLoginAt
    ? lastLoginAt.toDateString() === today.toDateString()
    : false;

  const nextMilestone = STREAK_MILESTONES.find(m => m > loginStreak);
  const daysToMilestone = nextMilestone ? nextMilestone - loginStreak : null;

  // Grid cells including offset
  const totalCells = startOffset + days;
  const rows = Math.ceil(totalCells / 7);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Login Calendar</Text>
          <Text style={styles.subtitle}>{MONTH_NAMES[currentMonth]} {currentYear}</Text>
        </View>
        <View style={styles.streakPill}>
          <MaterialIcons name="local-fire-department" size={16} color={Colors.warning} />
          <Text style={styles.streakPillText}>{loginStreak} day</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Streak Summary Card */}
        <LinearGradient
          colors={['#1A0A00', '#1A1A1A']}
          style={styles.summaryCard}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <MaterialIcons name="local-fire-department" size={28} color={Colors.warning} />
              <Text style={styles.summaryValue}>{loginStreak}</Text>
              <Text style={styles.summaryLabel}>Current Streak</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <MaterialIcons name="star" size={28} color={Colors.gold} />
              <Text style={styles.summaryValue}>+{dailyBonus}</Text>
              <Text style={styles.summaryLabel}>Stars/Day</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <MaterialIcons name="emoji-events" size={28} color={Colors.primary} />
              <Text style={styles.summaryValue}>{nextMilestone || '✓'}</Text>
              <Text style={styles.summaryLabel}>Next Goal</Text>
            </View>
          </View>

          {daysToMilestone !== null && (
            <View style={styles.milestoneProgress}>
              <Text style={styles.milestoneHint}>
                {daysToMilestone} more day{daysToMilestone !== 1 ? 's' : ''} to reach Day {nextMilestone} milestone!
              </Text>
              <View style={styles.mProgressBar}>
                <LinearGradient
                  colors={Colors.gradientPink as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.mProgressFill, {
                    width: `${Math.min((loginStreak / (nextMilestone || 1)) * 100, 100)}%`,
                  }]}
                />
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Milestone Rewards Key */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Milestone Rewards</Text>
          <View style={styles.legendRow}>
            {[
              { day: 7, stars: 500, color: Colors.warning, icon: 'local-fire-department' },
              { day: 14, stars: 1000, color: Colors.primary, icon: 'whatshot' },
              { day: 30, stars: 3000, color: Colors.gold, icon: 'workspace-premium', vip: true },
            ].map(m => (
              <View key={m.day} style={[styles.legendItem, { borderColor: m.color + '44' }]}>
                <MaterialIcons name={m.icon as any} size={18} color={m.color} />
                <Text style={[styles.legendDay, { color: m.color }]}>Day {m.day}</Text>
                <Text style={styles.legendStars}>+{m.stars.toLocaleString()}★</Text>
                {m.vip && (
                  <View style={styles.vipTag}>
                    <Text style={styles.vipTagText}>+VIP</Text>
                  </View>
                )}
                {loginStreak >= m.day && (
                  <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          {/* Day labels */}
          <View style={styles.dayLabels}>
            {DAY_NAMES.map((d, i) => (
              <View key={i} style={[styles.dayLabelCell, { width: DAY_SIZE }]}>
                <Text style={styles.dayLabelText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {Array.from({ length: rows * 7 }, (_, cellIndex) => {
              const dayNum = cellIndex - startOffset + 1;
              const isValid = dayNum >= 1 && dayNum <= days;
              if (!isValid) {
                return <View key={cellIndex} style={{ width: DAY_SIZE, height: DAY_SIZE + 4 }} />;
              }

              const logged = isLoggedIn(dayNum);
              const today_ = isToday(dayNum);
              const future = isFuture(dayNum);
              const milestone = isLoggedIn(dayNum) && isMilestoneDay(dayNum);

              return (
                <View
                  key={cellIndex}
                  style={[
                    styles.dayCell,
                    { width: DAY_SIZE, height: DAY_SIZE + 4 },
                    today_ && styles.dayCellToday,
                    logged && !today_ && styles.dayCellLogged,
                    milestone && styles.dayCellMilestone,
                  ]}
                >
                  {milestone ? (
                    <MaterialIcons name="emoji-events" size={16} color={Colors.gold} />
                  ) : logged ? (
                    <MaterialIcons name="star" size={14} color={Colors.gold} />
                  ) : today_ && !alreadyLoggedToday ? (
                    <MaterialIcons name="local-fire-department" size={14} color={Colors.warning} />
                  ) : (
                    <Text style={[
                      styles.dayCellText,
                      today_ && styles.dayCellTextToday,
                      future && styles.dayCellTextFuture,
                      logged && styles.dayCellTextLogged,
                    ]}>
                      {dayNum}
                    </Text>
                  )}
                  {today_ && (
                    <View style={styles.todayDot} />
                  )}
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <MaterialIcons name="star" size={12} color={Colors.gold} />
              <Text style={styles.calLegendText}>Logged in</Text>
            </View>
            <View style={styles.calLegendItem}>
              <MaterialIcons name="emoji-events" size={12} color={Colors.gold} />
              <Text style={styles.calLegendText}>Milestone</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.calLegendText}>Today</Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaCard}>
          {alreadyLoggedToday ? (
            <LinearGradient colors={['rgba(0,209,126,0.15)', 'rgba(0,209,126,0.05)']} style={styles.ctaInner}>
              <MaterialIcons name="check-circle" size={24} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Streak Maintained!</Text>
                <Text style={styles.ctaSub}>You logged in today. Come back tomorrow to keep your streak going!</Text>
              </View>
            </LinearGradient>
          ) : (
            <LinearGradient colors={['rgba(255,45,85,0.15)', 'rgba(255,45,85,0.05)']} style={styles.ctaInner}>
              <MaterialIcons name="local-fire-department" size={24} color={Colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Login Now to Keep Streak!</Text>
                <Text style={styles.ctaSub}>
                  Earn <Text style={{ color: Colors.gold, fontWeight: '700' }}>+{dailyBonus} stars</Text> for your Day {loginStreak + 1} login.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.primary} />
            </LinearGradient>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,184,0,0.12)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)',
  },
  streakPillText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.warning },
  scroll: { padding: Spacing.md },
  summaryCard: {
    borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.2)',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 50, backgroundColor: Colors.surfaceBorder },
  summaryValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  milestoneProgress: { gap: 6 },
  milestoneHint: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  mProgressBar: { height: 6, backgroundColor: Colors.surfaceElevated, borderRadius: 3, overflow: 'hidden' },
  mProgressFill: { height: '100%', borderRadius: 3 },
  legendCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  legendTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  legendRow: { flexDirection: 'row', gap: Spacing.sm },
  legendItem: {
    flex: 1, alignItems: 'center', gap: 4, padding: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1, backgroundColor: Colors.surfaceElevated,
  },
  legendDay: { fontSize: FontSize.xs, fontWeight: '700' },
  legendStars: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  vipTag: {
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  vipTagText: { fontSize: 8, fontWeight: '800', color: Colors.gold },
  calendarCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  dayLabels: { flexDirection: 'row', marginBottom: Spacing.xs },
  dayLabelCell: { alignItems: 'center', paddingVertical: 4 },
  dayLabelText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    position: 'relative',
    marginBottom: 2,
  },
  dayCellToday: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
  },
  dayCellLogged: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  dayCellMilestone: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
  },
  dayCellText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  dayCellTextToday: { color: '#fff', fontWeight: '700' },
  dayCellTextFuture: { color: Colors.textMuted, opacity: 0.5 },
  dayCellTextLogged: { color: Colors.gold, fontWeight: '700' },
  todayDot: {
    position: 'absolute', bottom: 1,
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff',
  },
  calLegend: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg,
    marginTop: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 10, height: 10, borderRadius: 5 },
  calLegendText: { fontSize: 11, color: Colors.textMuted },
  ctaCard: {
    borderRadius: BorderRadius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  ctaInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md,
  },
  ctaTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  ctaSub: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
