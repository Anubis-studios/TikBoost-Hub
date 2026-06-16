import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import * as Linking from 'expo-linking';

type ReferralStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ ref?: string; mode?: string }>();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.mode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [referralCode, setReferralCode] = useState(params.ref ? params.ref.toUpperCase() : '');
  const [referralStatus, setReferralStatus] = useState<ReferralStatus>(params.ref ? 'checking' : 'idle');
  const [loading, setLoading] = useState(false);
  const [inviteBannerShown, setInviteBannerShown] = useState(!!params.ref);
  const { signIn, signUp } = useUser();
  const { showAlert } = useAlert();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const inviteBannerAnim = useRef(new Animated.Value(params.ref ? 0 : 0)).current;

  const animateBanner = useCallback((show: boolean) => {
    Animated.spring(bannerAnim, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 9,
    }).start();
  }, [bannerAnim]);

  // Show invite banner if ref param present
  useEffect(() => {
    if (params.ref) {
      setMode('signup');
      Animated.spring(inviteBannerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
      // Validate the pre-filled referral code
      validateReferralCode(params.ref.toUpperCase());
    }
  }, []);

  // Also listen for deep links while on this screen (in case user taps link from another app)
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      if (parsed.path?.startsWith('ref/') || parsed.queryParams?.ref) {
        const code = (parsed.path?.replace('ref/', '') || parsed.queryParams?.ref as string || '').toUpperCase();
        if (code) {
          setReferralCode(code);
          setMode('signup');
          setInviteBannerShown(true);
          Animated.spring(inviteBannerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
          validateReferralCode(code);
        }
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  const validateReferralCode = useCallback(async (code: string) => {
    if (!code.trim() || code.length < 6) {
      setReferralStatus('idle');
      animateBanner(false);
      return;
    }
    setReferralStatus('checking');
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('referral_code', code.toUpperCase())
        .maybeSingle();
      const isValid = !!data;
      setReferralStatus(isValid ? 'valid' : 'invalid');
      animateBanner(isValid);
    } catch {
      setReferralStatus('invalid');
      animateBanner(false);
    }
  }, [supabase, animateBanner]);

  const handleReferralChange = useCallback((text: string) => {
    const upper = text.toUpperCase();
    setReferralCode(upper);
    setReferralStatus('idle');
    animateBanner(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (upper.length >= 6) {
      debounceTimer.current = setTimeout(() => validateReferralCode(upper), 600);
    }
  }, [validateReferralCode, animateBanner]);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && !tiktokUsername.trim()) {
      showAlert('Missing Fields', 'Please enter your TikTok username.');
      return;
    }
    if (password.length < 6) {
      showAlert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const validCode = referralStatus === 'valid' ? referralCode.trim() : undefined;
        await signUp(email.trim(), password, tiktokUsername.trim(), validCode);
        router.replace({ pathname: '/verify-email', params: { email: email.trim() } });
      } else {
        await signIn(email.trim(), password);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const referralFieldBorderColor = () => {
    if (referralStatus === 'valid') return Colors.success;
    if (referralStatus === 'invalid') return Colors.error;
    return Colors.surfaceBorder;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Invite Banner (from deep link ref) */}
          {inviteBannerShown && (
            <Animated.View style={[styles.inviteBanner, {
              opacity: inviteBannerAnim,
              transform: [{ translateY: inviteBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            }]}>
              <LinearGradient
                colors={['rgba(139,92,246,0.2)', 'rgba(255,45,85,0.1)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.inviteBannerInner}
              >
                <MaterialIcons name="card-giftcard" size={22} color={Colors.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteBannerTitle}>You were invited!</Text>
                  <Text style={styles.inviteBannerSub}>Sign up to claim +150 bonus stars. Code pre-filled below.</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setInviteBannerShown(false);
                  Animated.timing(inviteBannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
                }}>
                  <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Hero */}
          <View style={styles.heroContainer}>
            <Image
              source={require('@/assets/images/onboarding-hero.png')}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={['transparent', Colors.background]}
              style={styles.heroGradient}
            />
          </View>

          {/* Logo & Title */}
          <View style={styles.titleSection}>
            <View style={styles.logoRow}>
              <MaterialIcons name="star" size={28} color={Colors.primary} />
              <Text style={styles.appName}>TikBoost</Text>
              <MaterialIcons name="star" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.tagline}>Earn Stars. Boost Your TikTok.</Text>
            <Text style={styles.subtitle}>Complete tasks, earn stars, and grow your TikTok account organically.</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
                onPress={() => setMode('signin')}
              >
                <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
                onPress={() => setMode('signup')}
              >
                <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Fields */}
            <View style={styles.field}>
              <MaterialIcons name="email" size={20} color={Colors.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.field}>
              <MaterialIcons name="lock" size={20} color={Colors.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password (min 6 chars)"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                accessibilityLabel="Password"
              />
            </View>

            {mode === 'signup' && (
              <View style={styles.field}>
                <MaterialIcons name="alternate-email" size={20} color={Colors.primary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="TikTok username (e.g. @yourname)"
                  placeholderTextColor={Colors.textMuted}
                  value={tiktokUsername}
                  onChangeText={setTiktokUsername}
                  autoCapitalize="none"
                  accessibilityLabel="TikTok username"
                />
              </View>
            )}

            {mode === 'signup' && (
              <>
                <View style={[styles.field, { borderColor: referralFieldBorderColor() }]}>
                  <MaterialIcons
                    name="card-giftcard"
                    size={20}
                    color={
                      referralStatus === 'valid' ? Colors.success :
                      referralStatus === 'invalid' ? Colors.error :
                      Colors.purple
                    }
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Referral code (optional)"
                    placeholderTextColor={Colors.textMuted}
                    value={referralCode}
                    onChangeText={handleReferralChange}
                    autoCapitalize="characters"
                    accessibilityLabel="Referral code"
                  />
                  {referralStatus === 'checking' && (
                    <ActivityIndicator size="small" color={Colors.textMuted} style={{ marginLeft: 8 }} />
                  )}
                  {referralStatus === 'valid' && (
                    <MaterialIcons name="check-circle" size={20} color={Colors.success} style={{ marginLeft: 8 }} />
                  )}
                  {referralStatus === 'invalid' && (
                    <MaterialIcons name="cancel" size={20} color={Colors.error} style={{ marginLeft: 8 }} />
                  )}
                </View>

                {referralStatus === 'invalid' && (
                  <Text style={styles.referralError}>
                    Code not found. Check the code and try again.
                  </Text>
                )}

                {/* Animated referral bonus banner */}
                <Animated.View
                  style={[
                    styles.referralBonusBanner,
                    {
                      opacity: bannerAnim,
                      transform: [{
                        translateY: bannerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      }, {
                        scaleY: bannerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['rgba(0,209,126,0.15)', 'rgba(0,209,126,0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.referralBonusInner}
                  >
                    <MaterialIcons name="celebration" size={18} color={Colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.referralBonusTitle}>+150 Bonus Stars Will Be Applied!</Text>
                      <Text style={styles.referralBonusSub}>Valid referral code — both you and your friend get rewarded.</Text>
                    </View>
                    <MaterialIcons name="star" size={16} color={Colors.gold} />
                  </LinearGradient>
                </Animated.View>
              </>
            )}

            {mode === 'signup' && (
              <View style={styles.bonusBanner}>
                <MaterialIcons name="star" size={16} color={Colors.gold} />
                <Text style={styles.bonusText}>Get 200 welcome stars when you sign up!</Text>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={Colors.gradientPink as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaBtnText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.hint}>
              {mode === 'signin'
                ? "Don't have an account? Tap Sign Up above."
                : 'Already have an account? Tap Sign In above.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  inviteBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  inviteBannerInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm,
  },
  inviteBannerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.purple },
  inviteBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  heroContainer: { height: 240, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  titleSection: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  appName: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.primary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.full },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  modeBtnTextActive: { color: '#fff' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
  },
  fieldIcon: { marginRight: Spacing.sm },
  input: { flex: 1, height: 50, color: Colors.textPrimary, fontSize: FontSize.md },
  referralError: {
    fontSize: FontSize.xs, color: Colors.error,
    marginTop: -Spacing.sm, marginBottom: Spacing.sm, marginLeft: 4,
  },
  referralBonusBanner: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,209,126,0.3)',
  },
  referralBonusInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, gap: Spacing.sm,
  },
  referralBonusTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  referralBonusSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  bonusBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  bonusText: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: '500' },
  ctaBtn: {
    height: 52, borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  ctaBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
