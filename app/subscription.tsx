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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import { connectIAP, purchaseProduct, completePurchase, IAPProductId } from '@/services/iapService';

// ─── IAP Product IDs for subscriptions ────────────────────────────────────────
const SUB_PRODUCT_IDS: Record<string, IAPProductId> = {
  pro:   'com.tikboost.vip.30days' as IAPProductId,   // reuse VIP product for Pro
  elite: 'com.tikboost.bundle.viral' as IAPProductId, // Elite maps to Viral bundle
};

// ─── Subscription Plan ────────────────────────────────────────────────────────
interface SubPlan {
  id: string;
  name: string;
  price_monthly: number;
  stars_monthly: number;
  boost_multiplier: number;
  star_multiplier: number;
  features: string[];
  color: string;
}

const FALLBACK_PLANS: SubPlan[] = [
  {
    id: 'free', name: 'Free', price_monthly: 0,
    stars_monthly: 0, boost_multiplier: 1.0, star_multiplier: 1.0,
    features: ['Basic task earning', '1 free spin per week', 'Standard boost packages', 'Community access'],
    color: '#A0A0A0',
  },
  {
    id: 'pro', name: 'Pro', price_monthly: 7.49,
    stars_monthly: 500, boost_multiplier: 1.5, star_multiplier: 1.5,
    features: ['1.5x star earning on all tasks', '500 bonus stars/month', 'Priority boost placement', 'Exclusive Pro badge', 'Advanced analytics', 'Unlock Pro boost packages'],
    color: '#0A84FF',
  },
  {
    id: 'elite', name: 'Elite', price_monthly: 14.99,
    stars_monthly: 1500, boost_multiplier: 2.0, star_multiplier: 2.0,
    features: ['2x star earning on all tasks', '1,500 bonus stars/month', 'Priority boost placement', 'Exclusive Elite badge', 'Advanced analytics', 'Unlock all boost packages', 'Early access to features', 'Dedicated support'],
    color: '#FFD700',
  },
];

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isActive,
  isCurrent,
  onSelect,
  loading,
}: {
  plan: SubPlan;
  isActive: boolean;
  isCurrent: boolean;
  onSelect: (plan: SubPlan) => void;
  loading: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isElite = plan.id === 'elite';
  const isFree = plan.id === 'free';

  const handlePress = () => {
    if (isFree || isCurrent) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onSelect(plan);
  };

  const bgColors: [string, string] = isElite
    ? ['#1A1400', '#0D0D0D']
    : plan.id === 'pro'
    ? ['#001428', '#0D0D0D']
    : ['#1A1A1A', '#0D0D0D'];

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, planStyles.wrapper]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={isFree || isCurrent ? 1 : 0.9}
        disabled={isFree || isCurrent || loading}
      >
        <LinearGradient
          colors={bgColors}
          style={[
            planStyles.card,
            isActive && { borderColor: plan.color + '88', ...Shadow.medium },
            isElite && { borderColor: Colors.gold + '66' },
          ]}
        >
          {/* Popular badge */}
          {plan.id === 'pro' && !isCurrent && (
            <View style={planStyles.popularBadge}>
              <Text style={planStyles.popularText}>MOST POPULAR</Text>
            </View>
          )}
          {isElite && !isCurrent && (
            <View style={[planStyles.popularBadge, { backgroundColor: Colors.gold }]}>
              <Text style={[planStyles.popularText, { color: '#000' }]}>BEST VALUE</Text>
            </View>
          )}

          {/* Header */}
          <View style={planStyles.header}>
            <View style={[planStyles.iconWrap, { backgroundColor: plan.color + '22', borderColor: plan.color + '44' }]}>
              <MaterialIcons
                name={isElite ? 'workspace-premium' : plan.id === 'pro' ? 'stars' : 'star-outline'}
                size={26}
                color={plan.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[planStyles.planName, { color: plan.color }]}>{plan.name}</Text>
              {isCurrent && (
                <View style={planStyles.currentBadge}>
                  <MaterialIcons name="check-circle" size={11} color={Colors.success} />
                  <Text style={planStyles.currentBadgeText}>Current Plan</Text>
                </View>
              )}
            </View>
            <View style={planStyles.priceWrap}>
              {isFree ? (
                <Text style={[planStyles.price, { color: plan.color }]}>FREE</Text>
              ) : (
                <>
                  <Text style={[planStyles.price, { color: plan.color }]}>£{plan.price_monthly.toFixed(2)}</Text>
                  <Text style={planStyles.priceSub}>/month</Text>
                </>
              )}
            </View>
          </View>

          {/* Multipliers */}
          {!isFree && (
            <View style={planStyles.multipliersRow}>
              <View style={[planStyles.multiplierChip, { backgroundColor: Colors.gold + '20' }]}>
                <MaterialIcons name="star" size={12} color={Colors.gold} />
                <Text style={[planStyles.multiplierText, { color: Colors.gold }]}>
                  {plan.star_multiplier}x Stars
                </Text>
              </View>
              <View style={[planStyles.multiplierChip, { backgroundColor: plan.color + '20' }]}>
                <MaterialIcons name="rocket-launch" size={12} color={plan.color} />
                <Text style={[planStyles.multiplierText, { color: plan.color }]}>
                  {plan.boost_multiplier}x Boost Power
                </Text>
              </View>
              {plan.stars_monthly > 0 && (
                <View style={[planStyles.multiplierChip, { backgroundColor: Colors.success + '20' }]}>
                  <MaterialIcons name="add-circle" size={12} color={Colors.success} />
                  <Text style={[planStyles.multiplierText, { color: Colors.success }]}>
                    +{plan.stars_monthly} ★/mo
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Features */}
          <View style={planStyles.features}>
            {plan.features.map((f, i) => (
              <View key={i} style={planStyles.featureRow}>
                <MaterialIcons
                  name="check-circle"
                  size={14}
                  color={isFree ? Colors.textMuted : plan.color}
                />
                <Text style={[planStyles.featureText, isFree && { color: Colors.textMuted }]}>{f}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          {!isFree && !isCurrent && (
            loading ? (
              <ActivityIndicator color={plan.color} style={{ marginTop: Spacing.md }} />
            ) : (
              <LinearGradient
                colors={isElite
                  ? ['rgba(255,215,0,0.3)', 'rgba(255,215,0,0.15)']
                  : (Colors.gradientPink as [string, string])}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={planStyles.ctaBtn}
              >
                <Text style={[planStyles.ctaText, isElite && { color: Colors.gold }]}>
                  Subscribe — £{plan.price_monthly.toFixed(2)}/mo
                </Text>
                <MaterialIcons
                  name="arrow-forward"
                  size={15}
                  color={isElite ? Colors.gold : '#fff'}
                />
              </LinearGradient>
            )
          )}

          {isCurrent && !isFree && (
            <View style={[planStyles.ctaBtn, { backgroundColor: plan.color + '22' }]}>
              <MaterialIcons name="check-circle" size={16} color={plan.color} />
              <Text style={[planStyles.ctaText, { color: plan.color }]}>Active Subscription</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const planStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  card: {
    borderRadius: BorderRadius.xl, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    position: 'relative', overflow: 'hidden',
  },
  popularBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: Spacing.sm,
  },
  popularText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  iconWrap: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  planName: { fontSize: FontSize.lg, fontWeight: '800' },
  currentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
    backgroundColor: 'rgba(0,209,126,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start',
  },
  currentBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: FontSize.xxl, fontWeight: '900' },
  priceSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  multipliersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  multiplierChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  multiplierText: { fontSize: 11, fontWeight: '700' },
  features: { gap: 8, marginBottom: Spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  ctaBtn: {
    height: 48, borderRadius: BorderRadius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonRow({ label, free, pro, elite }: { label: string; free: string; pro: string; elite: string }) {
  return (
    <View style={compStyles.row}>
      <Text style={compStyles.label}>{label}</Text>
      <Text style={compStyles.free}>{free}</Text>
      <Text style={compStyles.pro}>{pro}</Text>
      <Text style={[compStyles.elite, { color: Colors.gold }]}>{elite}</Text>
    </View>
  );
}

const compStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  label: { flex: 2, fontSize: FontSize.xs, color: Colors.textSecondary },
  free: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  pro: { flex: 1, fontSize: FontSize.xs, color: '#0A84FF', fontWeight: '700', textAlign: 'center' },
  elite: { flex: 1, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, upgradeVIP, refreshUser } = useUser();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [plans, setPlans] = useState<SubPlan[]>(FALLBACK_PLANS);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Determine current tier
  const currentTier = user?.subscriptionTier || (user?.isVIP ? 'pro' : 'free');

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPlans(data.map((row: any) => ({
            ...row,
            features: Array.isArray(row.features) ? row.features : JSON.parse(row.features || '[]'),
          })));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = async (plan: SubPlan) => {
    const productId = SUB_PRODUCT_IDS[plan.id];
    if (!productId) {
      showAlert('Not Available', 'This plan is not yet available for purchase.');
      return;
    }

    showAlert(
      `Subscribe to ${plan.name}`,
      `£${plan.price_monthly.toFixed(2)}/month via ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'}\n\nIncludes:\n• ${plan.star_multiplier}x star earning\n• +${plan.stars_monthly} bonus stars every month\n• ${plan.boost_multiplier}x boost power`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Subscribe — £${plan.price_monthly.toFixed(2)}/mo`,
          onPress: async () => {
            setLoadingPlan(plan.id);
            try {
              await connectIAP();
              const purchase = await purchaseProduct(productId);
              if (!purchase) { setLoadingPlan(null); return; }

              // Verify with backend
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              if (token) {
                await supabase.functions.invoke('verify-iap-purchase', {
                  body: {
                    product_id: productId,
                    purchase_token: purchase.purchaseToken || purchase.transactionId,
                    platform: Platform.OS,
                  },
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
              }

              await completePurchase(purchase);

              // Update subscription tier
              if (user?.id) {
                await supabase
                  .from('user_profiles')
                  .update({
                    subscription_tier: plan.id,
                    subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    is_vip: true,
                    vip_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  })
                  .eq('id', user.id);
              }

              await refreshUser();
              showAlert(
                `${plan.name} Activated!`,
                `You are now on the ${plan.name} plan. Enjoy ${plan.star_multiplier}x stars and +${plan.stars_monthly} monthly bonus stars!`
              );
            } catch (err: any) {
              showAlert('Purchase Error', err.message || 'Could not complete subscription. Please try again.');
            } finally {
              setLoadingPlan(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription Plans</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <LinearGradient
          colors={['rgba(255,215,0,0.12)', 'rgba(255,45,85,0.08)', 'transparent']}
          style={styles.hero}
        >
          <MaterialIcons name="workspace-premium" size={40} color={Colors.gold} />
          <Text style={styles.heroTitle}>Supercharge Your Growth</Text>
          <Text style={styles.heroSub}>
            Unlock multiplied star earnings, monthly bonuses, and priority boost placement.
          </Text>
          {currentTier !== 'free' && (
            <View style={styles.activeBanner}>
              <MaterialIcons name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.activeBannerText}>
                Active: <Text style={{ color: Colors.success, fontWeight: '800', textTransform: 'capitalize' }}>{currentTier}</Text> Plan
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Plans */}
        <View style={styles.plansSection}>
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isActive={currentTier === plan.id}
              isCurrent={currentTier === plan.id}
              onSelect={handleSubscribe}
              loading={loadingPlan === plan.id}
            />
          ))}
        </View>

        {/* Comparison Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Comparison</Text>
          <View style={styles.compCard}>
            <View style={[compStyles.row, { borderBottomWidth: 2, borderBottomColor: Colors.surfaceBorder }]}>
              <Text style={[compStyles.label, { fontWeight: '700', color: Colors.textPrimary }]}>Feature</Text>
              <Text style={[compStyles.free, { color: Colors.textSecondary, fontWeight: '700' }]}>Free</Text>
              <Text style={[compStyles.pro, { fontWeight: '800' }]}>Pro</Text>
              <Text style={[compStyles.elite, { color: Colors.gold, fontWeight: '800' }]}>Elite</Text>
            </View>
            <ComparisonRow label="Star Earning Multiplier" free="1x" pro="1.5x" elite="2x" />
            <ComparisonRow label="Monthly Bonus Stars" free="0" pro="+500" elite="+1,500" />
            <ComparisonRow label="Boost Power Multiplier" free="1x" pro="1.5x" elite="2x" />
            <ComparisonRow label="Boost Packages" free="Basic" pro="Pro + Basic" elite="All" />
            <ComparisonRow label="Free Spins/Week" free="1" pro="3" elite="7" />
            <ComparisonRow label="Priority Support" free="—" pro="✓" elite="✓ (Dedicated)" />
            <ComparisonRow label="Profile Badge" free="—" pro="Pro Badge" elite="Elite Badge" />
            <ComparisonRow label="Early Access" free="—" pro="—" elite="✓" />
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {[
            {
              q: 'When does the multiplier apply?',
              a: 'The star multiplier applies to all task rewards, daily check-ins, and mini-games immediately after subscribing.',
            },
            {
              q: 'When are bonus stars credited?',
              a: 'Monthly bonus stars are credited instantly at the start of each billing cycle.',
            },
            {
              q: 'Can I cancel anytime?',
              a: `Yes. Cancel through ${Platform.OS === 'ios' ? 'App Store Subscriptions' : 'Google Play Subscriptions'} settings. Your plan stays active until the end of the billing period.`,
            },
            {
              q: 'Can I upgrade mid-cycle?',
              a: 'Yes. Upgrading applies the new multiplier immediately. Prorations are handled by the store.',
            },
          ].map((item, i) => (
            <View key={i} style={styles.faqCard}>
              <Text style={styles.faqQ}>{item.q}</Text>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}
        </View>

        {/* Legal */}
        <Text style={styles.legal}>
          Subscriptions renew automatically unless cancelled. Manage subscriptions in{' '}
          {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} settings. Prices in GBP.
        </Text>

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
  hero: {
    alignItems: 'center', padding: Spacing.xl,
    margin: Spacing.md, borderRadius: BorderRadius.xl, gap: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,209,126,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(0,209,126,0.3)',
  },
  activeBannerText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  plansSection: { paddingHorizontal: Spacing.md },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  compCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  faqCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  faqQ: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  faqA: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  legal: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center',
    paddingHorizontal: Spacing.lg, lineHeight: 18,
  },
});
