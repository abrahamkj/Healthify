import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, CommonActions } from '@react-navigation/native';
import { rootNavigationRef } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { AIService } from '../services/aiService';

const QUESTION_LABELS = {
  q1: 'Current weight', q2: 'Height', q3: 'Age', q4: 'Target weight',
  q5: 'Health goal', q5a: 'Specific condition', q5b: 'Goal duration',
  q6: 'Diet preference', q6a: 'Protein sources',
  q7: 'Activity level', q7a: 'Exercise time available',
  q8: 'Foods to avoid', q9: 'Medical conditions', q9a: 'On medication',
  q10: 'Sleep per night',
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [unitSystem, setUnitSystem] = useState('metric');
  const [regenerating, setRegenerating] = useState(false);
  const [lastPlanDate, setLastPlanDate] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(); }, []),
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

  async function regeneratePlan() {
    Alert.alert('Regenerate Plan', 'Create a fresh 7-day AI plan using your saved profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        onPress: async () => {
          setRegenerating(true);
          try {
            const apiKey = await StorageService.getApiKey();
            if (!apiKey) { Alert.alert('No API Key', 'Add your API key first.'); return; }
            const p = await StorageService.getUserProfile();
            const u = await StorageService.getUnitSystem();
            const { dietPlan, exercisePlan } = await AIService.generateHealthPlans(apiKey, p, u, () => {});
            await StorageService.setDietPlan(dietPlan);
            await StorageService.setExercisePlan(exercisePlan);
            await StorageService.setLastPlanDate(new Date().toISOString().split('T')[0]);
            setLastPlanDate(new Date().toISOString().split('T')[0]);
            Alert.alert('Done!', 'Your plans have been regenerated.');
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally {
            setRegenerating(false);
          }
        },
      },
    ]);
  }

  async function resetApp() {
    Alert.alert('Reset App', 'This will delete ALL data including profile, plans, and weight history. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset Everything',
        style: 'destructive',
        onPress: async () => {
          await StorageService.clearAll();
          rootNavigationRef.current?.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'ApiKey' }] }),
          );
        },
      },
    ]);
  }

  async function changeApiKey() {
    Alert.alert('Change API Key', 'You will be taken back to the API key screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: async () => {
          await StorageService.deleteApiKey();
          rootNavigationRef.current?.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'ApiKey' }] }),
          );
        },
      },
    ]);
  }

  const wUnit = unitSystem === 'metric' ? 'kg' : 'lbs';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Profile summary */}
        {profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Profile</Text>
            <View style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.profileAvatar}>
                  <Ionicons name="person" size={28} color={colors.primary} />
                </View>
                <View style={styles.profileDetails}>
                  <ProfileRow label="Goal" value={profile.goal} />
                  <ProfileRow label="Current weight" value={profile.currentWeight} />
                  <ProfileRow label="Target" value={profile.targetWeight} />
                  <ProfileRow label="Height" value={profile.height} />
                  <ProfileRow label="Activity" value={profile.activityLevel} />
                  <ProfileRow label="Diet" value={profile.dietaryPreference} />
                  {profile.specificCondition && <ProfileRow label="Condition" value={profile.specificCondition} />}
                  {profile.exerciseTimeAvailable && <ProfileRow label="Exercise time" value={profile.exerciseTimeAvailable} />}
                  {profile.onMedication && <ProfileRow label="Medication" value={profile.onMedication} />}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* All onboarding answers */}
        {answers && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionToggle}
              onPress={() => setShowAnswers(v => !v)}
            >
              <Text style={styles.sectionTitle}>Your Answers</Text>
              <Ionicons name={showAnswers ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {showAnswers && (
              <View style={styles.card}>
                {Object.entries(answers).map(([qId, ans]) => {
                  const label = QUESTION_LABELS[qId] || qId;
                  const value = Array.isArray(ans) ? ans.join(', ') : ans;
                  return (
                    <View key={qId} style={styles.answerRow}>
                      <Text style={styles.answerLabel}>{label}</Text>
                      <Text style={styles.answerValue}>{value || '—'}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
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
        </View>

        {/* Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Plans</Text>
          <View style={styles.card}>
            {lastPlanDate && (
              <View style={styles.planDateRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                <Text style={styles.planDateText}>Last generated: {lastPlanDate}</Text>
              </View>
            )}
            <ActionButton
              icon="refresh" iconColor={colors.secondary}
              label="Regenerate Diet & Exercise Plan"
              sublabel="Creates a new AI-powered 7-day plan"
              onPress={regeneratePlan} loading={regenerating}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <ActionButton
              icon="key-outline" iconColor={colors.warning}
              label="Change API Key"
              sublabel="Update your Anthropic API key"
              onPress={changeApiKey}
            />
            <View style={styles.divider} />
            <ActionButton
              icon="trash-outline" iconColor={colors.danger}
              label="Reset App"
              sublabel="Delete all data and start fresh"
              onPress={resetApp} destructive
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Ionicons name="leaf" size={24} color={colors.primary} />
              <View>
                <Text style={styles.appName}>Healthify</Text>
                <Text style={styles.appVersion}>v1.0.0 · Powered by Claude AI</Text>
              </View>
            </View>
            <Text style={styles.aboutDesc}>
              Personalized diet and home exercise plans using AI, tailored to your health profile.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({ label, value }) {
  return (
    <View style={styles.profileDetailRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value || '—'}</Text>
    </View>
  );
}

function ActionButton({ icon, iconColor, label, sublabel, onPress, loading, destructive }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingIcon, { backgroundColor: `${iconColor}20` }]}>
        {loading ? <ActivityIndicator size="small" color={iconColor} /> : <Ionicons name={icon} size={18} color={iconColor} />}
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.settingLabel, destructive && { color: colors.danger }]}>{label}</Text>
        {sublabel && <Text style={styles.settingValue}>{sublabel}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  screenTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden' },
  profileRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  profileAvatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: 'rgba(56,189,248,0.15)', justifyContent: 'center', alignItems: 'center' },
  profileDetails: { flex: 1, gap: 6 },
  profileDetailRow: { flexDirection: 'row', gap: spacing.sm },
  profileLabel: { fontSize: fontSize.sm, color: colors.textMuted, width: 105 },
  profileValue: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  answerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  answerLabel: { fontSize: fontSize.sm, color: colors.textMuted, width: 130 },
  answerValue: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  settingValue: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  planDateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  planDateText: { fontSize: fontSize.sm, color: colors.textMuted },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  actionText: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, paddingBottom: 0 },
  appName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  appVersion: { fontSize: fontSize.sm, color: colors.textMuted },
  aboutDesc: { fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20, padding: spacing.md, paddingTop: spacing.sm },
});
