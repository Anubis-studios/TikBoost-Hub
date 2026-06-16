import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { CAPTION_TEMPLATES, CaptionTemplate } from '@/services/mockData';

export default function ToolsScreen() {
  const { showAlert } = useAlert();
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);

  const selectedTemplate = CAPTION_TEMPLATES.find(t => t.niche === selectedNiche);

  const handleNicheSelect = (niche: string) => {
    setSelectedNiche(niche);
    setSelectedCaption(null);
    setGeneratedHashtags([]);
  };

  const handleGenerate = () => {
    if (!selectedTemplate) return;
    const randomCaption = selectedTemplate.captions[Math.floor(Math.random() * selectedTemplate.captions.length)];
    setSelectedCaption(randomCaption);
    // Pick random 5-7 hashtags
    const shuffled = [...selectedTemplate.hashtags].sort(() => Math.random() - 0.5);
    setGeneratedHashtags(shuffled.slice(0, Math.floor(Math.random() * 3) + 5));
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    showAlert('Copied!', `${label} copied to clipboard.`);
  };

  const copyAll = () => {
    if (!selectedCaption) return;
    const hashtags = generatedHashtags.join(' ');
    const full = `${selectedCaption}\n\n${hashtags}`;
    Clipboard.setString(full);
    showAlert('Copied!', 'Caption and hashtags copied to clipboard. Paste directly into TikTok!');
  };

  const nicheIcons: Record<string, string> = {
    Dance: 'music-note',
    Fashion: 'checkroom',
    Food: 'restaurant',
    Fitness: 'fitness-center',
    Comedy: 'sentiment-very-satisfied',
    Lifestyle: 'spa',
  };

  const nicheColors: Record<string, string> = {
    Dance: Colors.primary,
    Fashion: Colors.purple,
    Food: Colors.warning,
    Fitness: Colors.success,
    Comedy: Colors.gold,
    Lifestyle: Colors.info,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AI Tools</Text>
          <View style={styles.aiBadge}>
            <MaterialIcons name="auto-awesome" size={14} color={Colors.success} />
            <Text style={styles.aiBadgeText}>AI Powered</Text>
          </View>
        </View>

        {/* Caption Generator Card */}
        <LinearGradient
          colors={['#001A10', '#0D0D0D']}
          style={styles.generatorCard}
        >
          <View style={styles.generatorHeader}>
            <MaterialIcons name="auto-awesome" size={22} color={Colors.success} />
            <Text style={styles.generatorTitle}>Viral Caption Generator</Text>
          </View>
          <Text style={styles.generatorDesc}>
            Generate viral captions and trending hashtags tailored to your niche. Copy and paste directly into TikTok!
          </Text>
        </LinearGradient>

        {/* Step 1: Pick Niche */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Pick Your Niche</Text>
          </View>
          <View style={styles.nicheGrid}>
            {CAPTION_TEMPLATES.map(template => {
              const isSelected = selectedNiche === template.niche;
              const color = nicheColors[template.niche] || Colors.primary;
              return (
                <TouchableOpacity
                  key={template.niche}
                  style={[styles.nicheCard, isSelected && { borderColor: color, backgroundColor: color + '15' }]}
                  onPress={() => handleNicheSelect(template.niche)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={nicheIcons[template.niche] as any}
                    size={22}
                    color={isSelected ? color : Colors.textSecondary}
                  />
                  <Text style={[styles.nicheName, isSelected && { color }]}>{template.niche}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step 2: Generate */}
        {selectedNiche && (
          <View style={styles.step}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Generate Caption</Text>
            </View>
            <TouchableOpacity onPress={handleGenerate} activeOpacity={0.85}>
              <LinearGradient
                colors={Colors.gradientPink as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateBtn}
              >
                <MaterialIcons name="auto-awesome" size={18} color="#fff" />
                <Text style={styles.generateBtnText}>
                  {selectedCaption ? 'Regenerate' : 'Generate Caption'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Result */}
        {selectedCaption && (
          <View style={styles.step}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Your Viral Content</Text>
            </View>

            {/* Caption */}
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultLabel}>Caption</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(selectedCaption, 'Caption')}
                  style={styles.copyBtn}
                >
                  <MaterialIcons name="content-copy" size={16} color={Colors.primary} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.captionText}>{selectedCaption}</Text>
            </View>

            {/* Hashtags */}
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultLabel}>Hashtags</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(generatedHashtags.join(' '), 'Hashtags')}
                  style={styles.copyBtn}
                >
                  <MaterialIcons name="content-copy" size={16} color={Colors.primary} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.hashtagsWrap}>
                {generatedHashtags.map((tag, i) => (
                  <View key={i} style={styles.hashtagChip}>
                    <Text style={styles.hashtagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Copy All CTA */}
            <TouchableOpacity onPress={copyAll} activeOpacity={0.85} style={styles.copyAllWrapper}>
              <LinearGradient
                colors={['#001A10', '#00120A']}
                style={styles.copyAllBtn}
              >
                <MaterialIcons name="content-copy" size={18} color={Colors.success} />
                <Text style={styles.copyAllText}>Copy Caption + Hashtags</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Pro Tips for Going Viral</Text>
          {[
            'Post between 6-9 PM for maximum reach',
            'Use trending sounds from the For You page',
            'Hook viewers in the first 2 seconds',
            'Engage with comments within the first hour',
            'Post consistently - at least once per day',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <MaterialIcons name="lightbulb" size={14} color={Colors.gold} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,217,126,0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,217,126,0.3)',
  },
  aiBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
  generatorCard: {
    margin: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,217,126,0.2)',
  },
  generatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  generatorTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  generatorDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  step: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  stepTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  nicheGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  nicheCard: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
  },
  nicheName: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
  },
  generateBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  resultLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryGlow,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  copyBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  captionText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 24 },
  hashtagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  hashtagChip: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.2)',
  },
  hashtagText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  copyAllWrapper: { marginTop: Spacing.xs },
  copyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,217,126,0.3)',
  },
  copyAllText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  tipsCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  tipsTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: Spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
