import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { updateProfile } from '@/services/supabaseService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function DatePickerModal({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const parsed = value ? new Date(value) : new Date(1995, 0, 1);
  const [year, setYear] = useState(String(parsed.getFullYear()));
  const [month, setMonth] = useState(parsed.getMonth());
  const [day, setDay] = useState(parsed.getDate());

  const daysInMonth = new Date(parseInt(year) || 1995, month + 1, 0).getDate();

  const handleConfirm = () => {
    const d = parseInt(year);
    if (!d || d < 1900 || d > new Date().getFullYear()) return;
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(Math.min(day, daysInMonth)).padStart(2, '0');
    onConfirm(`${d}-${mm}-${dd}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>Select Birthday</Text>

          {/* Year */}
          <Text style={pickerStyles.label}>Year</Text>
          <View style={pickerStyles.inputRow}>
            <MaterialIcons name="cake" size={20} color={Colors.primary} />
            <TextInput
              style={pickerStyles.yearInput}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={Colors.textMuted}
              placeholder="YYYY"
            />
          </View>

          {/* Month */}
          <Text style={pickerStyles.label}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pickerStyles.monthRow}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[pickerStyles.monthChip, month === i && pickerStyles.monthChipActive]}
                onPress={() => setMonth(i)}
              >
                <Text style={[pickerStyles.monthText, month === i && pickerStyles.monthTextActive]}>
                  {m.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Day */}
          <Text style={pickerStyles.label}>Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pickerStyles.dayRow}>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <TouchableOpacity
                key={d}
                style={[pickerStyles.dayChip, day === d && pickerStyles.dayChipActive]}
                onPress={() => setDay(d)}
              >
                <Text style={[pickerStyles.dayText, day === d && pickerStyles.dayTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.85}>
            <LinearGradient
              colors={Colors.gradientPink as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={pickerStyles.confirmBtn}
            >
              <Text style={pickerStyles.confirmText}>Confirm</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={pickerStyles.cancelBtn}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: Spacing.xxl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.surfaceBorder,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  yearInput: { flex: 1, height: 48, color: Colors.textPrimary, fontSize: FontSize.md },
  monthRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm, marginBottom: Spacing.md },
  monthChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  monthChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  monthTextActive: { color: '#fff' },
  dayRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm, marginBottom: Spacing.lg },
  dayChip: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  dayTextActive: { color: '#fff' },
  confirmBtn: {
    height: 52, borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
  },
  confirmText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  cancelBtn: { height: 44, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
});

export default function EditProfileScreen() {
  const { user, refreshUser } = useUser();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [tiktokUsername, setTiktokUsername] = useState(user?.tiktokUsername || '');
  const [displayName, setDisplayName] = useState(user?.tiktokUsername || '');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    const trimmedTiktok = tiktokUsername.trim().replace(/^@/, '');
    const trimmedDisplay = displayName.trim();

    if (!trimmedTiktok) {
      showAlert('Required', 'Please enter your TikTok username.');
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        tiktok_username: trimmedTiktok,
        username: trimmedDisplay || trimmedTiktok,
      };
      await updateProfile(user.id, updates);
      await refreshUser();
      showAlert('Saved!', 'Your profile has been updated.');
      router.back();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    tiktokUsername.trim().replace(/^@/, '') !== user.tiktokUsername ||
    !!birthday || !!gender;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !hasChanges}
              style={[styles.saveHeaderBtn, (!hasChanges || saving) && { opacity: 0.4 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.saveHeaderText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={Colors.gradientPink as [string, string]} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(tiktokUsername || user.tiktokUsername || 'U').replace('@', '').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <TouchableOpacity
                style={styles.avatarEditBtn}
                onPress={() => showAlert('Avatar Upload', 'Avatar upload coming soon! Your initials are shown for now.')}
              >
                <MaterialIcons name="camera-alt" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarSub}>Tap camera icon to update photo</Text>
          </View>

          {/* Name */}
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Name</Text>
            <View style={styles.field}>
              <MaterialIcons name="person" size={20} color={Colors.primary} />
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                accessibilityLabel="Display name"
              />
            </View>

            {/* Email (readonly) */}
            <Text style={styles.sectionLabel}>Email</Text>
            <View style={[styles.field, styles.readonlyField]}>
              <MaterialIcons name="alternate-email" size={20} color={Colors.textSecondary} />
              <View style={styles.inputDivider} />
              <Text style={styles.readonlyText}>{user.email}</Text>
            </View>

            {/* TikTok username */}
            <Text style={styles.sectionLabel}>TikTok Username</Text>
            <View style={styles.field}>
              <MaterialIcons name="alternate-email" size={20} color={Colors.info} />
              <TextInput
                style={styles.input}
                value={tiktokUsername}
                onChangeText={setTiktokUsername}
                placeholder="yourname"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="TikTok username"
              />
            </View>

            {/* Birthday */}
            <Text style={styles.sectionLabel}>Birthday</Text>
            <TouchableOpacity
              style={styles.field}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="cake" size={20} color={Colors.warning} />
              <View style={styles.inputDivider} />
              <Text style={[styles.input, { lineHeight: 50, color: birthday ? Colors.textPrimary : Colors.textMuted }]}>
                {birthday || '1993-12-21'}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Gender */}
            <Text style={styles.sectionLabel}>Gender</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                onPress={() => setGender(gender === 'male' ? null : 'male')}
                activeOpacity={0.85}
              >
                <Text style={styles.genderIcon}>♂</Text>
                <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                onPress={() => setGender(gender === 'female' ? null : 'female')}
                activeOpacity={0.85}
              >
                <Text style={styles.genderIcon}>♀</Text>
                <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.saveBtnWrapper}>
            <TouchableOpacity onPress={handleSave} disabled={saving || !hasChanges} activeOpacity={0.85}>
              <LinearGradient
                colors={hasChanges && !saving ? (Colors.gradientPink as [string, string]) : ['#333', '#222']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.5 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color={hasChanges ? '#fff' : Colors.textMuted} />
                    <Text style={[styles.saveBtnText, !hasChanges && { color: Colors.textMuted }]}>
                      Save Changes
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={birthday}
        onConfirm={setBirthday}
        onClose={() => setShowDatePicker(false)}
      />
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
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  title: { flex: 1, fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  saveHeaderBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8 },
  saveHeaderText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,45,85,0.3)',
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.primary, borderRadius: 14,
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  avatarSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  form: { paddingHorizontal: Spacing.md },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: 6,
  },
  inputDivider: { width: 1, height: 24, backgroundColor: Colors.surfaceBorder },
  input: { flex: 1, height: 50, color: Colors.textPrimary, fontSize: FontSize.md },
  readonlyField: { backgroundColor: Colors.surfaceElevated, opacity: 0.7 },
  readonlyText: { flex: 1, height: 50, lineHeight: 50, color: Colors.textSecondary, fontSize: FontSize.sm },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.surfaceBorder,
  },
  genderBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(255,45,85,0.1)' },
  genderIcon: { fontSize: 20, color: Colors.textSecondary },
  genderText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  genderTextActive: { color: Colors.primary },
  saveBtnWrapper: { paddingHorizontal: Spacing.md, marginTop: Spacing.xl },
  saveBtn: {
    height: 56, borderRadius: BorderRadius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});
