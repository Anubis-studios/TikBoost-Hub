import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const supabase = getSupabaseClient();
  const { showAlert } = useAlert();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown timer
  useEffect(() => {
    // Start with an initial cooldown so resend isn't immediately available
    startCooldown();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const shakeInputs = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const playSuccessAnimation = useCallback(() => {
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleVerify = useCallback(async (code: string) => {
    if (code.length < OTP_LENGTH) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email!,
        token: code,
        type: 'signup',
      });

      if (error) {
        shakeInputs();
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        showAlert('Invalid Code', error.message || 'The code you entered is incorrect. Please try again.');
        return;
      }

      setVerified(true);
      playSuccessAnimation();
      setTimeout(() => router.replace('/(tabs)'), 1400);
    } catch (err: any) {
      shakeInputs();
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      showAlert('Verification Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setVerifying(false);
    }
  }, [email, supabase, shakeInputs, playSuccessAnimation, router, showAlert]);

  const handleOtpChange = useCallback((value: string, index: number) => {
    // Only accept digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    const full = newOtp.join('');
    if (full.length === OTP_LENGTH && !newOtp.includes('')) {
      handleVerify(full);
    }
  }, [otp, handleVerify]);

  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  }, [otp]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending || !email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      startCooldown();
      showAlert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (err: any) {
      showAlert('Send Failed', err.message || 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  }, [cooldown, resending, email, supabase, startCooldown, showAlert]);

  const filledCount = otp.filter(Boolean).length;
  const isComplete = filledCount === OTP_LENGTH;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/auth');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={['rgba(255,45,85,0.22)', 'rgba(255,45,85,0.06)']}
              style={styles.iconGrad}
            >
              <MaterialIcons name="mark-email-unread" size={48} color={Colors.primary} />
            </LinearGradient>

            {/* Success overlay */}
            <Animated.View
              style={[
                styles.successOverlay,
                { opacity: successOpacity, transform: [{ scale: successScale }] },
              ]}
              pointerEvents="none"
            >
              <LinearGradient colors={['#00C97A', '#00A064']} style={styles.successCircle}>
                <MaterialIcons name="check" size={32} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </View>

          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.emailLabel}>{email}</Text>
          <Text style={styles.body}>
            Enter the {OTP_LENGTH}-digit verification code we sent to your email address.
          </Text>

          {/* OTP Inputs */}
          <Animated.View
            style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                  i === filledCount && !verified ? styles.otpInputFocused : null,
                  verified ? styles.otpInputVerified : null,
                ]}
                value={digit}
                onChangeText={(v) => handleOtpChange(v, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
                selectionColor={Colors.primary}
                editable={!verifying && !verified}
                accessibilityLabel={`OTP digit ${i + 1}`}
                autoFocus={i === 0}
              />
            ))}
          </Animated.View>

          {/* Verify button */}
          <TouchableOpacity
            onPress={() => handleVerify(otp.join(''))}
            disabled={!isComplete || verifying || verified}
            activeOpacity={0.85}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={
                isComplete && !verifying && !verified
                  ? (Colors.gradientPink as [string, string])
                  : ['#2A2A2A', '#222222']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.verifyBtn, (!isComplete || verifying || verified) && styles.verifyBtnDisabled]}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : verified ? (
                <>
                  <MaterialIcons name="check-circle" size={18} color="#fff" />
                  <Text style={styles.verifyBtnText}>Verified!</Text>
                </>
              ) : (
                <Text style={[styles.verifyBtnText, !isComplete && { color: Colors.textMuted }]}>
                  Verify Code
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive a code?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {resending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : cooldown > 0 ? (
                <Text style={styles.resendCooldown}>Resend in {cooldown}s</Text>
              ) : (
                <Text style={styles.resendLink}>Resend Code</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            {[
              { icon: 'inbox' as const, text: 'Check your spam or junk folder if not received' },
              { icon: 'timer' as const, text: 'Code expires in 60 minutes' },
              { icon: 'auto-awesome' as const, text: 'Enter the code and we will sign you in automatically' },
            ].map(({ icon, text }) => (
              <View key={text} style={styles.tipRow}>
                <MaterialIcons name={icon} size={14} color={Colors.primary} />
                <Text style={styles.tipText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backBtn: {
    margin: Spacing.md,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  iconWrap: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  iconGrad: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.25)',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emailLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: -Spacing.sm,
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  otpInput: {
    width: 64,
    height: 72,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255,45,85,0.07)',
  },
  otpInputFocused: {
    borderColor: Colors.primary,
    borderStyle: 'solid',
  },
  otpInputVerified: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(0,201,122,0.1)',
  },
  verifyBtn: {
    height: 54,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  verifyBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resendLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  resendCooldown: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginTop: Spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
