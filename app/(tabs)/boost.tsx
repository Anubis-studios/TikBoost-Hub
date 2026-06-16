import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert, getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '@/constants/theme';
import { BOOST_PACKAGES, BoostPackage } from '@/services/mockData';

// Pro/VIP-locked package IDs
const VIP_LOCKED_IDS = new Set(['video_viral', 'profile_viral']);

// ─── TikTok Profile Preview Card ─────────────────────────────────────────────

interface TikTokProfileData {
  authorName: string;
  thumbnailUrl: string;
  profileUrl: string;
}

function TikTokProfileCard({ username }: { username: string }) {
  const [data, setData] = useState<TikTokProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!username) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fetchProfile = async (uname: string) => {
    setLoading(true);
    setError(false);
    setAttempted(true);
    try {
      const cleanUsername = uname.replace('@', '').trim();
      const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;
      // TikTok oEmbed endpoint — returns author_name and thumbnail_url
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      setData({
        authorName: json.author_name || cleanUsername,
        thumbnailUrl: json.thumbnail_url || '',
        profileUrl,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username && !attempted) {
      fetchProfile(username);
    }
  }, [username]);

  if (!username) return null;

  return (
    <View style={tikStyles.card}>
      <View style={tikStyles.cardHeader}>
        <MaterialIcons name="tiktok" size={16} color={Colors.textPrimary} />
        <Text style={tikStyles.cardTitle}>Your TikTok Profile</Text>
      </View>

      {loading && (
        <View style={tikStyles.skeleton}>
          <Animated.View style={[tikStyles.skeletonAvatar, { opacity: pulseAnim }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={[tikStyles.skeletonLine, { width: '60%', opacity: pulseAnim }]} />
            <Animated.View style={[tikStyles.skeletonLine, { width: '40%', opacity: pulseAnim }]} />
          </View>
        </View>
      )}

      {!loading && error && (
        <View style={tikStyles.errorRow}>
          <MaterialIcons name="person-off" size={20} color={Colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={tikStyles.errorText}>Could not load @{username.replace('@', '')}</Text>
            <Text style={tikStyles.errorSub}>Make sure your TikTok username is correct</Text>
          </View>
          <TouchableOpacity onPress={() => fetchProfile(username)} style={tikStyles.retryBtn}>
            <MaterialIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={tikStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && data && (
        <View style={tikStyles.profileRow}>
          <LinearGradient colors={Colors.gradientPink as [string, string]} style={tikStyles.avatar}>
            <Text style={tikStyles.avatarText}>
              {(data.authorName || username).replace('@', '').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={tikStyles.authorName}>@{data.authorName || username.replace('@', '')}</Text>
            <Text style={tikStyles.authorSub}>TikTok Creator</Text>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(data.profileUrl)}
            style={tikStyles.viewBtn}
            activeOpacity={0.8}
          >
            <MaterialIcons name="open-in-new" size={14} color="#fff" />
            <Text style={tikStyles.viewBtnText}>View</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const tikStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  cardTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  skeleton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  skeletonAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
  },
  skeletonLine: { height: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 6 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  errorText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  errorSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  retryText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  authorName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  authorSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  viewBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },
});

// ─── Package Content ──────────────────────────────────────────────────────────

function PackageContent({ pkg, canAfford, isLocked }: { pkg: BoostPackage; canAfford: boolean; isLocked: boolean }) {
  return (
    <View style={packageStyles.content}>
      {isLocked && (
        <View style={packageStyles.lockBadge}>
          <MaterialIcons name="workspace-premium" size={10} color={Colors.gold} />
          <Text style={packageStyles.lockBadgeText}>VIP ONLY</Text>
        </View>
      )}
      <View style={packageStyles.left}>
        <MaterialIcons
          name={pkg.type === 'video' ? 'videocam' : 'person'}
          size={22}
          color={isLocked ? Colors.gold : pkg.popular ? Colors.primary : Colors.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <View style={packageStyles.labelRow}>
            <Text style={packageStyles.label}>{pkg.label}</Text>
            {isLocked && <MaterialIcons name="lock" size={14} color={Colors.gold} />}
          </View>
          <Text style={packageStyles.desc}>{pkg.description}</Text>
          <View style={packageStyles.meta}>
            <View style={packageStyles.metaTag}>
              <MaterialIcons name="people" size={12} color={Colors.textSecondary} />
              <Text style={packageStyles.metaText}>{pkg.reach}</Text>
            </View>
            <View style={packageStyles.metaTag}>
              <MaterialIcons name="schedule" size={12} color={Colors.textSecondary} />
              <Text style={packageStyles.metaText}>{pkg.duration}</Text>
            </View>
          </View>
        </View>
      </View>
      {isLocked ? (
        <LinearGradient
          colors={['#2A1A00', '#1A1200']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[packageStyles.priceBtn, packageStyles.priceBtnLocked]}
        >
          <MaterialIcons name="workspace-premium" size={12} color={Colors.gold} />
          <Text style={[packageStyles.priceText, { color: Colors.gold }]}>VIP</Text>
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={canAfford ? (Colors.gradientPink as [string, string]) : ['#333', '#222']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={packageStyles.priceBtn}
        >
          <MaterialIcons name="star" size={12} color={canAfford ? Colors.gold : Colors.textMuted} />
          <Text style={[packageStyles.priceText, !canAfford && { color: Colors.textMuted }]}>
            {pkg.stars.toLocaleString()}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

const packageStyles = StyleSheet.create({
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, position: 'relative' },
  lockBadge: {
    position: 'absolute', top: -8, right: -4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)', borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  lockBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.gold },
  left: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6 },
  meta: { flexDirection: 'row', gap: Spacing.sm },
  metaTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: Colors.textMuted },
  priceBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, gap: 4, minWidth: 72, justifyContent: 'center',
  },
  priceBtnLocked: { borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  priceText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BoostScreen() {
  const { user, spendStars, activateBoost, upgradeVIP } = useUser();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [tab, setTab] = useState<'video' | 'profile'>('video');
  const [videoUrl, setVideoUrl] = useState('');
  const [vipLoading, setVipLoading] = useState(false);
  const supabase = getSupabaseClient();

  if (!user) return null;

  const packages = BOOST_PACKAGES.filter(p => p.type === tab);

  const handleVIPCheckout = async () => {
    setVipLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-vip-payment', {
        body: {},
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        const { FunctionsHttpError } = await import('@supabase/supabase-js');
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text(); } catch {}
        }
        throw new Error(msg);
      }

      if (data?.url) {
        await Linking.openURL(data.url);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      showAlert('Payment Error', err.message || 'Could not start checkout. Please try again.');
    } finally {
      setVipLoading(false);
    }
  };

  const handleBoost = (pkg: BoostPackage) => {
    const isLocked = VIP_LOCKED_IDS.has(pkg.id) && !user.isVIP;

    if (isLocked) {
      showAlert(
        'VIP Required',
        `The "${pkg.label}" package is exclusive to VIP members.\n\nUpgrade to VIP for £4.99 to unlock:\n• This Pro boost package\n• 2x star earning on all tasks\n• +500 bonus stars\n• Priority boost placement`,
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Upgrade — £4.99', onPress: handleVIPCheckout },
        ]
      );
      return;
    }

    if (user.stars < pkg.stars) {
      showAlert(
        'Not Enough Stars',
        `You need ${pkg.stars} stars but only have ${user.stars}. Earn more or buy stars!`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Stars', onPress: () => router.push('/buy-stars') },
        ]
      );
      return;
    }

    if (tab === 'video' && !videoUrl.trim()) {
      showAlert('Video URL Required', 'Please enter your TikTok video URL to boost it.');
      return;
    }

    showAlert(
      `Boost: ${pkg.label}`,
      `This will use ${pkg.stars} stars to get ${pkg.reach} on your ${tab}.\n\nDuration: ${pkg.duration}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Boost',
          onPress: async () => {
            const success = await spendStars(pkg.stars, `Boost: ${pkg.label}`, 'boost');
            if (success) {
              const expires = new Date();
              expires.setHours(expires.getHours() + parseInt(pkg.duration));
              await activateBoost({
                id: Date.now().toString(),
                packageId: pkg.id,
                label: pkg.label,
                reach: pkg.reach,
                expiresAt: expires.toISOString(),
                progress: 0,
                videoUrl: tab === 'video' ? videoUrl : undefined,
                boostType: tab,
              });
              showAlert('Boost Activated!', `Your ${tab} boost is now live!`);
              if (tab === 'video') setVideoUrl('');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Boost</Text>
            <View style={styles.balancePill}>
              <MaterialIcons name="star" size={14} color={Colors.gold} />
              <Text style={styles.balanceText}>{user.stars.toLocaleString()} stars</Text>
            </View>
          </View>

          {/* TikTok Profile Preview */}
          {user.tiktokUsername && (
            <TikTokProfileCard username={user.tiktokUsername} />
          )}

          {/* VIP promo if not VIP */}
          {!user.isVIP && (
            <TouchableOpacity onPress={handleVIPCheckout} activeOpacity={0.85} disabled={vipLoading}>
              <LinearGradient
                colors={['rgba(255,215,0,0.15)', 'rgba(255,45,85,0.1)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.vipBanner}
              >
                <MaterialIcons name="workspace-premium" size={20} color={Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.vipBannerTitle}>Unlock Pro Boosts with VIP</Text>
                  <Text style={styles.vipBannerSub}>2x stars, priority placement + viral packages — £4.99</Text>
                </View>
                {vipLoading ? (
                  <ActivityIndicator size="small" color={Colors.gold} />
                ) : (
                  <MaterialIcons name="chevron-right" size={20} color={Colors.gold} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Info Banner */}
          <LinearGradient
            colors={['rgba(255,45,85,0.15)', 'rgba(255,45,85,0.05)']}
            style={styles.infoBanner}
          >
            <MaterialIcons name="info-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>
              Spend your earned stars to get real reach on TikTok. Your videos and profile will be shown to active users.
            </Text>
          </LinearGradient>

          {/* Tab */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'video' && styles.tabBtnActive]}
              onPress={() => setTab('video')}
            >
              <MaterialIcons name="videocam" size={18} color={tab === 'video' ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.tabText, tab === 'video' && styles.tabTextActive]}>Video Boost</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'profile' && styles.tabBtnActive]}
              onPress={() => setTab('profile')}
            >
              <MaterialIcons name="person" size={18} color={tab === 'profile' ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Profile Boost</Text>
            </TouchableOpacity>
          </View>

          {/* Video URL Input */}
          {tab === 'video' && (
            <View style={styles.urlSection}>
              <Text style={styles.urlLabel}>TikTok Video URL</Text>
              <View style={styles.urlField}>
                <MaterialIcons name="link" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.urlInput}
                  placeholder="https://www.tiktok.com/@you/video/..."
                  placeholderTextColor={Colors.textMuted}
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  autoCapitalize="none"
                  accessibilityLabel="TikTok video URL"
                />
              </View>
            </View>
          )}

          {/* Packages */}
          <Text style={styles.sectionTitle}>
            {tab === 'video' ? 'Video Boost Packages' : 'Profile Boost Packages'}
          </Text>

          <View style={styles.packagesList}>
            {packages.map(pkg => {
              const isLocked = VIP_LOCKED_IDS.has(pkg.id) && !user.isVIP;
              const canAfford = user.stars >= pkg.stars;
              return (
                <TouchableOpacity key={pkg.id} onPress={() => handleBoost(pkg)} activeOpacity={0.85}>
                  {pkg.popular ? (
                    <LinearGradient
                      colors={['#2A0A14', '#1A0A10']}
                      style={[styles.packageCard, styles.packageCardPopular]}
                    >
                      <View style={styles.popularBadge}>
                        <MaterialIcons name="local-fire-department" size={12} color="#fff" />
                        <Text style={styles.popularText}>MOST POPULAR</Text>
                      </View>
                      <PackageContent pkg={pkg} canAfford={canAfford} isLocked={isLocked} />
                    </LinearGradient>
                  ) : (
                    <View style={[
                      styles.packageCard,
                      !canAfford && !isLocked && styles.packageCardDimmed,
                      isLocked && styles.packageCardLocked,
                    ]}>
                      <PackageContent pkg={pkg} canAfford={canAfford} isLocked={isLocked} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Rules */}
          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <MaterialIcons name="notifications" size={18} color={Colors.warning} />
              <Text style={styles.rulesTitle}>Important Notes</Text>
            </View>
            <Text style={styles.ruleItem}>1. Make sure your TikTok account is public.</Text>
            <Text style={styles.ruleItem}>2. Do not change your username while a boost is active.</Text>
            <Text style={styles.ruleItem}>3. Do not delete the boosted video/post.</Text>
            <Text style={styles.ruleItem}>4. Stars are refunded if boost fails to deliver.</Text>
          </View>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  balanceText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gold },
  vipBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  vipBannerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gold },
  vipBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    margin: Spacing.md, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  tabBar: {
    flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, gap: 4,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  urlSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  urlLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.xs },
  urlField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  urlInput: { flex: 1, height: 46, color: Colors.textPrimary, fontSize: FontSize.sm },
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  packagesList: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  packageCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder, position: 'relative',
  },
  packageCardPopular: { borderColor: 'rgba(255,45,85,0.4)', ...Shadow.pink },
  packageCardDimmed: { opacity: 0.6 },
  packageCardLocked: { borderColor: 'rgba(255,215,0,0.25)', backgroundColor: 'rgba(255,215,0,0.04)' },
  popularBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: Spacing.sm,
  },
  popularText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  rulesCard: {
    margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,184,48,0.2)',
  },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  rulesTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.warning },
  ruleItem: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
});
