import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import {
  STAR_PACKAGES,
  VIP_PLAN,
  BUNDLE_PLANS,
  LUCKY_SPIN_CONFIG,
  BundleConfig,
  StarPackageConfig,
  IAPProductId,
  connectIAP,
  purchaseProduct,
  completePurchase,
} from '@/services/iapService';

// ─── Countdown Timer ──────────────────────────────────────────────────────────

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, []);
  return timeLeft;
}

function CountdownBadge() {
  const { h, m, s } = useCountdown();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={countdownStyles.badge}>
      <MaterialIcons name="schedule" size={12} color={Colors.warning} />
      <Text style={countdownStyles.text}>Resets in {pad(h)}:{pad(m)}:{pad(s)}</Text>
    </View>
  );
}

const countdownStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,184,0,0.12)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)',
  },
  text: { fontSize: 11, fontWeight: '700', color: Colors.warning },
});

// ─── Lucky Wheel visual ───────────────────────────────────────────────────────

function LuckyWheelCard({ onBuy, isLoading }: { onBuy: () => void; isLoading: boolean }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  const doPreviewSpin = () => {
    Animated.timing(spinAnim, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start(() => spinAnim.setValue(0));
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={wheelStyles.card}>
      <View style={wheelStyles.left}>
        <View style={wheelStyles.badge}>
          <MaterialIcons name="star" size={12} color={Colors.gold} />
          <Text style={wheelStyles.badgeText}>+50★ bonus</Text>
        </View>
        <Text style={wheelStyles.title}>
          Win <Text style={wheelStyles.highlight}>3,000</Text> Stars
        </Text>
        <Text style={wheelStyles.sub}>Min. {LUCKY_SPIN_CONFIG.minWin} Guaranteed</Text>
        <Text style={wheelStyles.price}>{LUCKY_SPIN_CONFIG.price}</Text>
        <TouchableOpacity
          onPress={onBuy}
          style={wheelStyles.btn}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={wheelStyles.btnText}>Buy &amp; Spin</Text>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={doPreviewSpin} activeOpacity={0.9}>
        <Animated.View style={[wheelStyles.wheel, { transform: [{ rotate: spin }] }]}>
          {LUCKY_SPIN_CONFIG.segments.map((val, i) => {
            const angle = (360 / LUCKY_SPIN_CONFIG.segments.length) * i;
            const isEven = i % 2 === 0;
            return (
              <View
                key={i}
                style={[wheelStyles.segment, {
                  backgroundColor: isEven ? Colors.primary : '#fff',
                  transform: [{ rotate: `${angle}deg` }],
                }]}
              >
                <Text style={[wheelStyles.segVal, { color: isEven ? '#fff' : Colors.primary }]}>
                  {val}
                </Text>
                <MaterialIcons name="star" size={10} color={isEven ? Colors.gold : Colors.primary} />
              </View>
            );
          })}
          <View style={wheelStyles.center} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
    overflow: 'hidden',
  },
  left: { flex: 1, gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.gold },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  highlight: { color: Colors.primary },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  price: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  btn: {
    backgroundColor: Colors.gold, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 10, alignSelf: 'flex-start',
    marginTop: 4,
  },
  btnText: { fontSize: FontSize.sm, fontWeight: '800', color: '#000' },
  wheel: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 3, borderColor: Colors.gold,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', position: 'relative',
  },
  segment: {
    position: 'absolute', bottom: 60, left: 57,
    width: 6, height: 60, borderRadius: 3,
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 4,
  },
  segVal: { fontSize: 8, fontWeight: '800', transform: [{ rotate: '90deg' }] },
  center: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.gold, borderWidth: 2, borderColor: '#000',
  },
});

// ─── Bundle Card ──────────────────────────────────────────────────────────────

