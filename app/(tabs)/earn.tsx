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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/hooks/useUser';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { TASKS, Task } from '@/services/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(SCREEN_WIDTH - 64, 300);

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

// ─── Spin Wheel ────────────────────────────────────────────────────────────────

const SEGMENTS = [
  { stars: 10, color: '#FF2D55', label: '10 ⭐' },
  { stars: 25, color: '#FF6B35', label: '25 ⭐' },
  { stars: 50, color: '#FFB800', label: '50 ⭐' },
  { stars: 100, color: '#00C851', label: '100 ⭐' },
  { stars: 15, color: '#2196F3', label: '15 ⭐' },
  { stars: 200, color: '#9C27B0', label: '200 ⭐' },
  { stars: 35, color: '#FF5722', label: '35 ⭐' },
  { stars: 500, color: '#E91E63', label: '500 ⭐' },
];

// Weighted random: higher weights for smaller prizes
const WEIGHTS = [30, 25, 20, 10, 25, 5, 20, 1];

function weightedRandom(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    rand -= WEIGHTS[i];
    if (rand <= 0) return i;
  }
  return 0;
}

const SPIN_STORAGE_KEY = 'tikboost_last_spin';
const SCRATCH_STORAGE_KEY = 'tikboost_last_scratch';
const DAILY_TASKS_KEY = 'tikboost_daily_tasks_date';
const DAILY_TASK_IDS = new Set(['daily_checkin', 'watch_ad_1', 'watch_ad_2']);

// Returns today's date string YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Time until midnight countdown
function useResetCountdown() {
  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      setMsLeft(midnight.getTime() - now.getTime());
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function getCompletedTodayIds(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(DAILY_TASKS_KEY);
    if (!stored) return new Set();
    const { date, ids } = JSON.parse(stored);
    if (date !== todayStr()) return new Set(); // new day, reset
    return new Set(ids);
  } catch {
    return new Set();
  }
}

async function markDailyTaskComplete(taskId: string): Promise<void> {
  try {
    const existing = await getCompletedTodayIds();
    existing.add(taskId);
    await AsyncStorage.setItem(DAILY_TASKS_KEY, JSON.stringify({
      date: todayStr(),
      ids: Array.from(existing),
    }));
  } catch {}
}

