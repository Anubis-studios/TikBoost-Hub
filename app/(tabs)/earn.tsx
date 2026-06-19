import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
  Easing,
  Dimensions,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { TASKS, Task } from '@/services/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WEEKLY_FREE_SPINS,
  NUMBER_PICK_CONFIG,
  MEMORY_MATCH_CONFIG,
  EXTRA_SPIN_CONFIG,
  IAPProductId,
  connectIAP,
  purchaseProduct,
  completePurchase,
} from '@/services/iapService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

const TASK_TYPE_ICONS: Record<string, string> = {
  follow: 'person-add',
  like: 'favorite',
  watch_ad: 'play-circle-filled',
  daily_checkin: 'calendar-today',
  referral: 'share',
};

const TASK_TYPE_COLORS: Record<string, string> = {
  follow: Colors.info,
  like: Colors.primary,
  watch_ad: Colors.warning,
  daily_checkin: Colors.success,
  referral: Colors.purple,
};

// ─── Storage Keys ──────────────────────────────────────────────────────────────
const SPIN_STORAGE_KEY     = 'tikboost_last_spin';
const SCRATCH_STORAGE_KEY  = 'tikboost_last_scratch';
const DAILY_TASKS_KEY      = 'tikboost_daily_tasks_date';
const WEEKLY_SPINS_KEY     = 'tikboost_weekly_spins'; // { weekStr, used }
const DAILY_TASK_IDS       = new Set(['daily_checkin', 'watch_ad_1', 'watch_ad_2']);

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekStr() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function useResetCountdown() {
  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    const calc = () => {
      const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
      setMsLeft(midnight.getTime() - Date.now());
    };
    calc(); const id = setInterval(calc, 1000); return () => clearInterval(id);
  }, []);
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

async function getCompletedTodayIds(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(DAILY_TASKS_KEY);
    if (!stored) return new Set();
    const { date, ids } = JSON.parse(stored);
    return date !== todayStr() ? new Set() : new Set(ids);
  } catch { return new Set(); }
}

async function markDailyTaskComplete(taskId: string) {
  try {
    const existing = await getCompletedTodayIds();
    existing.add(taskId);
    await AsyncStorage.setItem(DAILY_TASKS_KEY, JSON.stringify({ date: todayStr(), ids: Array.from(existing) }));
  } catch {}
}

// ─── Weekly Free Spins ──────────────────────────────────────────────────────────
async function getWeeklySpinsUsed(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(WEEKLY_SPINS_KEY);
    if (!stored) return 0;
    const { week, used } = JSON.parse(stored);
    return week !== weekStr() ? 0 : used;
  } catch { return 0; }
}

async function incrementWeeklySpins(current: number) {
  await AsyncStorage.setItem(WEEKLY_SPINS_KEY, JSON.stringify({ week: weekStr(), used: current + 1 }));
}

// ─── Spin Segments ─────────────────────────────────────────────────────────────
const SEGMENTS = [
  { stars: 10,  color: '#FF2D55', label: '10★'  },
  { stars: 25,  color: '#FF6B35', label: '25★'  },
  { stars: 50,  color: '#FFB800', label: '50★'  },
  { stars: 100, color: '#00C851', label: '100★' },
  { stars: 15,  color: '#2196F3', label: '15★'  },
  { stars: 200, color: '#9C27B0', label: '200★' },
  { stars: 35,  color: '#FF5722', label: '35★'  },
  { stars: 500, color: '#E91E63', label: '500★' },
];
const WEIGHTS = [30, 25, 20, 10, 25, 5, 20, 1];
function weightedRandom() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return i; }
  return 0;
}

