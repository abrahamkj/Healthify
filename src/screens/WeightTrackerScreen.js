import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { HealthKitService } from '../services/healthKitService';
import WeightChart from '../components/WeightChart';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function WeightTrackerScreen() {
  const [weightLog, setWeightLog] = useState([]);
  const [profile, setProfile] = useState(null);
  const [unitSystem, setUnitSystem] = useState('metric');
  const [inputWeight, setInputWeight] = useState('');
  const [logging, setLogging] = useState(false);
  const [hkWeight, setHkWeight] = useState(null);   // latest from Apple Health
  const [hkStatus, setHkStatus] = useState('idle'); // idle|saving|saved|error
  const inputRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    const [log, p, u] = await Promise.all([
      StorageService.getWeightLog(),
      StorageService.getUserProfile(),
      StorageService.getUnitSystem(),
    ]);
    setWeightLog(log || []);
    setProfile(p);
    setUnitSystem(u);
    // Load latest Apple Health weight (iOS only)
    if (HealthKitService.isAvailable) {
      const hw = await HealthKitService.getLatestWeight(u);
      setHkWeight(hw);
    }
  }

  const wUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const latestEntry = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null;
  const today = new Date().toISOString().split('T')[0];
  const loggedToday = latestEntry?.date === today;

  const startWeight = profile ? parseFloat(profile.currentWeight) : null;
  const targetWeight = profile ? parseFloat(profile.targetWeight) : null;
  const currentWeight = latestEntry?.weight;

  const totalLost =
    startWeight && currentWeight ? (startWeight - currentWeight).toFixed(1) : null;
  const toGoal =
    targetWeight && currentWeight ? Math.abs(currentWeight - targetWeight).toFixed(1) : null;
  const progressPct =
    startWeight && targetWeight && currentWeight
      ? Math.min(
          100,
          Math.max(
            0,
            ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100,
          ),
        )
      : 0;

  async function logWeight() {
    const val = parseFloat(inputWeight);
    if (isNaN(val) || val <= 0 || val > 500 || val < 20) return;
    setLogging(true);
    const updated = await StorageService.addWeightEntry(val, wUnit);
    setWeightLog(updated);
    setInputWeight('');
    setLogging(false);
    inputRef.current?.blur();
    // Mirror to Apple Health
    if (HealthKitService.isAvailable) {
      setHkStatus('saving');
      const kg = wUnit === 'kg' ? val : val / 2.20462;
      const ok = await HealthKitService.saveWeight(kg);
      setHkStatus(ok ? 'saved' : 'error');
    }
  }

  async function importFromHealth() {
    if (!hkWeight) return;
    setLogging(true);
    const updated = await StorageService.addWeightEntry(hkWeight.value, wUnit);
    setWeightLog(updated);
    setHkWeight(null);
    setLogging(false);
  }

  async function deleteEntry(date) {
    Alert.alert('Delete Entry', `Remove weight entry for ${date}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = await StorageService.deleteWeightEntry(date);
          setWeightLog(updated);
        },
      },
    ]);
  }

  const chartWidth = SCREEN_WIDTH - spacing.lg * 2;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Text style={styles.screenTitle}>Weight Tracker</Text>
            <Text style={styles.screenSub}>Track your daily progress</Text>
          </View>

          {/* Log input */}
          <View style={styles.logCard}>
            <Text style={styles.logLabel}>
              {loggedToday ? "Update Today's Weight" : "Log Today's Weight"}
            </Text>

            {/* Apple Health banner — show if Health has a reading not yet imported */}
            {hkWeight && (
              <TouchableOpacity style={styles.hkBanner} onPress={importFromHealth} activeOpacity={0.8}>
                <Ionicons name="heart" size={16} color="#FF2D55" />
                <Text style={styles.hkBannerText}>
                  Apple Health: <Text style={styles.hkBannerVal}>{hkWeight.value} {wUnit}</Text>
                </Text>
                <Text style={styles.hkImport}>Import →</Text>
              </TouchableOpacity>
            )}

            {/* Sync status after logging */}
            {hkStatus === 'saved' && (
              <View style={styles.hkStatusRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.hkStatusText}>Saved to Apple Health</Text>
              </View>
            )}
            {hkStatus === 'error' && (
              <View style={styles.hkStatusRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                <Text style={[styles.hkStatusText, { color: colors.danger }]}>Could not save to Apple Health</Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.weightInput}
                placeholder={latestEntry ? `${latestEntry.weight}` : '0.0'}
                placeholderTextColor={colors.textMuted}
                value={inputWeight}
                onChangeText={setInputWeight}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={logWeight}
              />
              <Text style={styles.unitLabel}>{wUnit}</Text>
              <TouchableOpacity
                style={[styles.logBtn, logging && styles.logBtnDisabled]}
                onPress={logWeight}
                disabled={logging}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={22} color={colors.bg} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard
              label="Current"
              value={currentWeight ? `${currentWeight}` : '--'}
              unit={wUnit}
              color={colors.primary}
              icon="scale"
            />
            <StatCard
              label="Lost"
              value={totalLost && parseFloat(totalLost) > 0 ? totalLost : '0'}
              unit={wUnit}
              color={colors.success}
              icon="trending-down"
            />
            <StatCard
              label="To Goal"
              value={toGoal || '--'}
              unit={toGoal ? wUnit : ''}
              color={colors.secondary}
              icon="flag"
            />
          </View>

          {/* Progress bar */}
          {targetWeight && startWeight && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress to Goal</Text>
                <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
              </View>
              <View style={styles.progressBg}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressSub}>Start: {startWeight} {wUnit}</Text>
                <Text style={styles.progressSub}>Goal: {targetWeight} {wUnit}</Text>
              </View>
            </View>
          )}

          {/* Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Weight History</Text>
            <WeightChart data={weightLog} unit={wUnit} width={chartWidth} height={180} />
          </View>

          {/* History list */}
          {weightLog.length > 0 && (
            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>Recent Entries</Text>
              {[...weightLog].reverse().slice(0, 30).map((entry, i) => (
                <View key={entry.date} style={[styles.historyRow, i === 0 && styles.historyRowToday]}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyDate}>
                      {entry.date === today ? 'Today' : formatDate(entry.date)}
                    </Text>
                    {i === 0 && <View style={styles.latestBadge}><Text style={styles.latestText}>Latest</Text></View>}
                  </View>
                  <Text style={styles.historyWeight}>
                    {entry.weight} <Text style={styles.historyUnit}>{entry.unit}</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteEntry(entry.date)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit, color, icon }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  topBar: { marginBottom: spacing.xs },
  screenTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  screenSub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  logCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  logLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSub },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weightInput: {
    flex: 1,
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlign: 'center',
  },
  unitLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSub,
    minWidth: 30,
  },
  logBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logBtnDisabled: { opacity: 0.5 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: fontSize.lg, fontWeight: '800', marginTop: spacing.xs },
  statUnit: { fontSize: fontSize.xs, color: colors.textMuted },
  statLabel: { fontSize: fontSize.xs, color: colors.textSub, fontWeight: '600' },
  progressCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  progressPct: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
  progressBg: {
    height: 8,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    minWidth: 4,
  },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressSub: { fontSize: fontSize.xs, color: colors.textMuted },
  chartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chartTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, alignSelf: 'flex-start' },
  historyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  historyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyRowToday: { backgroundColor: 'rgba(56,189,248,0.05)', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  historyLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDate: { fontSize: fontSize.sm, color: colors.textSub },
  latestBadge: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  latestText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  historyWeight: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginRight: spacing.sm },
  historyUnit: { fontSize: fontSize.xs, fontWeight: '400', color: colors.textMuted },
  deleteBtn: { padding: spacing.xs },
  hkBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(255,45,85,0.1)', borderRadius: radius.sm,
    padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,45,85,0.2)',
  },
  hkBannerText: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  hkBannerVal: { fontWeight: '700', color: '#FF2D55' },
  hkImport: { fontSize: fontSize.sm, color: '#FF2D55', fontWeight: '700' },
  hkStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hkStatusText: { fontSize: fontSize.xs, color: colors.success },
});