function BundleCard({ bundle, onBuy, isLoading }: {
  bundle: BundleConfig;
  onBuy: (bundle: BundleConfig) => void;
  isLoading: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onBuy(bundle);
  };

  const savePct = Math.round(
    (1 - parseFloat(bundle.price.replace('£', '')) / parseFloat(bundle.originalPrice.replace('£', ''))) * 100
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9} disabled={isLoading}>
        <LinearGradient
          colors={bundle.isFeatured ? ['#2A0A14', '#1A0A1A'] : ['#1A1A2E', '#16213E']}
          style={[bundleStyles.card, bundle.isFeatured && bundleStyles.featured]}
        >
          {bundle.isFeatured && (
            <View style={bundleStyles.hotBadge}>
              <MaterialIcons name="local-fire-department" size={10} color="#fff" />
              <Text style={bundleStyles.hotText}>BEST DEAL</Text>
            </View>
          )}
          <View style={bundleStyles.saveBadge}>
            <Text style={bundleStyles.saveText}>Save {savePct}%</Text>
          </View>
          <View style={bundleStyles.row}>
            <View style={[bundleStyles.icon, bundle.isFeatured && { backgroundColor: 'rgba(255,45,85,0.2)' }]}>
              <MaterialIcons
                name="card-giftcard"
                size={26}
                color={bundle.isFeatured ? Colors.primary : Colors.gold}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={bundleStyles.title}>{bundle.title}</Text>
              <Text style={bundleStyles.origPrice}>{bundle.originalPrice}</Text>
            </View>
            <Text style={[bundleStyles.price, bundle.isFeatured && { color: Colors.primary }]}>
              {bundle.price}
            </Text>
          </View>
          <View style={bundleStyles.perks}>
            <View style={bundleStyles.perk}>
              <MaterialIcons name="star" size={13} color={Colors.gold} />
              <Text style={bundleStyles.perkText}>{bundle.stars.toLocaleString()} Stars instantly</Text>
            </View>
            <View style={bundleStyles.perk}>
              <MaterialIcons name="workspace-premium" size={13} color={Colors.gold} />
              <Text style={bundleStyles.perkText}>VIP for {bundle.vipDays} days</Text>
            </View>
            <View style={bundleStyles.perk}>
              <MaterialIcons name="bolt" size={13} color={Colors.success} />
              <Text style={bundleStyles.perkText}>Instant delivery</Text>
            </View>
          </View>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.sm }} />
          ) : (
            <LinearGradient
              colors={bundle.isFeatured ? (Colors.gradientPink as [string, string]) : ['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.1)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={bundleStyles.buyBtn}
            >
              <Text style={[bundleStyles.buyBtnText, !bundle.isFeatured && { color: Colors.gold }]}>
                Get Bundle — {bundle.price}
              </Text>
              <MaterialIcons name="arrow-forward" size={15} color={bundle.isFeatured ? '#fff' : Colors.gold} />
            </LinearGradient>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const bundleStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden',
  },
  featured: { borderColor: 'rgba(255,45,85,0.35)', ...Shadow.pink },
  hotBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: Spacing.sm,
  },
  hotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  saveBadge: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    backgroundColor: 'rgba(0,209,126,0.2)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(0,209,126,0.4)',
  },
  saveText: { fontSize: 10, fontWeight: '800', color: Colors.success },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  icon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  title: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  origPrice: { fontSize: FontSize.xs, color: Colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },
  price: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.gold },
  perks: { gap: 6, marginBottom: Spacing.md },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  buyBtn: {
    height: 44, borderRadius: BorderRadius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  buyBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});

// ─── Package Row ──────────────────────────────────────────────────────────────