function SpinWheelSection() {
  const { addStars, markTaskComplete, user } = useUser();
  const { showAlert } = useAlert();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const winAnim = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [lastSpin, setLastSpin] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [wonStars, setWonStars] = useState<number | null>(null);
  const [totalRotation, setTotalRotation] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(SPIN_STORAGE_KEY).then(ts => {
      if (ts) setLastSpin(ts);
    });
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

  const canSpin = cooldownLeft === 0;

  const formatCooldown = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const handleSpin = async () => {
    if (spinning || !canSpin || !user) return;
    setSpinning(true);
    setWonStars(null);

    const segmentIndex = weightedRandom();
    const segmentAngle = 360 / SEGMENTS.length;
    // Target angle to land on chosen segment (pointer at top = 270deg offset)
    const targetSegmentDeg = segmentIndex * segmentAngle;
    const extraSpins = (3 + Math.floor(Math.random() * 3)) * 360;
    const newTotal = totalRotation + extraSpins + (360 - targetSegmentDeg - totalRotation % 360 + (270 + segmentAngle / 2));

    setTotalRotation(newTotal);

    spinAnim.setValue(totalRotation);
    Animated.timing(spinAnim, {
      toValue: newTotal,
      duration: 4000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      const prize = SEGMENTS[segmentIndex].stars;
      setWonStars(prize);

      // Win animation
      winAnim.setValue(0);
      Animated.spring(winAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 6 }).start();

      await addStars(prize, `Spin Wheel win — ${prize} stars`, 'spin_game');
      const now = Date.now().toString();
      setLastSpin(now);
      await AsyncStorage.setItem(SPIN_STORAGE_KEY, now);
      setSpinning(false);

      showAlert('You Won!', `🎉 Congratulations! You earned ${prize} stars from the spin wheel!`);
    });
  };

  const rotate = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const segmentAngle = 360 / SEGMENTS.length;
  const wheelRadius = WHEEL_SIZE / 2;

  return (
    <View style={wheelStyles.container}>
      <View style={wheelStyles.header}>
        <MaterialIcons name="casino" size={22} color={Colors.gold} />
        <Text style={wheelStyles.title}>Daily Spin</Text>
        {!canSpin && (
          <View style={wheelStyles.cooldownBadge}>
            <MaterialIcons name="schedule" size={12} color={Colors.warning} />
            <Text style={wheelStyles.cooldownText}>{formatCooldown(cooldownLeft)}</Text>
          </View>
        )}
        {canSpin && (
          <View style={wheelStyles.readyBadge}>
            <Text style={wheelStyles.readyText}>READY!</Text>
          </View>
        )}
      </View>

      <View style={wheelStyles.wheelWrapper}>
        {/* Pointer */}
        <View style={wheelStyles.pointer}>
          <MaterialIcons name="arrow-drop-down" size={40} color={Colors.primary} />
        </View>

        <Animated.View style={[wheelStyles.wheel, { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, transform: [{ rotate }] }]}>
          {SEGMENTS.map((seg, i) => {
            const angle = (segmentAngle * i - 90) * (Math.PI / 180);
            const textRadius = wheelRadius * 0.65;
            const textX = wheelRadius + textRadius * Math.cos(angle + (segmentAngle / 2) * (Math.PI / 180)) - wheelRadius;
            const textY = wheelRadius + textRadius * Math.sin(angle + (segmentAngle / 2) * (Math.PI / 180)) - wheelRadius;
            return (
              <View
                key={i}
                style={[wheelStyles.segment, {
                  width: WHEEL_SIZE,
                  height: WHEEL_SIZE,
                  borderRadius: WHEEL_SIZE / 2,
                  position: 'absolute',
                  overflow: 'hidden',
                  transform: [{ rotate: `${segmentAngle * i}deg` }],
                }]}
              >
                <View style={[wheelStyles.segmentFill, { backgroundColor: seg.color, width: WHEEL_SIZE / 2, height: WHEEL_SIZE / 2 }]} />
                <Text style={[wheelStyles.segmentLabel, {
                  position: 'absolute',
                  left: wheelRadius + textX - 20,
                  top: wheelRadius + textY - 8,
                  transform: [{ rotate: `${segmentAngle / 2}deg` }],
                }]}>
                  {seg.label}
                </Text>
              </View>
            );
          })}
          {/* Center */}
          <View style={[wheelStyles.center, { width: WHEEL_SIZE * 0.22, height: WHEEL_SIZE * 0.22, borderRadius: WHEEL_SIZE * 0.11, left: WHEEL_SIZE * 0.39, top: WHEEL_SIZE * 0.39 }]}>
            <MaterialIcons name="star" size={22} color={Colors.gold} />
          </View>
        </Animated.View>
      </View>

      {/* Win display */}
      {wonStars !== null && (
        <Animated.View style={[wheelStyles.winBadge, {
          transform: [{ scale: winAnim }, { translateY: winAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          opacity: winAnim,
        }]}>
          <LinearGradient colors={['#FFD700', '#FF6B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={wheelStyles.winGrad}>
            <MaterialIcons name="celebration" size={20} color="#fff" />
            <Text style={wheelStyles.winText}>+{wonStars} Stars Won!</Text>
          </LinearGradient>
        </Animated.View>
      )}

      <TouchableOpacity
        onPress={handleSpin}
        disabled={spinning || !canSpin}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={canSpin && !spinning ? (Colors.gradientPink as [string, string]) : ['#333', '#222']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={wheelStyles.spinBtn}
        >
          <MaterialIcons name="casino" size={20} color={canSpin && !spinning ? '#fff' : Colors.textMuted} />
          <Text style={[wheelStyles.spinBtnText, (!canSpin || spinning) && { color: Colors.textMuted }]}>
            {spinning ? 'Spinning...' : canSpin ? 'SPIN NOW — FREE' : 'Come back tomorrow'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Scratch Card ───────────────────────────────────────────────────────────────

const SCRATCH_VALUES = [10, 20, 30, 50, 100, 150, 200, 300];
const MATCH_BONUSES: Record<number, number> = { 10: 50, 20: 100, 30: 150, 50: 200, 100: 400, 150: 500, 200: 750, 300: 1000 };

function generateScratchGrid(): number[] {
  // Ensure at least one potential match
  const grid = Array.from({ length: 9 }, () => SCRATCH_VALUES[Math.floor(Math.random() * SCRATCH_VALUES.length)]);
  // 30% chance to force a match
  if (Math.random() < 0.3) {
    const val = SCRATCH_VALUES[Math.floor(Math.random() * SCRATCH_VALUES.length)];
    const positions = [0, 4, 8].sort(() => Math.random() - 0.5).slice(0, 3);
    positions.forEach(p => { grid[p] = val; });
  }
  return grid;
}

function ScratchCardSection() {
  const { addStars, spendStars, user } = useUser();
  const { showAlert } = useAlert();
  const [grid, setGrid] = useState<number[]>(() => generateScratchGrid());
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [lastScratch, setLastScratch] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [extraPlays, setExtraPlays] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [matchBonus, setMatchBonus] = useState(0);
  const revealAnims = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  const celebAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(SCRATCH_STORAGE_KEY).then(ts => {
      if (ts) setLastScratch(ts);
    });
  }, []);

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

  const formatCooldown = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const revealCell = (index: number) => {
    if (revealed[index] || gameOver || !canPlay) return;
    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);

    Animated.spring(revealAnims[index], {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 7,
    }).start();

    // Check if all revealed
    const allRevealed = newRevealed.every(Boolean);
    if (allRevealed) {
      finishGame(newRevealed);
    }
  };

  const finishGame = async (finalRevealed: boolean[]) => {
    setGameOver(true);

    // Tally earnings
    const total = grid.reduce((sum, val) => sum + val, 0);

    // Check for 3-of-a-kind match
    const counts: Record<number, number[]> = {};
    grid.forEach((val, i) => {
      if (!counts[val]) counts[val] = [];
      counts[val].push(i);
    });
    let bonus = 0;
    for (const [val, positions] of Object.entries(counts)) {
      if (positions.length >= 3) {
        bonus = MATCH_BONUSES[parseInt(val)] || 0;
        break;
      }
    }

    setTotalWon(total);
    setMatchBonus(bonus);

    // Animate celebration if match
    if (bonus > 0) {
      Animated.spring(celebAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 5 }).start();
    }

    const awarded = total + bonus;
    await addStars(awarded, `Scratch Card — ${awarded} stars${bonus > 0 ? ` (match bonus!)` : ''}`, 'scratch_card');

    const now = Date.now().toString();
    if (extraPlays > 0) {
      setExtraPlays(p => p - 1);
    } else {
      setLastScratch(now);
      await AsyncStorage.setItem(SCRATCH_STORAGE_KEY, now);
    }

    if (bonus > 0) {
      showAlert('MATCH BONUS!', `You matched 3! Earned ${total} + ${bonus} bonus = ${awarded} total stars!`);
    } else {
      showAlert('Card Complete!', `You scratched ${total} stars!`);
    }
  };

  const resetCard = () => {
    setGrid(generateScratchGrid());
    setRevealed(Array(9).fill(false));
    setGameOver(false);
    setTotalWon(0);
    setMatchBonus(0);
    revealAnims.forEach(a => a.setValue(0));
    celebAnim.setValue(0);
  };

  const buyExtraPlay = async () => {
    if (!user || user.stars < 50) {
      showAlert('Not Enough Stars', 'You need 50 stars to buy an extra play.');
      return;
    }
    const success = await spendStars(50, 'Extra scratch card play', 'scratch_card');
    if (success) {
      setExtraPlays(p => p + 1);
      if (gameOver) resetCard();
      showAlert('Extra Play Purchased!', 'You have 1 extra scratch card play ready.');
    }
  };

  const revealAll = () => {
    if (!canPlay) return;
    const newRevealed = Array(9).fill(true);
    setRevealed(newRevealed);
    revealAnims.forEach((a, i) => {
      setTimeout(() => {
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }).start();
      }, i * 60);
    });
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

  return (
    <View style={scratchStyles.container}>
      <View style={scratchStyles.header}>
        <MaterialIcons name="credit-card" size={22} color={Colors.purple} />
        <Text style={scratchStyles.title}>Scratch Card</Text>
        {cooldownLeft > 0 && extraPlays === 0 && (
          <View style={[scratchStyles.cooldownBadge]}>
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

      {/* Grid */}
      <View style={scratchStyles.grid}>
        {grid.map((val, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => revealCell(i)}
            disabled={revealed[i] || gameOver || !canPlay}
            activeOpacity={0.7}
          >
            <View style={scratchStyles.cell}>
              {revealed[i] ? (
                <Animated.View style={[scratchStyles.cellRevealed, {
                  opacity: revealAnims[i],
                  transform: [{ scale: revealAnims[i] }],
                }]}>
                  <MaterialIcons name="star" size={18} color={colorForVal(val)} />
                  <Text style={[scratchStyles.cellValue, { color: colorForVal(val) }]}>{val}</Text>
                </Animated.View>
              ) : (
                <LinearGradient
                  colors={canPlay ? ['#2A2A2A', '#1A1A1A'] : ['#1A1A1A', '#111']}
                  style={scratchStyles.cellHidden}
                >
                  <MaterialIcons name="question-mark" size={22} color={canPlay ? Colors.textSecondary : Colors.textMuted} />
                </LinearGradient>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Match bonus celebration */}
      {matchBonus > 0 && (
        <Animated.View style={[scratchStyles.matchBanner, {
          transform: [{ scale: celebAnim }],
          opacity: celebAnim,
        }]}>
          <LinearGradient colors={['#9C27B0', '#E91E63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={scratchStyles.matchGrad}>
            <MaterialIcons name="emoji-events" size={20} color="#fff" />
            <Text style={scratchStyles.matchText}>MATCH BONUS: +{matchBonus} Stars!</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Actions */}
      <View style={scratchStyles.actions}>
        {!gameOver && canPlay && (
          <TouchableOpacity onPress={revealAll} activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={scratchStyles.actionBtn}
            >
              <MaterialIcons name="touch-app" size={18} color="#fff" />
              <Text style={scratchStyles.actionBtnText}>Reveal All</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {gameOver && (
          <TouchableOpacity
            onPress={extraPlays > 0 ? resetCard : buyExtraPlay}
            activeOpacity={0.85}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={extraPlays > 0 ? (Colors.gradientPink as [string, string]) : ['#4C1D95', '#7C3AED']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={scratchStyles.actionBtn}
            >
              <MaterialIcons name={extraPlays > 0 ? 'refresh' : 'star'} size={18} color="#fff" />
              <Text style={scratchStyles.actionBtnText}>
                {extraPlays > 0 ? 'Play Again (Free)' : 'Buy Play — 50 ★'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {!gameOver && cooldownLeft === 0 && !canPlay && (
          <TouchableOpacity onPress={buyExtraPlay} activeOpacity={0.85}>
            <View style={scratchStyles.buyBtn}>
              <MaterialIcons name="star" size={14} color={Colors.purple} />
              <Text style={scratchStyles.buyBtnText}>Buy Extra Play — 50 ★</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {!canPlay && !gameOver && (
        <TouchableOpacity onPress={buyExtraPlay} activeOpacity={0.85}>
          <View style={[scratchStyles.buyBtn, { marginTop: Spacing.sm }]}>
            <MaterialIcons name="star" size={14} color={Colors.purple} />
            <Text style={scratchStyles.buyBtnText}>Buy Extra Play — 50 ★</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function EarnScreen() {
  const { user, addStars, markTaskComplete } = useUser();
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState<'all' | 'follow' | 'like' | 'watch_ad'>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [section, setSection] = useState<'games' | 'tasks'>('tasks');
  const [completedTodayIds, setCompletedTodayIds] = useState<Set<string>>(new Set());
  const resetCountdown = useResetCountdown();

  useEffect(() => {
    getCompletedTodayIds().then(setCompletedTodayIds);
  }, []);

  if (!user) return null;

  const filteredTasks = filter === 'all'
    ? TASKS
    : TASKS.filter(t => t.type === filter);

  // A task is "completed" if:
  // - It's a one-time task: check completedTaskIds in user profile
  // - It's a daily task: check completedTodayIds (AsyncStorage, resets at midnight)
  const isTaskCompleted = (task: Task) => {
    if (DAILY_TASK_IDS.has(task.id)) {
      return completedTodayIds.has(task.id);
    }
    return user.completedTaskIds.includes(task.id);
  };

  const handleTask = async (task: Task) => {
    if (isTaskCompleted(task)) {
      showAlert('Already Completed', 'You have already completed this task.');
      return;
    }

    if (task.tiktokUrl) {
      showAlert(
        task.title,
        `Complete the action on TikTok, then come back to claim your +${task.stars} stars.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open TikTok',
            onPress: async () => {
              await Linking.openURL(task.tiktokUrl!);
              setTimeout(() => {
                showAlert(
                  'Did you complete the task?',
                  `Confirm to receive +${task.stars} stars!`,
                  [
                    { text: 'Not Yet', style: 'cancel' },
                    {
                      text: `Claim +${task.stars}`,
                      onPress: async () => {
                        setCompletingId(task.id);
                        await addStars(task.stars, task.title, task.type);
                        // One-time tasks only
                        await markTaskComplete(task.id);
                        setCompletingId(null);
                        showAlert('Stars Earned!', `+${task.stars} stars added to your balance!`);
                      },
                    },
                  ]
                );
              }, 3000);
            },
          },
        ]
      );
    } else if (task.type === 'watch_ad') {
      showAlert(
        'Watch Ad',
        'Watch a short 30-second ad to earn stars.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Watch Now',
            onPress: async () => {
              setCompletingId(task.id);
              setTimeout(async () => {
                await addStars(task.stars, task.title, 'watch_ad');
                // Daily task
                await markDailyTaskComplete(task.id);
                setCompletedTodayIds(await getCompletedTodayIds());
                setCompletingId(null);
                showAlert('Ad Complete!', `+${task.stars} stars added!`);
              }, 2000);
            },
          },
        ]
      );
    } else if (task.type === 'daily_checkin') {
      setCompletingId(task.id);
      await addStars(task.stars, task.title, 'daily_checkin');
      // Daily task
      await markDailyTaskComplete(task.id);
      setCompletedTodayIds(await getCompletedTodayIds());
      setCompletingId(null);
      showAlert('Checked In!', `+${task.stars} stars for your daily check-in!`);
    }
  };

  const totalAvailable = TASKS.filter(t => !isTaskCompleted(t)).reduce((sum, t) => sum + t.stars, 0);

  const filters: { key: 'all' | 'follow' | 'like' | 'watch_ad'; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'follow', label: 'Follow', icon: 'person-add' },
    { key: 'like', label: 'Like', icon: 'favorite' },
    { key: 'watch_ad', label: 'Ads', icon: 'play-circle-filled' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earn Stars</Text>
          <View style={styles.balancePill}>
            <MaterialIcons name="star" size={14} color={Colors.gold} />
            <Text style={styles.balanceText}>{user.stars.toLocaleString()}</Text>
          </View>
        </View>

        {/* Potential earnings */}
        <LinearGradient
          colors={['#2A0A14', '#1A0A10']}
          style={styles.earningsBanner}
        >
          <MaterialIcons name="star" size={24} color={Colors.gold} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.earningsTitle}>Available to Earn</Text>
            <Text style={styles.earningsValue}>+{totalAvailable.toLocaleString()} Stars</Text>
          </View>
          <Text style={styles.earningsHint}>{TASKS.filter(t => !isTaskCompleted(t)).length} tasks</Text>
        </LinearGradient>

        {/* Section Toggle */}
        <View style={styles.sectionToggle}>
          <TouchableOpacity
            style={[styles.sectionBtn, section === 'tasks' && styles.sectionBtnActive]}
            onPress={() => setSection('tasks')}
          >
            <MaterialIcons name="checklist" size={16} color={section === 'tasks' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.sectionBtnText, section === 'tasks' && styles.sectionBtnTextActive]}>Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionBtn, section === 'games' && styles.sectionBtnActive]}
            onPress={() => setSection('games')}
          >
            <MaterialIcons name="casino" size={16} color={section === 'games' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.sectionBtnText, section === 'games' && styles.sectionBtnTextActive]}>Mini Games</Text>
            <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
          </TouchableOpacity>
        </View>

        {section === 'games' ? (
          <View style={styles.gamesContainer}>
            <SpinWheelSection />
            <ScratchCardSection />
          </View>
        ) : (
          <>
            {/* Filter bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBar}
            >
              {filters.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={f.icon as any}
                    size={14}
                    color={filter === f.key ? '#fff' : Colors.textSecondary}
                  />
                  <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tasks List */}
            <View style={styles.tasksList}>
              {filteredTasks.map(task => {
                const completed = isTaskCompleted(task);
                const loading = completingId === task.id;
                const typeColor = TASK_TYPE_COLORS[task.type] || Colors.primary;

                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskCard, completed && styles.taskCardCompleted]}
                    onPress={() => handleTask(task)}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <View style={[styles.taskIcon, { backgroundColor: typeColor + '22' }]}>
                      <MaterialIcons
                        name={TASK_TYPE_ICONS[task.type] as any}
                        size={22}
                        color={typeColor}
                      />
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskTitle, completed && styles.taskTitleDone]}>
                        {task.title}
                      </Text>
                      <Text style={styles.taskDesc}>{task.description}</Text>
                    </View>
                    <View style={styles.taskReward}>
                      {completed ? (
                        <View style={styles.doneIcon}>
                          <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                        </View>
                      ) : (
                        <LinearGradient
                          colors={Colors.gradientPink as [string, string]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.rewardBadge}
                        >
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

// ─── Styles ────────────────────────────────────────────────────────────────────

const wheelStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  cooldownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,184,0,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)',
  },
  cooldownText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  readyBadge: {
    backgroundColor: 'rgba(0,201,126,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,201,126,0.3)',
  },
  readyText: { fontSize: 11, fontWeight: '800', color: Colors.success },
  wheelWrapper: {
    alignItems: 'center',
    marginVertical: Spacing.md,
    position: 'relative',
  },
  pointer: {
    position: 'absolute',
    top: -16,
    zIndex: 10,
  },
  wheel: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    backgroundColor: Colors.surfaceElevated,
  },
  segment: {
    position: 'absolute',
    overflow: 'hidden',
  },
  segmentFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    opacity: 0.85,
    borderTopRightRadius: WHEEL_SIZE / 2,
  },
  segmentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    width: 40,
    textAlign: 'center',
  },
  center: {
    position: 'absolute',
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 20,
  },
  winBadge: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  winGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
  },
  winText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  spinBtn: {
    height: 52,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  spinBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});

const scratchStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  cooldownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,184,0,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)',
  },
  cooldownText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cell: {
    width: (SCREEN_WIDTH - 64 - 32 - 16) / 3,
    height: (SCREEN_WIDTH - 64 - 32 - 16) / 3,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  cellHidden: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellRevealed: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    gap: 4,
  },
  cellValue: { fontSize: FontSize.sm, fontWeight: '800' },
  matchBanner: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  matchGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
  },
  matchText: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    height: 48,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  buyBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.purple },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  balanceText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gold },
  earningsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.2)',
  },
  earningsTitle: { fontSize: FontSize.xs, color: Colors.textSecondary },
  earningsValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gold },
  earningsHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionToggle: {
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
  sectionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  sectionBtnActive: { backgroundColor: Colors.primary },
  sectionBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  sectionBtnTextActive: { color: '#fff' },
  newBadge: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newBadgeText: { fontSize: 8, fontWeight: '800', color: '#000' },
  gamesContainer: { paddingHorizontal: Spacing.md },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },
  tasksList: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: Spacing.sm,
  },
  taskCardCompleted: { opacity: 0.5 },
  taskIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  taskDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  taskReward: { alignItems: 'center' },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  rewardText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  doneIcon: { padding: 4 },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  resetText: { fontSize: 10, color: Colors.textMuted },
});
