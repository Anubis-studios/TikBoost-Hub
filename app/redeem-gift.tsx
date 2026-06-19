import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Clipboard as RNClipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import { earnStars } from '@/services/supabaseService';

export default function RedeemGiftScreen() {
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [wonStars, setWonStars] = useState(0);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const animateSuccess = () => {
    Animated.spring(successAnim, {
      toValue: 1, useNativeDriver: true, tension: 80, friction: 8,
    }).start();
  };

  const handlePaste = async () => {
    try {
      const text = await RNClipboard.getString();
      if (text) setCode(text.trim().toUpperCase());
    } catch {}
  };

  const handleRedeem = async () => {
    if (!user) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      showAlert('Enter Code', 'Please enter a gift code.');
      shake();
      return;
    }

    setLoading(true);
    try {
      // Look up the code
      const { data: codeData, error: codeError } = await supabase
        .from('gift_codes')
        .select('*')
        .eq('code', trimmed)
        .eq('is_active', true)
        .single();

      if (codeError || !codeData) {
        shake();
        showAlert('Invalid Code', 'This gift code is invalid or has expired.');
        return;
      }

      // Check if expired
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        shake();
        showAlert('Expired Code', 'This gift code has expired.');
        return;
      }

      // Check max uses
      if (codeData.used_count >= codeData.max_uses) {
        shake();
        showAlert('Code Used Up', 'This gift code has reached its maximum number of uses.');
        return;
      }

      // Check if already redeemed by this user
      const { data: existing } = await supabase
        .from('gift_code_redemptions')
        .select('id')
        .eq('code_id', codeData.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        shake();
        showAlert('Already Redeemed', 'You have already redeemed this gift code.');
        return;
      }

      // Record redemption
      const { error: redeemError } = await supabase
        .from('gift_code_redemptions')
        .insert({ code_id: codeData.id, user_id: user.id });

      if (redeemError) {
        shake();
        showAlert('Error', 'Could not redeem code. Please try again.');
        return;
      }

      // Increment used count
      await supabase
        .from('gift_codes')
        .update({ used_count: (codeData.used_count || 0) + 1 })
        .eq('id', codeData.id);

      // Award stars
      await earnStars(user.id, codeData.stars, `Gift code redeemed: ${trimmed}`, 'gift');

      setWonStars(codeData.stars);
      setRedeemed(true);
      animateSuccess();
      await refreshUser();
    } catch (err: any) {
      shake();
      showAlert('Error', err.message || 'Could not redeem code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (redeemed) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Redeem Code</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.successContainer}>
          <Animated.View style={[styles.successIconWrap, {
            transform: [{ scale: successAnim }],
          }]}>
            <LinearGradient colors={Colors.gradientGold as [string, string]} style={styles.successIcon}>
              <MaterialIcons name="card-giftcard" size={56} color="#000" />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.successTitle}>Congratulations!</Text>
          <Text style={styles.successSub}>You successfully redeemed your gift code</Text>

          <View style={styles.wonCard}>
            <MaterialIcons name="star" size={32} color={Colors.gold} />
            <Text style={styles.wonAmount}>+{wonStars.toLocaleString()}</Text>
            <Text style={styles.wonLabel}>Stars Added</Text>
          </View>

          <TouchableOpacity
            onPress={() => { setRedeemed(false); setCode(''); setWonStars(0); successAnim.setValue(0); }}
            style={styles.redeemAnotherBtn}
          >
            <Text style={styles.redeemAnotherText}>Redeem Another Code</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>Back to Profile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Redeem Gift Code</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.heroIcon}>
            <LinearGradient colors={['rgba(255,45,85,0.15)', 'transparent']} style={styles.heroGlow} />
            <MaterialIcons name="card-giftcard" size={72} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>Get Free Stars</Text>
          <Text style={styles.desc}>Enter your gift code to claim free stars instantly.</Text>

          {/* Code Input */}
          <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
            <View style={styles.inputField}>
              <MaterialIcons name="card-giftcard" size={20} color={Colors.textSecondary} />
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={t => setCode(t.toUpperCase())}
                placeholder="Enter Gift Code"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Gift code input"
                maxLength={20}
              />
              <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn}>
                <Text style={styles.pasteBtnText}>Paste</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Redeem Button */}
          <TouchableOpacity onPress={handleRedeem} disabled={loading} activeOpacity={0.85}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.redeemBtn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="redeem" size={20} color="#fff" />
                  <Text style={styles.redeemBtnText}>Redeem Now</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name="info-outline" size={16} color={Colors.info} />
              <Text style={styles.infoText}>Each gift code can only be redeemed once per account.</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <MaterialIcons name="schedule" size={16} color={Colors.warning} />
              <Text style={styles.infoText}>Some codes may have expiry dates or limited uses.</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <MaterialIcons name="star" size={16} color={Colors.gold} />
              <Text style={styles.infoText}>Stars are credited to your account immediately.</Text>
            </View>
          </View>

          {/* Sample codes hint */}
          <View style={styles.sampleCard}>
            <Text style={styles.sampleTitle}>Try a Sample Code</Text>
            <View style={styles.sampleCodes}>
              {['WELCOME50', 'BOOST100'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={styles.sampleChip}
                  onPress={() => setCode(c)}
                >
                  <Text style={styles.sampleCode}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  content: { flex: 1, paddingHorizontal: Spacing.md, alignItems: 'center', paddingTop: Spacing.lg },
  heroIcon: {
    alignItems: 'center', justifyContent: 'center',
    width: 120, height: 120, marginBottom: Spacing.md, position: 'relative',
  },
  heroGlow: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
  },
  heading: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  inputWrapper: { width: '100%', marginBottom: Spacing.md },
  inputField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, height: 56,
  },
  inputDivider: { width: 1, height: 24, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700', letterSpacing: 2 },
  pasteBtn: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  pasteBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  redeemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    width: 320, height: 56, borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  redeemBtnText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  infoCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, width: '100%', borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 6 },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  infoDivider: { height: 1, backgroundColor: Colors.surfaceBorder },
  sampleCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, width: '100%', borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  sampleTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm },
  sampleCodes: { flexDirection: 'row', gap: Spacing.sm },
  sampleChip: {
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  sampleCode: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gold, letterSpacing: 1 },

  // Success state
  successContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  successIconWrap: { marginBottom: Spacing.lg },
  successIcon: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center',
  },
  successTitle: {
    fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  successSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl, textAlign: 'center' },
  wonCard: {
    alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: BorderRadius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    marginBottom: Spacing.xl, width: '100%',
  },
  wonAmount: { fontSize: 48, fontWeight: '900', color: Colors.gold },
  wonLabel: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },
  redeemAnotherBtn: { marginBottom: Spacing.md },
  redeemAnotherText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: 280, height: 52, borderRadius: BorderRadius.full,
  },
  doneBtnText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
});