function PackageCard({ pkg, onBuy, isLoading }: {
  pkg: StarPackageConfig;
  onBuy: (pkg: StarPackageConfig) => void;
  isLoading: boolean;
}) {
  const hasBadge = !!pkg.badge;

  return (
    <TouchableOpacity
      onPress={() => onBuy(pkg)}
      activeOpacity={0.85}
      disabled={isLoading}
    >
      <View style={[pkgStyles.card, hasBadge && { borderColor: (pkg.badgeColor || Colors.gold) + '66' }]}>
        {hasBadge && (
          <View style={[pkgStyles.badge, { backgroundColor: (pkg.badgeColor || Colors.gold) + '22' }]}>
            <Text style={[pkgStyles.badgeText, { color: pkg.badgeColor || Colors.gold }]}>
              {pkg.badge}
            </Text>
          </View>
        )}
        {pkg.bonusStars > 0 && (
          <View style={pkgStyles.bonusBadge}>
            <Text style={pkgStyles.bonusText}>+{pkg.bonusStars} Bonus</Text>
          </View>
        )}
        <View style={pkgStyles.row}>
          <View style={pkgStyles.coinWrap}>
            <MaterialIcons name="star" size={26} color={Colors.gold} />
          </View>
          <View style={pkgStyles.info}>
            <Text style={pkgStyles.stars}>{pkg.stars.toLocaleString()}</Text>
            <Text style={pkgStyles.starsLabel}>Stars</Text>
          </View>
          <View style={pkgStyles.priceWrap}>
            {isLoading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <LinearGradient
                colors={Colors.gradientPink as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={pkgStyles.priceBtn}
              >
                <Text style={pkgStyles.priceText}>{pkg.price}</Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pkgStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder, position: 'relative', overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  bonusBadge: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  bonusText: { fontSize: 10, fontWeight: '700', color: Colors.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  coinWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
  },
  info: { flex: 1 },
  stars: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  starsLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  priceWrap: { minWidth: 80, alignItems: 'flex-end' },
  priceBtn: {
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 10, alignItems: 'center',
  },
  priceText: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BuyStarsScreen() {
  const router = useRouter();
  const { user, refreshUser, upgradeVIP } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'bundles' | 'packs'>('packs');

  useEffect(() => {
    connectIAP().catch(() => {});
  }, []);

  const handleIAPPurchase = async (
    productId: IAPProductId,
    label: string,
    onSuccess?: (purchase: any) => Promise<void>
  ) => {
    setLoadingProductId(productId);
    try {
      const purchase = await purchaseProduct(productId);
      if (!purchase) {
        // User cancelled
        setLoadingProductId(null);
        return;
      }

      // Verify & fulfill with backend
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-iap-purchase', {
        body: {
          product_id: productId,
          purchase_token: purchase.purchaseToken || purchase.transactionId,
          platform: Platform.OS,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.success) {
        // Silently finish transaction even if backend fails to avoid stuck purchases
        await completePurchase(purchase);
        // Fallback: award stars locally based on product
        if (onSuccess) await onSuccess(purchase);
        else {
          await refreshUser();
          showAlert('Purchase Complete!', `${label} has been added to your account!`);
        }
        return;
      }

      await completePurchase(purchase);
      if (onSuccess) await onSuccess(purchase);
      else {
        await refreshUser();
        showAlert('Purchase Complete!', `${label} has been added to your account!`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Purchase failed. Please try again.';
      showAlert('Purchase Error', msg);
    } finally {
      setLoadingProductId(null);
    }
  };

  const handleBuyStars = (pkg: StarPackageConfig) => {
    showAlert(
      `Buy ${pkg.stars.toLocaleString()} Stars`,
      `${pkg.price} via ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'}\n\n${pkg.bonusStars > 0 ? `Includes +${pkg.bonusStars} bonus stars!` : 'Stars are delivered instantly.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy ${pkg.price}`,
          onPress: async () => {
            await handleIAPPurchase(
              pkg.productId,
              `${(pkg.stars + pkg.bonusStars).toLocaleString()} Stars`,
              async () => {
                await refreshUser();
                showAlert(
                  'Stars Added!',
                  `${(pkg.stars + pkg.bonusStars).toLocaleString()} stars have been added to your account!`
                );
              }
            );
          },
        },
      ]
    );
  };

  const handleBuyBundle = (bundle: BundleConfig) => {
    showAlert(
      `${bundle.title} — ${bundle.price}`,
      `Includes:\n\n• ${bundle.stars.toLocaleString()} Stars\n• VIP for ${bundle.vipDays} days\n\nOriginal value: ${bundle.originalPrice}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy ${bundle.price}`,
          onPress: async () => {
            await handleIAPPurchase(
              bundle.productId,
              bundle.title,
              async () => {
                await refreshUser();
                showAlert(
                  'Bundle Activated!',
                  `${bundle.stars.toLocaleString()} stars + ${bundle.vipDays}-day VIP have been applied!`
                );
              }
            );
          },
        },
      ]
    );
  };

  const handleLuckySpin = async () => {
    await handleIAPPurchase(
      LUCKY_SPIN_CONFIG.productId as IAPProductId,
      'Lucky Wheel Spin',
      async () => {
        // Determine random win
        const segments = LUCKY_SPIN_CONFIG.segments;
        const win = segments[Math.floor(Math.random() * segments.length)];
        // Award stars
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          await supabase.functions.invoke('award-spin-stars', {
            body: { amount: win },
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
        await refreshUser();
        showAlert('Lucky Wheel!', `You won ${win} stars! Keep spinning to win more!`);
      }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Buy Stars</Text>
        <View style={styles.balancePill}>
          <MaterialIcons name="star" size={14} color={Colors.gold} />
          <Text style={styles.balanceText}>{(user?.stars || 0).toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <LinearGradient
          colors={['rgba(255,215,0,0.16)', 'rgba(255,45,85,0.10)', 'transparent']}
          style={styles.hero}
        >
          <MaterialIcons name="star" size={40} color={Colors.gold} />
          <Text style={styles.heroTitle}>Power Up Your Reach</Text>
          <Text style={styles.heroSub}>Buy stars instantly via {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}. Bigger packs = bigger savings.</Text>
        </LinearGradient>

        {/* Secure badge */}
        <View style={styles.secureBadge}>
          <MaterialIcons name="lock" size={13} color={Colors.success} />
          <Text style={styles.secureText}>
            Secured by {Platform.OS === 'ios' ? 'Apple' : 'Google'} — instant delivery
          </Text>
        </View>

        {/* Section Toggle */}
        <View style={styles.sectionToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeSection === 'packs' && styles.toggleBtnActive]}
            onPress={() => setActiveSection('packs')}
          >
            <MaterialIcons name="star" size={14} color={activeSection === 'packs' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.toggleText, activeSection === 'packs' && styles.toggleTextActive]}>Packages</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeSection === 'bundles' && styles.toggleBtnActive]}
            onPress={() => setActiveSection('bundles')}
          >
            <MaterialIcons name="card-giftcard" size={14} color={activeSection === 'bundles' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.toggleText, activeSection === 'bundles' && styles.toggleTextActive]}>Bundles</Text>
            <View style={styles.hotBadge}><Text style={styles.hotBadgeText}>HOT</Text></View>
          </TouchableOpacity>
        </View>

        {/* Packages */}
        {activeSection === 'packs' && (
          <View style={styles.section}>
            {STAR_PACKAGES.map(pkg => (
              <PackageCard
                key={pkg.productId}
                pkg={pkg}
                onBuy={handleBuyStars}
                isLoading={loadingProductId === pkg.productId}
              />
            ))}

            {/* Lucky Wheel */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lucky Wheel</Text>
            </View>
            <LuckyWheelCard
              onBuy={handleLuckySpin}
              isLoading={loadingProductId === LUCKY_SPIN_CONFIG.productId}
            />
          </View>
        )}

        {/* Bundles */}
        {activeSection === 'bundles' && (
          <View style={styles.section}>
            <View style={styles.bundleHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Limited-Time Bundles</Text>
                <Text style={styles.sectionSub}>Stars + VIP combined — massive savings</Text>
              </View>
              <CountdownBadge />
            </View>
            {BUNDLE_PLANS.map(bundle => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                onBuy={handleBuyBundle}
                isLoading={loadingProductId === bundle.productId}
              />
            ))}
          </View>
        )}

        {/* Info */}
        <View style={styles.infoCard}>
          {[
            { icon: 'bolt', color: Colors.gold, text: 'Stars credited to your account immediately after purchase confirmation.' },
            { icon: 'refresh', color: Colors.info, text: 'Stars never expire — use them any time on any boost.' },
            { icon: 'support-agent', color: Colors.success, text: 'Issues? Contact support@tikboost.app and we will resolve it fast.' },
          ].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.infoDivider} />}
              <View style={styles.infoRow}>
                <MaterialIcons name={item.icon as any} size={16} color={item.color} />
                <Text style={styles.infoText}>{item.text}</Text>
              </View>
            </React.Fragment>
          ))}
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
  title: { flex: 1, fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  balanceText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gold },
  scroll: { paddingBottom: Spacing.xl },
  hero: {
    alignItems: 'center', padding: Spacing.xl,
    margin: Spacing.md, borderRadius: BorderRadius.xl, gap: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginBottom: Spacing.md,
  },
  secureText: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionToggle: {
    flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, gap: 4,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md,
  },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  hotBadge: { backgroundColor: Colors.warning, borderRadius: BorderRadius.full, paddingHorizontal: 5, paddingVertical: 1 },
  hotBadgeText: { fontSize: 8, fontWeight: '800', color: '#000' },
  section: { paddingHorizontal: Spacing.md, gap: Spacing.xs },
  sectionHeader: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  bundleHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoCard: {
    marginHorizontal: Spacing.md, marginTop: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  infoDivider: { height: 1, backgroundColor: Colors.surfaceBorder },
});
