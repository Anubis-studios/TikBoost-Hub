import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'account' | 'services' | 'general';
}

const FAQ_DATA: FAQItem[] = [
  // Account
  {
    id: 'a1',
    category: 'account',
    question: 'How do I create a TikBoost account?',
    answer: 'Download TikBoost and tap "Sign Up". Enter your email, create a password (min 6 characters), and provide your TikTok username. You\'ll receive 200 welcome stars instantly to get started.',
  },
  {
    id: 'a2',
    category: 'account',
    question: 'Can I change my TikTok username?',
    answer: 'Currently your TikTok username is set during signup. Please contact our support team at support@tikboost.app if you need to update it.',
  },
  {
    id: 'a3',
    category: 'account',
    question: 'What is my referral code and how does it work?',
    answer: 'Your unique referral code is shown in your Profile tab. Share it with friends — when they sign up using your code, you both receive +150 bonus stars. There is no limit to how many friends you can refer!',
  },
  {
    id: 'a4',
    category: 'account',
    question: 'What happens to my account if I stop using TikBoost?',
    answer: 'Your account and stars balance are saved indefinitely. Your login streak will reset if you miss a day, but all earned stars and completed tasks remain on your account.',
  },
  {
    id: 'a5',
    category: 'account',
    question: 'How do I delete my account?',
    answer: 'To delete your account, please contact our support team at support@tikboost.app with your registered email address. Account deletion is permanent and cannot be undone.',
  },
  // Services
  {
    id: 's1',
    category: 'services',
    question: 'How do I earn stars?',
    answer: 'You can earn stars by: completing daily tasks (following TikTok profiles, liking videos, watching ads), maintaining your daily login streak, referring friends, and upgrading to VIP. Each task shows how many stars you\'ll earn before you complete it.',
  },
  {
    id: 's2',
    category: 'services',
    question: 'How do I boost my TikTok profile or video?',
    answer: 'Go to the Boost tab and choose a boost package. Select whether to boost your profile or a specific video, then spend the required stars. Your boost activates immediately and delivers organic reach over the specified time period.',
  },
  {
    id: 's3',
    category: 'services',
    question: 'How long does a boost last?',
    answer: 'Boost duration depends on the package you choose. Starter boosts run for 24 hours, Standard boosts for 3 days, and Pro boosts for 7 days. You can view active and past boosts in your Orders screen from the Profile tab.',
  },
  {
    id: 's4',
    category: 'services',
    question: 'What is the AI Caption Generator?',
    answer: 'The AI Caption Generator (in the Tools tab) uses AI to create viral TikTok captions and hashtag sets for your content. Describe your video topic and select a niche — the AI generates trending captions optimised for maximum engagement and reach.',
  },
  {
    id: 's5',
    category: 'services',
    question: 'Are the followers and views real?',
    answer: 'TikBoost connects you with a community of real TikTok users who genuinely engage with your content. All interactions come from real accounts — we do not use bots or fake accounts.',
  },
  {
    id: 's6',
    category: 'services',
    question: 'What is VIP membership?',
    answer: 'VIP membership (£4.99 for 30 days) gives you: +500 bonus stars instantly, 2x star earning on all tasks, priority boost placement, and an exclusive VIP profile badge. VIP status lasts 30 days from purchase.',
  },
  // General
  {
    id: 'g1',
    category: 'general',
    question: 'What is a daily login streak?',
    answer: 'Log into TikBoost every day to build your streak. Each consecutive day increases your streak count and bonus stars reward. Day 1 = 25 stars, Day 2 = 50 stars, and so on up to 300 stars per day. Missing a day resets your streak to 1.',
  },
  {
    id: 'g2',
    category: 'general',
    question: 'What are levels and how do I level up?',
    answer: 'Levels are based on your total stars earned (not current balance). As you earn more stars, you automatically progress: Newcomer → Rising Star → Content Creator → Influencer → TikTok Pro → Legend. Higher levels unlock bragging rights on the leaderboard.',
  },
  {
    id: 'g3',
    category: 'general',
    question: 'Is TikBoost safe for my TikTok account?',
    answer: 'TikBoost operates within TikTok\'s community guidelines by facilitating genuine user interactions. We do not require your TikTok password and never access your account directly. Growth through TikBoost is organic and community-driven.',
  },
  {
    id: 'g4',
    category: 'general',
    question: 'How do notifications work?',
    answer: 'TikBoost sends you notifications for: daily streak reminders (8 PM), boost completion updates, referral bonuses when friends join, and VIP status updates. You can manage notifications in your device settings.',
  },
  {
    id: 'g5',
    category: 'general',
    question: 'How do I contact support?',
    answer: 'For help, email us at support@tikboost.app. We typically respond within 24 hours. You can also check this FAQ for answers to common questions.',
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'help-outline' as const },
  { key: 'account', label: 'Account', icon: 'person-outline' as const },
  { key: 'services', label: 'Services', icon: 'rocket-launch' as const },
  { key: 'general', label: 'General', icon: 'info-outline' as const },
];

export default function HelpScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch =
        !search.trim() ||
        item.question.toLowerCase().includes(search.toLowerCase()) ||
        item.answer.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  const toggleItem = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const categoryColor = (cat: string) => {
    if (cat === 'account') return Colors.primary;
    if (cat === 'services') return Colors.gold;
    return Colors.info;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search questions..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              accessibilityLabel="Search FAQ"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
          style={styles.categoryBar}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results count */}
        <Text style={styles.resultCount}>
          {filtered.length} {filtered.length === 1 ? 'question' : 'questions'}
        </Text>

        {/* FAQ Items */}
        <View style={styles.faqList}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try a different search term or category</Text>
            </View>
          ) : (
            filtered.map((item, index) => {
              const isExpanded = expandedId === item.id;
              const color = categoryColor(item.category);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.faqItem,
                    index === filtered.length - 1 && styles.faqItemLast,
                    isExpanded && styles.faqItemExpanded,
                  ]}
                >
                  <View style={styles.faqRow}>
                    <View style={[styles.categoryDot, { backgroundColor: color + '33' }]}>
                      <View style={[styles.categoryDotInner, { backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.question, isExpanded && styles.questionExpanded]}>
                      {item.question}
                    </Text>
                    <MaterialIcons
                      name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={20}
                      color={isExpanded ? Colors.primary : Colors.textMuted}
                    />
                  </View>
                  {isExpanded && (
                    <View style={styles.answerContainer}>
                      <View style={[styles.answerDivider, { backgroundColor: color + '44' }]} />
                      <Text style={styles.answer}>{item.answer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Contact Support */}
        <View style={styles.supportCard}>
          <MaterialIcons name="headset-mic" size={28} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>Still need help?</Text>
            <Text style={styles.supportSub}>Contact us at support@tikboost.app</Text>
          </View>
          <MaterialIcons name="open-in-new" size={18} color={Colors.textMuted} />
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  searchContainer: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  categoryBar: { marginBottom: Spacing.sm },
  categoryScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  categoryChip: {
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
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  categoryLabelActive: { color: '#fff' },
  resultCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  faqList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  faqItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  faqItemLast: { borderBottomWidth: 0 },
  faqItemExpanded: { backgroundColor: Colors.surfaceElevated },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  categoryDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  categoryDotInner: { width: 8, height: 8, borderRadius: 4 },
  question: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  questionExpanded: { color: Colors.primary },
  answerContainer: { marginTop: Spacing.sm, paddingLeft: 32 },
  answerDivider: { height: 1, marginBottom: Spacing.sm },
  answer: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.2)',
    marginBottom: Spacing.md,
  },
  supportTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  supportSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