// ─── Spin History Modal ─────────────────────────────────────────────────────────
function SpinHistoryModal({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string }) {
  const supabase = getSupabaseClient();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    supabase
      .from('spin_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setHistory(data || []); setLoading(false); });
  }, [visible, userId]);

  const GAME_LABELS: Record<string, string> = {
    free_spin:     'Daily Spin',
    lucky_wheel:   'Lucky Wheel',
    number_pick:   'Number Picker',
    memory_match:  'Memory Match',
    scratch_card:  'Scratch Card',
  };

  const GAME_COLORS: Record<string, string> = {
    free_spin:    Colors.gold,
    lucky_wheel:  Colors.primary,
    number_pick:  Colors.info,
    memory_match: Colors.purple,
    scratch_card: Colors.success,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={histStyles.overlay}>
        <View style={histStyles.sheet}>
          <View style={histStyles.handle} />
          <View style={histStyles.header}>
            <Text style={histStyles.title}>Game History</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary }}>Loading...</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={{ height: 120, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="casino" size={36} color={Colors.textMuted} />
              <Text style={{ color: Colors.textMuted, fontSize: FontSize.sm }}>No game history yet</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={item => item.id}
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const color = GAME_COLORS[item.game_type] || Colors.gold;
                const label = GAME_LABELS[item.game_type] || item.game_type;
                const date = new Date(item.created_at);
                return (
                  <View style={histStyles.row}>
                    <View style={[histStyles.iconWrap, { backgroundColor: color + '22' }]}>
                      <MaterialIcons name="casino" size={18} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={histStyles.rowLabel}>{label}</Text>
                      <Text style={histStyles.rowDate}>
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={[histStyles.rowStars, { color: Colors.gold }]}>+{item.stars_won} ★</Text>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const histStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.md, paddingBottom: Spacing.xxl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.surfaceBorder,
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  iconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  rowDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  rowStars: { fontSize: FontSize.md, fontWeight: '800' },
});

// ─── Spin Wheel (Premium Free Spins) ──────────────────────────────────────────

function SpinWheelSection() {
  const { addStars, user } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const winAnim = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [lastSpin, setLastSpin] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [wonStars, setWonStars] = useState<number | null>(null);
  const [totalRotation, setTotalRotation] = useState(0);
  const [weeklyUsed, setWeeklyUsed] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const tier = user?.subscriptionTier || (user?.isVIP ? 'pro' : 'free');
  const weeklyAllowance = WEEKLY_FREE_SPINS[tier] ?? 1;
  const freeSpinsLeft = Math.max(0, weeklyAllowance - weeklyUsed);

  useEffect(() => {
    AsyncStorage.getItem(SPIN_STORAGE_KEY).then(ts => { if (ts) setLastSpin(ts); });
    getWeeklySpinsUsed().then(setWeeklyUsed);
  }, []);

  useEffect(() => {
    if (!lastSpin) { setCooldownLeft(0); return; }
    const interval = setInterval(() => {
      const elapsed = Date.now() - parseInt(lastSpin);
      const remaining = Math.max(0, 24 * 3600 * 1000 - elapsed);
      setCooldownLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSpin]);

  // Can use a free spin: within weekly allowance AND 24h cooldown passed
  const canFreeSpin = freeSpinsLeft > 0 && cooldownLeft === 0;

  const formatCooldown = (ms: number) => {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const recordSpinHistory = async (stars: number, gameType: string) => {
    if (!user) return;
    await supabase.from('spin_history').insert({
      user_id: user.id, game_type: gameType, stars_won: stars,
    }).catch(() => {});
  };

  const doSpin = async (isFree: boolean) => {
    if (spinning || !user) return;
    setSpinning(true); setWonStars(null);

    const segmentIndex = weightedRandom();
    const segAngle = 360 / SEGMENTS.length;
    const targetDeg = segmentIndex * segAngle;
    const extraSpins = (3 + Math.floor(Math.random() * 3)) * 360;
    const newTotal = totalRotation + extraSpins + (360 - targetDeg - totalRotation % 360 + (270 + segAngle / 2));
    setTotalRotation(newTotal);

    spinAnim.setValue(totalRotation);
    Animated.timing(spinAnim, {
      toValue: newTotal, duration: 4000, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(async () => {
      const prize = SEGMENTS[segmentIndex].stars;
      setWonStars(prize);
      winAnim.setValue(0);
      Animated.spring(winAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 6 }).start();

      await addStars(prize, `Spin Wheel win — ${prize} stars`, 'spin_game');
      await recordSpinHistory(prize, isFree ? 'free_spin' : 'lucky_wheel');

      if (isFree) {
        const now = Date.now().toString();
        setLastSpin(now);
        await AsyncStorage.setItem(SPIN_STORAGE_KEY, now);
        const newUsed = weeklyUsed + 1;
        setWeeklyUsed(newUsed);
        await incrementWeeklySpins(weeklyUsed);
      }
      setSpinning(false);
      showAlert('You Won!', `Congratulations! You earned ${prize} stars!`);
    });
  };

  const handleSpin = async () => {
    if (!user) return;
    if (canFreeSpin) {
      doSpin(true);
    } else if (freeSpinsLeft === 0 && weeklyAllowance <= 1) {
      // Free plan: upsell
      showAlert(
        'Upgrade for More Spins',
        `Free plan gets 1 spin/week.\n\nPro: 3 spins/week\nElite: 7 spins/week\n\nOr buy an extra spin for ${EXTRA_SPIN_CONFIG.price}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade Plan', onPress: () => router.push('/subscription') },
          {
            text: `Buy Spin ${EXTRA_SPIN_CONFIG.price}`,
            onPress: async () => {
              setLoadingExtra(true);
              try {
                await connectIAP();
                const purchase = await purchaseProduct(EXTRA_SPIN_CONFIG.productId as IAPProductId);
                if (!purchase) { setLoadingExtra(false); return; }
                await completePurchase(purchase);
                setLoadingExtra(false);
                doSpin(false);
              } catch (e: any) {
                showAlert('Error', e.message);
                setLoadingExtra(false);
              }
            },
          },
        ]
      );
    } else if (freeSpinsLeft > 0 && cooldownLeft > 0) {
      showAlert('Cooldown Active', `Next free spin in ${formatCooldown(cooldownLeft)}`);
    } else {
      // No free spins left for week, but has subscription
      showAlert(
        'Weekly Spins Used',
        `You have used all ${weeklyAllowance} free spins this week.\n\nBuy an extra spin for ${EXTRA_SPIN_CONFIG.price}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Buy ${EXTRA_SPIN_CONFIG.price}`,
            onPress: async () => {
              setLoadingExtra(true);
              try {
                await connectIAP();
                const purchase = await purchaseProduct(EXTRA_SPIN_CONFIG.productId as IAPProductId);
                if (!purchase) { setLoadingExtra(false); return; }
                await completePurchase(purchase);
                setLoadingExtra(false);
                doSpin(false);
              } catch (e: any) {
                showAlert('Error', e.message);
                setLoadingExtra(false);
              }
            },
          },
        ]
      );
    }
  };

  const rotate = spinAnim.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });
  const segAngle = 360 / SEGMENTS.length;
  const wheelRadius = WHEEL_SIZE / 2;

  return (
    <View style={wheelStyles.container}>
      <View style={wheelStyles.header}>
        <MaterialIcons name="casino" size={22} color={Colors.gold} />
        <Text style={wheelStyles.title}>Daily Spin</Text>
        <View style={{ flex: 1 }} />
        {/* Spin allowance badge */}
        <View style={[
          wheelStyles.allowanceBadge,
          { backgroundColor: freeSpinsLeft > 0 ? Colors.success + '22' : Colors.surfaceBorder },
          { borderColor: freeSpinsLeft > 0 ? Colors.success + '44' : Colors.surfaceBorder },
        ]}>
          <MaterialIcons name="refresh" size={12} color={freeSpinsLeft > 0 ? Colors.success : Colors.textMuted} />
          <Text style={[wheelStyles.allowanceText, { color: freeSpinsLeft > 0 ? Colors.success : Colors.textMuted }]}>
            {freeSpinsLeft}/{weeklyAllowance} this week
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowHistory(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="history" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tier info */}
      {tier === 'free' && (
        <TouchableOpacity onPress={() => router.push('/subscription')} style={wheelStyles.tierHint} activeOpacity={0.8}>
          <MaterialIcons name="workspace-premium" size={13} color={Colors.gold} />
          <Text style={wheelStyles.tierHintText}>
            Upgrade to Pro for 3 spins/week • Elite for 7 spins/week
          </Text>
          <MaterialIcons name="chevron-right" size={14} color={Colors.gold} />
        </TouchableOpacity>
      )}

      {/* Cooldown */}
      {cooldownLeft > 0 && freeSpinsLeft > 0 && (
        <View style={wheelStyles.cooldownRow}>
          <MaterialIcons name="schedule" size={13} color={Colors.warning} />
          <Text style={wheelStyles.cooldownText}>Next spin in {formatCooldown(cooldownLeft)}</Text>
        </View>
      )}

      {/* Wheel */}
      <View style={wheelStyles.wheelWrapper}>
        <View style={wheelStyles.pointer}>
          <MaterialIcons name="arrow-drop-down" size={40} color={Colors.primary} />
        </View>
        <Animated.View style={[wheelStyles.wheel, { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, transform: [{ rotate }] }]}>
          {SEGMENTS.map((seg, i) => {
            const angle = (segAngle * i - 90) * (Math.PI / 180);
            const textRadius = wheelRadius * 0.65;
            const textX = wheelRadius + textRadius * Math.cos(angle + (segAngle / 2) * (Math.PI / 180)) - wheelRadius;
            const textY = wheelRadius + textRadius * Math.sin(angle + (segAngle / 2) * (Math.PI / 180)) - wheelRadius;
            return (
              <View key={i} style={[wheelStyles.segment, { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, position: 'absolute', overflow: 'hidden', transform: [{ rotate: `${segAngle * i}deg` }] }]}>
                <View style={[wheelStyles.segmentFill, { backgroundColor: seg.color, width: WHEEL_SIZE / 2, height: WHEEL_SIZE / 2 }]} />
                <Text style={[wheelStyles.segmentLabel, { position: 'absolute', left: wheelRadius + textX - 18, top: wheelRadius + textY - 8, transform: [{ rotate: `${segAngle / 2}deg` }] }]}>
                  {seg.label}
                </Text>
              </View>
            );
          })}
          <View style={[wheelStyles.center, { width: WHEEL_SIZE * 0.22, height: WHEEL_SIZE * 0.22, borderRadius: WHEEL_SIZE * 0.11, left: WHEEL_SIZE * 0.39, top: WHEEL_SIZE * 0.39 }]}>
            <MaterialIcons name="star" size={20} color={Colors.gold} />
          </View>
        </Animated.View>
      </View>

      {/* Win display */}
      {wonStars !== null && (
        <Animated.View style={[wheelStyles.winBadge, { transform: [{ scale: winAnim }, { translateY: winAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], opacity: winAnim }]}>
          <LinearGradient colors={['#FFD700', '#FF6B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={wheelStyles.winGrad}>
            <MaterialIcons name="celebration" size={18} color="#fff" />
            <Text style={wheelStyles.winText}>+{wonStars} Stars!</Text>
          </LinearGradient>
        </Animated.View>
      )}

      <TouchableOpacity onPress={handleSpin} disabled={spinning || loadingExtra} activeOpacity={0.85}>
        <LinearGradient
          colors={(canFreeSpin && !spinning) ? (Colors.gradientPink as [string, string]) : ['#333', '#222']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={wheelStyles.spinBtn}
        >
          <MaterialIcons name="casino" size={18} color={(canFreeSpin && !spinning) ? '#fff' : Colors.textMuted} />
          <Text style={[wheelStyles.spinBtnText, (!canFreeSpin || spinning) && { color: Colors.textMuted }]}>
            {spinning ? 'Spinning...' : canFreeSpin ? `SPIN FREE (${freeSpinsLeft} left)` : `Buy Spin ${EXTRA_SPIN_CONFIG.price}`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {showHistory && user && (
        <SpinHistoryModal visible={showHistory} onClose={() => setShowHistory(false)} userId={user.id} />
      )}
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  allowanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginRight: 8 },
  allowanceText: { fontSize: 10, fontWeight: '700' },
  tierHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 6, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  tierHintText: { flex: 1, fontSize: 11, color: Colors.gold, fontWeight: '600' },
  cooldownRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  cooldownText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  wheelWrapper: { alignItems: 'center', marginVertical: Spacing.md, position: 'relative' },
  pointer: { position: 'absolute', top: -16, zIndex: 10 },
  wheel: { overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)', elevation: 8, shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, backgroundColor: Colors.surfaceElevated },
  segment: { position: 'absolute', overflow: 'hidden' },
  segmentFill: { position: 'absolute', top: 0, right: 0, opacity: 0.85, borderTopRightRadius: WHEEL_SIZE / 2 },
  segmentLabel: { fontSize: 9, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, width: 36, textAlign: 'center' },
  center: { position: 'absolute', backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', zIndex: 20 },
  winBadge: { marginBottom: Spacing.md, borderRadius: BorderRadius.full, overflow: 'hidden' },
  winGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.lg },
  winText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  spinBtn: { height: 50, borderRadius: BorderRadius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  spinBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});

// ─── Scratch Card ───────────────────────────────────────────────────────────────

const SCRATCH_VALUES = [10, 20, 30, 50, 100, 150, 200, 300];
const MATCH_BONUSES: Record<number, number> = { 10: 50, 20: 100, 30: 150, 50: 200, 100: 400, 150: 500, 200: 750, 300: 1000 };

function generateScratchGrid(): number[] {
  const grid = Array.from({ length: 9 }, () => SCRATCH_VALUES[Math.floor(Math.random() * SCRATCH_VALUES.length)]);
  if (Math.random() < 0.3) {
    const val = SCRATCH_VALUES[Math.floor(Math.random() * SCRATCH_VALUES.length)];
    const positions = [0, 4, 8];
    positions.forEach(p => { grid[p] = val; });
  }
  return grid;
}

function ScratchCardSection() {
  const { addStars, spendStars, user } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [grid, setGrid] = useState<number[]>(() => generateScratchGrid());
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [lastScratch, setLastScratch] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [extraPlays, setExtraPlays] = useState(0);
  const [matchBonus, setMatchBonus] = useState(0);
  const revealAnims = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  const celebAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { AsyncStorage.getItem(SCRATCH_STORAGE_KEY).then(ts => { if (ts) setLastScratch(ts); }); }, []);
  useEffect(() => {
    if (!lastScratch) { setCooldownLeft(0); return; }
    const interval = setInterval(() => {
      const elapsed = Date.now() - parseInt(lastScratch);
      const remaining = Math.max(0, 24 * 3600 * 1000 - elapsed);
      setCooldownLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastScratch]);

  const canPlay = cooldownLeft === 0 || extraPlays > 0;
  const formatCooldown = (ms: number) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return `${h}h ${m}m`; };

  const revealCell = (index: number) => {
    if (revealed[index] || gameOver || !canPlay) return;
    const newRevealed = [...revealed]; newRevealed[index] = true; setRevealed(newRevealed);
    Animated.spring(revealAnims[index], { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }).start();
    if (newRevealed.every(Boolean)) finishGame(newRevealed);
  };

  const finishGame = async (finalRevealed: boolean[]) => {
    setGameOver(true);
    const total = grid.reduce((sum, val) => sum + val, 0);
    const counts: Record<number, number[]> = {};
    grid.forEach((val, i) => { if (!counts[val]) counts[val] = []; counts[val].push(i); });
    let bonus = 0;
    for (const [val, positions] of Object.entries(counts)) {
      if (positions.length >= 3) { bonus = MATCH_BONUSES[parseInt(val)] || 0; break; }
    }
    setMatchBonus(bonus);
    if (bonus > 0) Animated.spring(celebAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 5 }).start();
    const awarded = total + bonus;
    await addStars(awarded, `Scratch Card — ${awarded} stars${bonus > 0 ? ' (match bonus!)' : ''}`, 'scratch_card');
    if (user) await supabase.from('spin_history').insert({ user_id: user.id, game_type: 'scratch_card', stars_won: awarded }).catch(() => {});
    if (extraPlays > 0) setExtraPlays(p => p - 1);
    else { const now = Date.now().toString(); setLastScratch(now); await AsyncStorage.setItem(SCRATCH_STORAGE_KEY, now); }
    bonus > 0 ? showAlert('MATCH BONUS!', `Earned ${total} + ${bonus} bonus = ${awarded} total stars!`) : showAlert('Card Complete!', `You scratched ${total} stars!`);
  };

  const resetCard = () => {
    setGrid(generateScratchGrid()); setRevealed(Array(9).fill(false)); setGameOver(false); setMatchBonus(0);
    revealAnims.forEach(a => a.setValue(0)); celebAnim.setValue(0);
  };

  const buyExtraPlay = async () => {
    if (!user || user.stars < 50) { showAlert('Not Enough Stars', 'You need 50 stars to buy an extra play.'); return; }
    const success = await spendStars(50, 'Extra scratch card play', 'scratch_card');
    if (success) { setExtraPlays(p => p + 1); if (gameOver) resetCard(); showAlert('Extra Play!', 'You have 1 extra scratch card play ready.'); }
  };

  const revealAll = () => {
    if (!canPlay) return;
    const newRevealed = Array(9).fill(true); setRevealed(newRevealed);
    revealAnims.forEach((a, i) => setTimeout(() => Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }).start(), i * 60));
    setTimeout(() => finishGame(newRevealed), 600);
  };

  const colorForVal = (val: number) => {
    if (val >= 300) return Colors.primary;
    if (val >= 150) return Colors.purple;
    if (val >= 100) return Colors.gold;
    if (val >= 50) return Colors.success;
    if (val >= 20) return Colors.info;
    return Colors.textSecondary;
  };

  const cellSize = (SCREEN_WIDTH - 64 - 32 - 16) / 3;

  return (
    <View style={scratchStyles.container}>
      <View style={scratchStyles.header}>
        <MaterialIcons name="credit-card" size={22} color={Colors.purple} />
        <Text style={scratchStyles.title}>Scratch Card</Text>
        {cooldownLeft > 0 && extraPlays === 0 && (
          <View style={scratchStyles.cooldownBadge}>
            <MaterialIcons name="schedule" size={12} color={Colors.warning} />
            <Text style={scratchStyles.cooldownText}>{formatCooldown(cooldownLeft)}</Text>
          </View>
        )}
        {extraPlays > 0 && (
          <View style={[scratchStyles.cooldownBadge, { backgroundColor: Colors.purple + '22', borderColor: Colors.purple + '44' }]}>
            <Text style={[scratchStyles.cooldownText, { color: Colors.purple }]}>{extraPlays} extra</Text>
          </View>
        )}
      </View>
      <Text style={scratchStyles.sub}>Tap cells to reveal — match 3 for a bonus prize!</Text>
      <View style={scratchStyles.grid}>
        {grid.map((val, i) => (
          <TouchableOpacity key={i} onPress={() => revealCell(i)} disabled={revealed[i] || gameOver || !canPlay} activeOpacity={0.7}>
            <View style={[scratchStyles.cell, { width: cellSize, height: cellSize }]}>
              {revealed[i] ? (
                <Animated.View style={[scratchStyles.cellRevealed, { opacity: revealAnims[i], transform: [{ scale: revealAnims[i] }] }]}>
                  <MaterialIcons name="star" size={16} color={colorForVal(val)} />
                  <Text style={[scratchStyles.cellValue, { color: colorForVal(val) }]}>{val}</Text>
                </Animated.View>
              ) : (
                <LinearGradient colors={canPlay ? ['#2A2A2A', '#1A1A1A'] : ['#1A1A1A', '#111']} style={scratchStyles.cellHidden}>
                  <MaterialIcons name="question-mark" size={20} color={canPlay ? Colors.textSecondary : Colors.textMuted} />
                </LinearGradient>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {matchBonus > 0 && (
        <Animated.View style={[scratchStyles.matchBanner, { transform: [{ scale: celebAnim }], opacity: celebAnim }]}>
          <LinearGradient colors={['#9C27B0', '#E91E63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={scratchStyles.matchGrad}>
            <MaterialIcons name="emoji-events" size={18} color="#fff" />
            <Text style={scratchStyles.matchText}>MATCH BONUS: +{matchBonus} Stars!</Text>
          </LinearGradient>
        </Animated.View>
      )}
      <View style={scratchStyles.actions}>
        {!gameOver && canPlay && (
          <TouchableOpacity onPress={revealAll} activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient colors={Colors.gradientPink as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={scratchStyles.actionBtn}>
              <MaterialIcons name="touch-app" size={16} color="#fff" />
              <Text style={scratchStyles.actionBtnText}>Reveal All</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {gameOver && (
          <TouchableOpacity onPress={extraPlays > 0 ? resetCard : buyExtraPlay} activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient
              colors={extraPlays > 0 ? (Colors.gradientPink as [string, string]) : ['#4C1D95', '#7C3AED']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={scratchStyles.actionBtn}
            >
              <MaterialIcons name={extraPlays > 0 ? 'refresh' : 'star'} size={16} color="#fff" />
              <Text style={scratchStyles.actionBtnText}>{extraPlays > 0 ? 'Play Again' : 'Buy Play — 50 ★'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
      {!canPlay && !gameOver && (
        <TouchableOpacity onPress={buyExtraPlay} activeOpacity={0.85} style={{ marginTop: Spacing.sm }}>
          <View style={scratchStyles.buyBtn}>
            <MaterialIcons name="star" size={13} color={Colors.purple} />
            <Text style={scratchStyles.buyBtnText}>Buy Extra Play — 50 ★</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const scratchStyles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  cooldownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,184,0,0.15)', borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)' },
  cooldownText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', marginBottom: Spacing.md },
  cell: { borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.surfaceBorder },
  cellHidden: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cellRevealed: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceElevated, gap: 3 },
  cellValue: { fontSize: FontSize.sm, fontWeight: '800' },
  matchBanner: { borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: Spacing.sm },
  matchGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 9, paddingHorizontal: Spacing.lg },
  matchText: { fontSize: FontSize.xs, fontWeight: '800', color: '#fff' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { height: 46, borderRadius: BorderRadius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  buyBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.purple },
});

// ─── Number Picker (£1.99 premium game) ───────────────────────────────────────

function NumberPickerSection() {
  const { addStars, user } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const scaleAnims = useRef(Array.from({ length: 10 }, () => new Animated.Value(1))).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  // Prize table: higher numbers = higher risk/reward
  const PRIZES: Record<number, number> = {
    1: 50, 2: 75, 3: 100, 4: 150, 5: 200,
    6: 300, 7: 500, 8: 750, 9: 1000, 10: 5000,
  };
  const REVEAL_PROBABILITIES: Record<number, number> = {
    1: 0.90, 2: 0.80, 3: 0.70, 4: 0.60, 5: 0.50,
    6: 0.35, 7: 0.20, 8: 0.12, 9: 0.06, 10: 0.02,
  };

  const selectNumber = (n: number) => {
    if (revealed || loading) return;
    setSelected(n);
    scaleAnims[n - 1].setValue(1);
    Animated.spring(scaleAnims[n - 1], { toValue: 1.12, useNativeDriver: true, tension: 200, friction: 8 }).start();
    if (selected !== null && selected !== n) {
      Animated.spring(scaleAnims[selected - 1], { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start();
    }
  };

  const play = async () => {
    if (!selected || !user) return;
    setLoading(true);
    try {
      await connectIAP();
      const purchase = await purchaseProduct(NUMBER_PICK_CONFIG.productId);
      if (!purchase) { setLoading(false); return; }
      await completePurchase(purchase);

      // Determine win
      const prob = REVEAL_PROBABILITIES[selected];
      const won = Math.random() < prob;
      const prize = won ? PRIZES[selected] : 0;
      setWinAmount(prize);
      setRevealed(true);

      resultAnim.setValue(0);
      Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }).start();

      if (prize > 0) {
        await addStars(prize, `Number Pick win — picked ${selected}, won ${prize} stars`, 'number_pick');
        await supabase.from('spin_history').insert({ user_id: user.id, game_type: 'number_pick', stars_won: prize, result_data: { picked: selected, won: true } }).catch(() => {});
        showAlert('Winner!', `You picked ${selected} and won ${prize} stars!`);
      } else {
        await supabase.from('spin_history').insert({ user_id: user.id, game_type: 'number_pick', stars_won: 0, result_data: { picked: selected, won: false } }).catch(() => {});
        showAlert('Not This Time', `You picked ${selected} but did not win. Try again!`);
      }
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelected(null); setRevealed(false); setWinAmount(0); resultAnim.setValue(0);
    scaleAnims.forEach(a => a.setValue(1));
  };

  return (
    <View style={npStyles.container}>
      <View style={npStyles.header}>
        <MaterialIcons name="looks-one" size={22} color={Colors.info} />
        <View style={{ flex: 1 }}>
          <Text style={npStyles.title}>Number Picker</Text>
          <Text style={npStyles.sub}>{NUMBER_PICK_CONFIG.description}</Text>
        </View>
        <View style={npStyles.priceBadge}>
          <Text style={npStyles.priceText}>{NUMBER_PICK_CONFIG.price}</Text>
        </View>
      </View>

      {/* Prize table */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={npStyles.prizeRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <View key={n} style={npStyles.prizeItem}>
            <Text style={[npStyles.prizeNum, { color: n >= 8 ? Colors.primary : n >= 5 ? Colors.gold : Colors.textSecondary }]}>{n}</Text>
            <Text style={npStyles.prizeStars}>{PRIZES[n].toLocaleString()}★</Text>
          </View>
        ))}
      </ScrollView>

      {/* Number buttons */}
      <View style={npStyles.grid}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
          const isSelected = selected === n;
          return (
            <Animated.View key={n} style={{ transform: [{ scale: scaleAnims[n - 1] }] }}>
              <TouchableOpacity
                onPress={() => selectNumber(n)}
                disabled={revealed || loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isSelected ? (Colors.gradientPink as [string, string]) : ['#2A2A2A', '#1A1A1A']}
                  style={[npStyles.numBtn, isSelected && npStyles.numBtnSelected]}
                >
                  <Text style={[npStyles.numText, isSelected && { color: '#fff' }]}>{n}</Text>
                  {n >= 8 && <MaterialIcons name="bolt" size={10} color={isSelected ? '#fff' : Colors.gold} />}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Result */}
      {revealed && (
        <Animated.View style={[npStyles.result, { transform: [{ scale: resultAnim }], opacity: resultAnim }]}>
          <LinearGradient
            colors={winAmount > 0 ? ['#FFD700', '#FF6B35'] : ['#333', '#222']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={npStyles.resultGrad}
          >
            <MaterialIcons name={winAmount > 0 ? 'celebration' : 'close'} size={18} color="#fff" />
            <Text style={npStyles.resultText}>
              {winAmount > 0 ? `YOU WON ${winAmount} STARS!` : 'BETTER LUCK NEXT TIME'}
            </Text>
          </LinearGradient>
        </Animated.View>
      )}

      <TouchableOpacity
        onPress={revealed ? reset : play}
        disabled={(!selected && !revealed) || loading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={(selected || revealed) && !loading ? ['#0A84FF', '#0065CC'] : ['#333', '#222']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[npStyles.playBtn, ((!selected && !revealed) || loading) && { opacity: 0.5 }]}
        >
          <MaterialIcons name={revealed ? 'refresh' : 'play-arrow'} size={20} color="#fff" />
          <Text style={npStyles.playBtnText}>
            {loading ? 'Processing...' : revealed ? 'Play Again' : `Pick & Play — ${NUMBER_PICK_CONFIG.price}`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const npStyles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(10,132,255,0.25)', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  priceBadge: { backgroundColor: 'rgba(10,132,255,0.15)', borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  priceText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.info },
  prizeRow: { paddingVertical: Spacing.sm, gap: Spacing.sm, paddingHorizontal: 2 },
  prizeItem: { alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, width: 52, paddingVertical: 6, borderWidth: 1, borderColor: Colors.surfaceBorder },
  prizeNum: { fontSize: FontSize.md, fontWeight: '800' },
  prizeStars: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', marginVertical: Spacing.md },
  numBtn: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder },
  numBtnSelected: { borderColor: 'transparent' },
  numText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  result: { borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: Spacing.sm },
  resultGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: Spacing.lg },
  resultText: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  playBtn: { height: 50, borderRadius: BorderRadius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  playBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});

// ─── Memory Match (£2.99 premium game) ─────────────────────────────────────────

const MEMORY_EMOJIS = ['⭐', '🚀', '💎', '🔥', '👑', '🎯', '💡', '🎪'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MemoryMatchSection() {
  const { addStars, user } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [cards, setCards] = useState<{ id: number; emoji: string; matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const flipAnims = useRef<Animated.Value[]>([]);

  const initGame = useCallback(() => {
    const pairs = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS];
    const shuffled = shuffle(pairs).map((emoji, id) => ({ id, emoji, matched: false }));
    setCards(shuffled);
    setFlipped([]);
    setMoves(0);
    setCompleted(false);
    flipAnims.current = shuffled.map(() => new Animated.Value(0));
  }, []);

  const startGame = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await connectIAP();
      const purchase = await purchaseProduct(MEMORY_MATCH_CONFIG.productId);
      if (!purchase) { setLoading(false); return; }
      await completePurchase(purchase);
      initGame();
      setStarted(true);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const flipCard = (id: number) => {
    if (flipped.length >= 2 || flipped.includes(id) || cards[id].matched) return;
    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    Animated.timing(flipAnims.current[id], { toValue: 1, duration: 200, useNativeDriver: true }).start();

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = newFlipped;
      if (cards[a].emoji === cards[b].emoji) {
        // Match!
        setTimeout(() => {
          const newCards = cards.map((c, i) => i === a || i === b ? { ...c, matched: true } : c);
          setCards(newCards);
          setFlipped([]);
          if (newCards.every(c => c.matched)) finishGame(moves + 1);
        }, 400);
      } else {
        // No match — flip back
        setTimeout(() => {
          Animated.timing(flipAnims.current[a], { toValue: 0, duration: 200, useNativeDriver: true }).start();
          Animated.timing(flipAnims.current[b], { toValue: 0, duration: 200, useNativeDriver: true }).start();
          setFlipped([]);
        }, 800);
      }
    }
  };

  const finishGame = async (finalMoves: number) => {
    setCompleted(true);
    // Fewer moves = higher prize
    let prize = 100;
    if (finalMoves <= 10) prize = 10000;
    else if (finalMoves <= 14) prize = 5000;
    else if (finalMoves <= 18) prize = 2000;
    else if (finalMoves <= 22) prize = 1000;
    else if (finalMoves <= 26) prize = 500;
    else if (finalMoves <= 30) prize = 200;

    await addStars(prize, `Memory Match completed in ${finalMoves} moves — ${prize} stars`, 'memory_match');
    if (user) await supabase.from('spin_history').insert({ user_id: user.id, game_type: 'memory_match', stars_won: prize, result_data: { moves: finalMoves } }).catch(() => {});
    showAlert('Completed!', `You matched all pairs in ${finalMoves} moves!\n\nYou won ${prize.toLocaleString()} stars!`);
  };

  const cardSize = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.md * 2 - Spacing.sm * 7) / 4;

  if (!started) {
    return (
      <View style={mmStyles.container}>
        <View style={mmStyles.header}>
          <MaterialIcons name="grid-view" size={22} color={Colors.purple} />
          <View style={{ flex: 1 }}>
            <Text style={mmStyles.title}>Memory Match</Text>
            <Text style={mmStyles.sub}>{MEMORY_MATCH_CONFIG.description}</Text>
          </View>
          <View style={mmStyles.priceBadge}>
            <Text style={mmStyles.priceText}>{MEMORY_MATCH_CONFIG.price}</Text>
          </View>
        </View>

        {/* Prize table */}
        <View style={mmStyles.prizeTable}>
          <Text style={mmStyles.prizeTableTitle}>Prize Table</Text>
          {[
            { moves: '≤10', prize: '10,000★', color: Colors.primary },
            { moves: '≤14', prize: '5,000★', color: Colors.gold },
            { moves: '≤18', prize: '2,000★', color: Colors.purple },
            { moves: '≤22', prize: '1,000★', color: Colors.info },
            { moves: '≤26', prize: '500★', color: Colors.success },
            { moves: '≤30', prize: '200★', color: Colors.textSecondary },
            { moves: 'Any', prize: '100★', color: Colors.textMuted },
          ].map(row => (
            <View key={row.moves} style={mmStyles.prizeRow}>
              <Text style={mmStyles.prizeMovesText}>{row.moves} moves</Text>
              <Text style={[mmStyles.prizeStarsText, { color: row.color }]}>{row.prize}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={startGame} disabled={loading} activeOpacity={0.85}>
          <LinearGradient
            colors={loading ? ['#333', '#222'] : ['#4C1D95', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={mmStyles.startBtn}
          >
            <MaterialIcons name="play-arrow" size={20} color="#fff" />
            <Text style={mmStyles.startBtnText}>
              {loading ? 'Starting...' : `Play — ${MEMORY_MATCH_CONFIG.price}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={mmStyles.container}>
      <View style={mmStyles.header}>
        <MaterialIcons name="grid-view" size={22} color={Colors.purple} />
        <Text style={mmStyles.title}>Memory Match</Text>
        <View style={mmStyles.movesRow}>
          <MaterialIcons name="swap-vert" size={14} color={Colors.textSecondary} />
          <Text style={mmStyles.movesText}>{moves} moves</Text>
        </View>
      </View>

      <View style={mmStyles.grid}>
        {cards.map((card, i) => {
          const isFlipped = flipped.includes(i) || card.matched;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => flipCard(i)}
              disabled={isFlipped || flipped.length >= 2}
              activeOpacity={0.8}
            >
              <Animated.View style={[mmStyles.card, { width: cardSize, height: cardSize }, card.matched && mmStyles.cardMatched, isFlipped && mmStyles.cardFlipped]}>
                {isFlipped ? (
                  <Text style={mmStyles.cardEmoji}>{card.emoji}</Text>
                ) : (
                  <LinearGradient colors={['#2A2A3E', '#1A1A2E']} style={mmStyles.cardBack}>
                    <MaterialIcons name="star" size={14} color={Colors.textMuted} />
                  </LinearGradient>
                )}
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>

      {completed && (
        <TouchableOpacity onPress={() => setStarted(false)} style={{ marginTop: Spacing.sm }} activeOpacity={0.85}>
          <LinearGradient colors={['#4C1D95', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mmStyles.startBtn}>
            <MaterialIcons name="refresh" size={18} color="#fff" />
            <Text style={mmStyles.startBtnText}>Play Again — {MEMORY_MATCH_CONFIG.price}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const mmStyles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  priceBadge: { backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  priceText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.purple },
  prizeTable: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder },
  prizeTableTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  prizeMovesText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  prizeStarsText: { fontSize: FontSize.xs, fontWeight: '800' },
  movesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  movesText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: Colors.surfaceBorder },
  cardBack: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  cardFlipped: { backgroundColor: Colors.surfaceElevated, borderColor: Colors.purple + '44' },
  cardMatched: { backgroundColor: Colors.success + '22', borderColor: Colors.success + '66' },
  cardEmoji: { fontSize: 24 },
  startBtn: { height: 50, borderRadius: BorderRadius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function EarnScreen() {
  const { user, addStars, markTaskComplete } = useUser();
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState<'all' | 'follow' | 'like' | 'watch_ad'>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [section, setSection] = useState<'games' | 'tasks'>('tasks');
  const [completedTodayIds, setCompletedTodayIds] = useState<Set<string>>(new Set());
  const resetCountdown = useResetCountdown();

  useEffect(() => { getCompletedTodayIds().then(setCompletedTodayIds); }, []);

  if (!user) return null;

  const filteredTasks = filter === 'all' ? TASKS : TASKS.filter(t => t.type === filter);

  const isTaskCompleted = (task: Task) =>
    DAILY_TASK_IDS.has(task.id) ? completedTodayIds.has(task.id) : user.completedTaskIds.includes(task.id);

  const handleTask = async (task: Task) => {
    if (isTaskCompleted(task)) { showAlert('Already Completed', 'You have already completed this task.'); return; }
    if (task.tiktokUrl) {
      showAlert(task.title, `Complete the action on TikTok, then come back to claim your +${task.stars} stars.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open TikTok',
          onPress: async () => {
            await Linking.openURL(task.tiktokUrl!);
            setTimeout(() => {
              showAlert('Did you complete the task?', `Confirm to receive +${task.stars} stars!`, [
                { text: 'Not Yet', style: 'cancel' },
                {
                  text: `Claim +${task.stars}`,
                  onPress: async () => {
                    setCompletingId(task.id);
                    await addStars(task.stars, task.title, task.type);
                    await markTaskComplete(task.id);
                    setCompletingId(null);
                    showAlert('Stars Earned!', `+${task.stars} stars added!`);
                  },
                },
              ]);
            }, 3000);
          },
        },
      ]);
    } else if (task.type === 'watch_ad') {
      showAlert('Watch Ad', 'Watch a short 30-second ad to earn stars.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Watch Now',
          onPress: async () => {
            setCompletingId(task.id);
            setTimeout(async () => {
              await addStars(task.stars, task.title, 'watch_ad');
              await markDailyTaskComplete(task.id);
              setCompletedTodayIds(await getCompletedTodayIds());
              setCompletingId(null);
              showAlert('Ad Complete!', `+${task.stars} stars added!`);
            }, 2000);
          },
        },
      ]);
    } else if (task.type === 'daily_checkin') {
      setCompletingId(task.id);
      await addStars(task.stars, task.title, 'daily_checkin');
      await markDailyTaskComplete(task.id);
      setCompletedTodayIds(await getCompletedTodayIds());
      setCompletingId(null);
      showAlert('Checked In!', `+${task.stars} stars for your daily check-in!`);
    }
  };

  const totalAvailable = TASKS.filter(t => !isTaskCompleted(t)).reduce((s, t) => s + t.stars, 0);
  const tier = user.subscriptionTier || (user.isVIP ? 'pro' : 'free');
  const weeklyAllowance = WEEKLY_FREE_SPINS[tier] ?? 1;

  const filters = [
    { key: 'all' as const, label: 'All', icon: 'apps' },
    { key: 'follow' as const, label: 'Follow', icon: 'person-add' },
    { key: 'like' as const, label: 'Like', icon: 'favorite' },
    { key: 'watch_ad' as const, label: 'Ads', icon: 'play-circle-filled' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Earn Stars</Text>
          <View style={styles.balancePill}>
            <MaterialIcons name="star" size={14} color={Colors.gold} />
            <Text style={styles.balanceText}>{user.stars.toLocaleString()}</Text>
          </View>
        </View>

        <LinearGradient colors={['#2A0A14', '#1A0A10']} style={styles.earningsBanner}>
          <MaterialIcons name="star" size={24} color={Colors.gold} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.earningsTitle}>Available to Earn</Text>
            <Text style={styles.earningsValue}>+{totalAvailable.toLocaleString()} Stars</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={styles.earningsHint}>{TASKS.filter(t => !isTaskCompleted(t)).length} tasks</Text>
            <Text style={[styles.earningsHint, { color: Colors.gold }]}>{weeklyAllowance} spins/wk</Text>
          </View>
        </LinearGradient>

        <View style={styles.sectionToggle}>
          <TouchableOpacity style={[styles.sectionBtn, section === 'tasks' && styles.sectionBtnActive]} onPress={() => setSection('tasks')}>
            <MaterialIcons name="checklist" size={16} color={section === 'tasks' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.sectionBtnText, section === 'tasks' && styles.sectionBtnTextActive]}>Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sectionBtn, section === 'games' && styles.sectionBtnActive]} onPress={() => setSection('games')}>
            <MaterialIcons name="casino" size={16} color={section === 'games' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.sectionBtnText, section === 'games' && styles.sectionBtnTextActive]}>Mini Games</Text>
            <View style={styles.newBadge}><Text style={styles.newBadgeText}>4</Text></View>
          </TouchableOpacity>
        </View>

        {section === 'games' ? (
          <View style={styles.gamesContainer}>
            {/* Premium games header */}
            <View style={styles.gamesSectionHeader}>
              <MaterialIcons name="star" size={16} color={Colors.gold} />
              <Text style={styles.gamesSectionTitle}>Free Games</Text>
            </View>
            <SpinWheelSection />
            <ScratchCardSection />

            <View style={styles.gamesSectionHeader}>
              <MaterialIcons name="monetization-on" size={16} color={Colors.info} />
              <Text style={styles.gamesSectionTitle}>Premium Games</Text>
              <Text style={styles.gamesSectionSub}>Real money prizes — buy a play to win big</Text>
            </View>
            <NumberPickerSection />
            <MemoryMatchSection />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
              {filters.map(f => (
                <TouchableOpacity key={f.key} style={[styles.filterChip, filter === f.key && styles.filterChipActive]} onPress={() => setFilter(f.key)} activeOpacity={0.8}>
                  <MaterialIcons name={f.icon as any} size={14} color={filter === f.key ? '#fff' : Colors.textSecondary} />
                  <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.tasksList}>
              {filteredTasks.map(task => {
                const completed = isTaskCompleted(task);
                const loading = completingId === task.id;
                const typeColor = TASK_TYPE_COLORS[task.type] || Colors.primary;
                return (
                  <TouchableOpacity key={task.id} style={[styles.taskCard, completed && styles.taskCardCompleted]} onPress={() => handleTask(task)} activeOpacity={0.8} disabled={loading}>
                    <View style={[styles.taskIcon, { backgroundColor: typeColor + '22' }]}>
                      <MaterialIcons name={TASK_TYPE_ICONS[task.type] as any} size={22} color={typeColor} />
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskTitle, completed && styles.taskTitleDone]}>{task.title}</Text>
                      <Text style={styles.taskDesc}>{task.description}</Text>
                      {DAILY_TASK_IDS.has(task.id) && !completed && (
                        <View style={styles.resetRow}>
                          <MaterialIcons name="schedule" size={10} color={Colors.textMuted} />
                          <Text style={styles.resetText}>Resets at midnight · {resetCountdown}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.taskReward}>
                      {completed ? (
                        <View style={styles.doneIcon}><MaterialIcons name="check-circle" size={24} color={Colors.success} /></View>
                      ) : (
                        <LinearGradient colors={Colors.gradientPink as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rewardBadge}>
                          <MaterialIcons name="star" size={12} color={Colors.gold} />
                          <Text style={styles.rewardText}>+{task.stars}</Text>
                        </LinearGradient>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  balanceText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gold },
  earningsBanner: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)' },
  earningsTitle: { fontSize: FontSize.xs, color: Colors.textSecondary },
  earningsValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gold },
  earningsHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionToggle: { flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, gap: 4, borderWidth: 1, borderColor: Colors.surfaceBorder },
  sectionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md },
  sectionBtnActive: { backgroundColor: Colors.primary },
  sectionBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  sectionBtnTextActive: { color: '#fff' },
  newBadge: { backgroundColor: Colors.gold, borderRadius: BorderRadius.full, paddingHorizontal: 5, paddingVertical: 2 },
  newBadgeText: { fontSize: 8, fontWeight: '800', color: '#000' },
  gamesContainer: { paddingHorizontal: Spacing.md },
  gamesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  gamesSectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  gamesSectionSub: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  filterBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, borderWidth: 1, borderColor: Colors.surfaceBorder },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },
  tasksList: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder, gap: Spacing.sm },
  taskCardCompleted: { opacity: 0.5 },
  taskIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  taskDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  taskReward: { alignItems: 'center' },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  rewardText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  doneIcon: { padding: 4 },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  resetText: { fontSize: 10, color: Colors.textMuted },
});
