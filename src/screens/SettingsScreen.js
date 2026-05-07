import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { AIService } from '../services/aiService';
import { rootNavigationRef } from '../navigation/AppNavigator';

const QUESTION_LABELS = {
  q1: 'Current weight', q2: 'Height', q3: 'Age', q4: 'Target weight',
  q5: 'Health goal', q5a: 'Specific condition', q5b: 'Goal duration',
  q6: 'Diet preference', q6a: 'Protein sources',
  q7: 'Activity level', q7a: 'Exercise time available',
  q8: 'Foods to avoid', q9: 'Medical conditions', q9a: 'On medication',
  q10: 'Sleep per night',
  q11: 'Location / Region',
};

export default function SettingsScreen() {
  const [profile, setProfile] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [unitSystem, setUnitSystem] = useState('metric');
  const [lastPlanDate, setLastPlanDate] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);

  // Action states
  const [regenStatus, setRegenStatus] = useState('idle'); // idle | loading | success | error
  const [regenError, setRegenError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmApiKey, setConfirmApiKey] = useState(false);
  const [resetting, setResetting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Reset action states when screen comes back into focus
      setConfirmReset(false);
      setConfirmApiKey(false);
      setRegenStatus('idle');
    }, []),
  );

  async function loadData() {
    const [p, u, d, a] = await Promise.all([
      StorageService.getUserProfile(),
      StorageService.getUnitSystem(),
      StorageService.getLastPlanDate(),
      StorageService.getOnboardingAnswers(),
    ]);
    setProfile(p);
    setUnitSystem(u);
    setLastPlanDate(d);
    setAnswers(a);
  }

  async function toggleUnit() {
    const newSys = unitSystem === 'metric' ? 'imperial' : 'metric';
    await StorageService.setUnitSystem(newSys);
    setUnitSystem(newSys);
  }

  async function doRegenerate() {
    setRegenStatus('loading');
    setRegenError('');
    try {
      const apiKey = await StorageService.getApiKey();
      if (!apiKey) { setRegenStatus('error'); setRegenError('No API key saved. Change API Key first.'); return; }
      const p = await StorageService.getUserProfile();
      const u = await StorageService.getUnitSystem();
      const { dietPlan, exercisePlan } = await AIService.generateHealthPlans(apiKey, p, u, () => {});
      await StorageService.setDietPlan(dietPlan);
      await StorageService.setExercisePlan(exercisePlan);
      const today = new Date().toISOString().split('T')[0];
      await StorageService.setLastPlanDate(today);
      setLastPlanDate(today);
      setRegenStatus('success');
    } catch (e) {
      setRegenStatus('error');
      setRegenError(e.message);
    }
  }

  async function doChangeApiKey() {
    await StorageService.deleteApiKey();
    rootNavigationRef.current?.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'ApiKey' }] }),
    );
  }

  async function doReset() {
    setResetting(true);
    await StorageService.clearAll();
    rootNavigationRef.current?.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'ApiKey' }] }),
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* ── Profile ─────────────────────────────────── */}
        {profile && (
          <Section title="Your Profile">
            <View style={styles.profileBox}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={26} color={colors.primary} />
              </View>
              <View style={styles.profileDetails}>
                <PRow label="Goal" value={profile.goal} />
                <PRow label="Weight" value={profile.currentWeight} />
                <PRow label="Target" value={profile.targetWeight} />
                <PRow label="Height" value={profile.height} />
                <PRow label="Activity" value={profile.activityLevel} />
                <PRow label="Diet" value={profile.dietaryPreference} />
                {profile.location && <PRow label="Location" value={profile.location} />}
                {profile.specificCondition && <PRow label="Condition" value={profile.specificCondition} />}
                {profile.exerciseTimeAvailable && <PRow label="Exercise time" value={profile.exerciseTimeAvailable} />}
                {profile.onMedication && <PRow label="Medication" value={profile.onMedication} />}
              </View>
            </View>
          </Section>
        )}

        {/* ── Answers ─────────────────────────────────── */}
        {answers && (
          <Section
            title="Your Answers"
            right={
              <TouchableOpacity onPress={() => setShowAnswers(v => !v)} style={styles.toggleBtn}>
                <Text style={styles.toggleBtnText}>{showAnswers ? 'Hide' : 'Show'}</Text>
                <Ionicons name={showAnswers ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
              </TouchableOpacity>
            }
          >
            {showAnswers && (
              <View style={styles.answersCard}>
                {Object.entries(answers).map(([qId, ans]) => (
                  <View key={qId} style={styles.answerRow}>
                    <Text style={styles.answerLabel}>{QUESTION_LABELS[qId] || qId}</Text>
                    <Text style={styles.answerValue}>{Array.isArray(ans) ? ans.join(', ') : ans}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>
        )}

        {/* ── Preferences ─────────────────────────────── */}
        <Section title="Preferences">
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.iconLabel}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
                  <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Unit System</Text>
                  <Text style={styles.settingValue}>{unitSystem === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lbs, ft)'}</Text>
                </View>
              </View>
              <Switch
                value={unitSystem === 'imperial'}
                onValueChange={toggleUnit}
                trackColor={{ false: colors.bgCardAlt, true: 'rgba(56,189,248,0.4)' }}
                thumbColor={unitSystem === 'imperial' ? colors.primary : colors.textMuted}
              />
            </View>
          </View>
        </Section>

        {/* ── Regenerate Plan ──────────────────────────── */}
        <Section title="Health Plans">
          <View style={styles.card}>
            {lastPlanDate && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>Last generated: {lastPlanDate}</Text>
              </View>
            )}

            {regenStatus === 'success' && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.successText}>Plans regenerated successfully!</Text>
              </View>
            )}
            {regenStatus === 'error' && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{regenError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, regenStatus === 'loading' && styles.actionBtnDisabled]}
              onPress={doRegenerate}
              disabled={regenStatus === 'loading'}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
                {regenStatus === 'loading'
                  ? <ActivityIndicator size="small" color={colors.secondary} />
                  : <Ionicons name="refresh" size={18} color={colors.secondary} />}
              </View>
              <View style={styles.actionText}>
                <Text style={styles.settingLabel}>
                  {regenStatus === 'loading' ? 'Generating (~60s)…' : 'Regenerate Diet & Exercise Plan'}
                </Text>
                <Text style={styles.settingValue}>Creates a new AI-powered 7-day plan</Text>
              </View>
              {regenStatus !== 'loading' && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── Change API Key ───────────────────────────── */}
        <Section title="API Key">
          <View style={styles.card}>
            {!confirmApiKey ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirmApiKey(true)} activeOpacity={0.7}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(251,146,60,0.15)' }]}>
                  <Ionicons name="key-outline" size={18} color={colors.warning} />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.settingLabel}>Change API Key</Text>
                  <Text style={styles.settingValue}>Update your Anthropic API key</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Change API Key?</Text>
                <Text style={styles.confirmSub}>You will be taken to the API key screen. Your health data will be kept.</Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmApiKey(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={doChangeApiKey}>
                    <Text style={styles.confirmBtnText}>Yes, Change Key</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Section>

        {/* ── Reset App ────────────────────────────────── */}
        <Section title="Danger Zone">
          <View style={styles.card}>
            {!confirmReset ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirmReset(true)} activeOpacity={0.7}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </View>
                <View style={styles.actionText}>
                  <Text style={[styles.settingLabel, { color: colors.danger }]}>Reset App</Text>
                  <Text style={styles.settingValue}>Delete all data and start fresh</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Ionicons name="warning" size={28} color={colors.danger} />
                <Text style={styles.confirmTitle}>Are you sure?</Text>
                <Text style={styles.confirmSub}>
                  This will permanently delete your profile, diet plan, exercise plan, and all weight entries. This cannot be undone.
                </Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmReset(false)} disabled={resetting}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteBtn, resetting && styles.actionBtnDisabled]}
                    onPress={doReset}
                    disabled={resetting}
                  >
                    {resetting
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : <Text style={styles.deleteBtnText}>Yes, Delete Everything</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Section>

        {/* ── About ────────────────────────────────────── */}
        <Section title="About">
          <View style={[styles.card, styles.aboutCard]}>
            <Ionicons name="leaf" size={22} color={colors.primary} />
            <View>
              <Text style={styles.settingLabel}>Healthify  v1.0.0</Text>
              <Text style={styles.settingValue}>Powered by Claude AI (Anthropic)</Text>
            </View>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, right }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function PRow({ label, value }) {
  return (
    <View style={styles.pRow}>
      <Text style={styles.pLabel}>{label}</Text>
      <Text style={styles.pValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 80 },
  screenTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggleBtnText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden' },
  profileBox: { flexDirection: 'row', padding: spacing.md, gap: spacing.md, backgroundColor: colors.bgCard, borderRadius: radius.md },
  profileAvatar: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: 'rgba(56,189,248,0.15)', justifyContent: 'center', alignItems: 'center' },
  profileDetails: { flex: 1, gap: 5 },
  pRow: { flexDirection: 'row' },
  pLabel: { fontSize: fontSize.sm, color: colors.textMuted, width: 100 },
  pValue: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  answersCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden' },
  answerRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  answerLabel: { fontSize: fontSize.sm, color: colors.textMuted, width: 130 },
  answerValue: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  settingValue: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  metaText: { fontSize: fontSize.sm, color: colors.textMuted },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, marginBottom: 0, backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: radius.sm, padding: spacing.sm },
  successText: { fontSize: fontSize.sm, color: colors.success, flex: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, margin: spacing.md, marginBottom: 0, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: radius.sm, padding: spacing.sm },
  errorText: { fontSize: fontSize.sm, color: colors.danger, flex: 1, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  actionBtnDisabled: { opacity: 0.5 },
  actionText: { flex: 1 },
  confirmBox: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  confirmTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  confirmSub: { fontSize: fontSize.sm, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, width: '100%' },
  cancelBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSub },
  confirmBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warning, alignItems: 'center' },
  confirmBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.bg },
  deleteBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  deleteBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  aboutCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
});
