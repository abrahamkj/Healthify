import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { HealthKitService } from '../services/healthKitService';

const DAYS = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];

function getDayIndex() {
  return new Date().getDay(); // 0=Sun
}

function getTodayKey() {
  const d = getDayIndex();
  return DAYS[d === 0 ? 6 : d - 1];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function DashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [dietPlan, setDietPlan] = useState(null);
  const [exercisePlan, setExercisePlan] = useState(null);
  const [weightLog, setWeightLog] = useState([]);
  const [unitSystem, setUnitSystem] = useState('metric');
  const [refreshing, setRefreshing] = useState(false);
  const [steps, setSteps] = useState(null);
  const [activeCalories, setActiveCalories] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    const [p, d, e, w, u] = await Promise.all([
      StorageService.getUserProfile(),
      StorageService.getDietPlan(),
      StorageService.getExercisePlan(),
      StorageService.getWeightLog(),
      StorageService.getUnitSystem(),
    ]);
    setProfile(p);
    setDietPlan(d);
    setExercisePlan(e);
    setWeightLog(w || []);
    setUnitSystem(u);
    if (HealthKitService.isAvailable) {
      const [s, ac] = await Promise.all([
        HealthKitService.getTodaySteps(),
        HealthKitService.getTodayActiveCalories(),
      ]);
      setSteps(s);
      setActiveCalories(ac);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const todayKey = getTodayKey();
  const todayDiet = dietPlan?.weeklyPlan?.[todayKey];
  const todayExercise = exercisePlan?.weeklyPlan?.[todayKey];
  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null;
  const wUnit = unitSystem === 'metric' ? 'kg' : 'lbs';

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const weightLost =
    profile && latestWeight
      ? (() => {
          const start = parseFloat(profile.currentWeight);
          const cur = latestWeight.weight;
          return (start - cur).toFixed(1);
        })()
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient colors={['#1E3A5F', colors.bg]} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{profile?.name || 'Friend'} 👋</Text>
            <Text style={styles.date}>{todayDate}</Text>
          </View>
          <View style={styles.leafWrap}>
            <Ionicons name="leaf" size={32} color={colors.primary} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatCard
              icon="flame"
              iconColor={colors.warning}
              label="Calories"
              value={dietPlan?.dailyCalorieTarget ? `${dietPlan.dailyCalorieTarget}` : '--'}
              sub="daily target"
            />
            <StatCard
              icon="scale"
              iconColor={colors.primary}
              label="Weight"
              value={latestWeight ? `${latestWeight.weight}` : '--'}
              sub={wUnit}
            />
            <StatCard
              icon="trending-down"
              iconColor={colors.success}
              label="Lost"
              value={weightLost && parseFloat(weightLost) > 0 ? weightLost : '0'}
              sub={wUnit}
            />
          </View>

          {/* Apple Health activity row */}
          {(steps !== null || activeCalories !== null) && (
            <View style={styles.hkRow}>
              <Ionicons name="heart" size={14} color="#FF2D55" />
              <Text style={styles.hkLabel}>From Apple Health  </Text>
              {steps !== null && (
                <View style={styles.hkPill}>
                  <Ionicons name="footsteps-outline" size={13} color={colors.primary} />
                  <Text style={styles.hkPillText}>{steps.toLocaleString()} steps</Text>
                </View>
              )}
              {activeCalories !== null && (
                <View style={styles.hkPill}>
                  <Ionicons name="flame" size={13} color={colors.warning} />
                  <Text style={styles.hkPillText}>{activeCalories} kcal</Text>
                </View>
              )}
            </View>
          )}

          {/* Today's Diet */}
          <SectionHeader title="Today's Meals" icon="restaurant" onPress={() => navigation.getParent()?.navigate('Diet')} />
          {todayDiet ? (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardDay}>{todayDiet.dayName}</Text>
                <View style={styles.calBadge}>
                  <Ionicons name="flame" size={14} color={colors.warning} />
                  <Text style={styles.calBadgeText}>{todayDiet.totalCalories} kcal</Text>
                </View>
              </View>
              {['breakfast', 'lunch', 'dinner'].map(meal => {
                const m = todayDiet.meals?.[meal];
                if (!m) return null;
                return (
                  <View key={meal} style={styles.mealRow}>
                    <View style={styles.mealDot} />
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealType}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Text>
                      <Text style={styles.mealName}>{m.name}</Text>
                    </View>
                    <Text style={styles.mealCal}>{m.calories} kcal</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyCard message="No diet plan yet. Complete onboarding to get started." />
          )}

          {/* Today's Exercise */}
          <SectionHeader title="Today's Workout" icon="barbell" onPress={() => navigation.getParent()?.navigate('Exercise')} />
          {todayExercise ? (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: todayExercise.type === 'rest' ? 'rgba(74,222,128,0.15)' : 'rgba(56,189,248,0.15)' },
                    ]}
                  >
                    <Ionicons
                      name={todayExercise.type === 'rest' ? 'leaf' : 'barbell'}
                      size={14}
                      color={todayExercise.type === 'rest' ? colors.success : colors.primary}
                    />
                    <Text
                      style={[
                        styles.typeText,
                        { color: todayExercise.type === 'rest' ? colors.success : colors.primary },
                      ]}
                    >
                      {todayExercise.type === 'rest' ? 'Rest Day' : 'Workout'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.durationText}>
                  {todayExercise.duration} min · ~{todayExercise.caloriesBurned} kcal
                </Text>
              </View>
              {todayExercise.type === 'workout' &&
                (todayExercise.exercises || []).slice(0, 3).map((ex, i) => (
                  <View key={i} style={styles.exRow}>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exDetail}>
                      {ex.sets} × {ex.reps}
                    </Text>
                  </View>
                ))}
              {todayExercise.type === 'rest' &&
                (todayExercise.activities || []).map((a, i) => (
                  <View key={i} style={styles.exRow}>
                    <Ionicons name="checkmark" size={14} color={colors.success} />
                    <Text style={styles.exName}>{a}</Text>
                  </View>
                ))}
            </View>
          ) : (
            <EmptyCard message="No exercise plan yet. Complete onboarding to get started." />
          )}

          {/* Weight quick log */}
          <SectionHeader title="Weight" icon="scale" onPress={() => navigation.getParent()?.navigate('Weight')} />
          <TouchableOpacity
            style={styles.weightLogCard}
            onPress={() => navigation.getParent()?.navigate('Weight')}
            activeOpacity={0.8}
          >
            {latestWeight ? (
              <>
                <View>
                  <Text style={styles.weightValue}>
                    {latestWeight.weight} {wUnit}
                  </Text>
                  <Text style={styles.weightDate}>Last logged: {latestWeight.date}</Text>
                </View>
                <View style={styles.logBtn}>
                  <Ionicons name="add" size={22} color={colors.bg} />
                  <Text style={styles.logBtnText}>Log</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.weightValue}>Log Weight</Text>
                <View style={styles.logBtn}>
                  <Ionicons name="add" size={22} color={colors.bg} />
                  <Text style={styles.logBtnText}>Start</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Tips */}
          {dietPlan?.tips && dietPlan.tips.length > 0 && (
            <>
              <SectionHeader title="Today's Tip" icon="bulb" />
              <View style={[styles.card, styles.tipCard]}>
                <Ionicons name="bulb" size={20} color={colors.warning} />
                <Text style={styles.tipText}>
                  {dietPlan.tips[new Date().getDate() % dietPlan.tips.length]}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, icon, onPress }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onPress && (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatCard({ icon, iconColor, label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({ message }) {
  return (
    <View style={[styles.card, styles.emptyCard]}>
      <Ionicons name="leaf-outline" size={32} color={colors.textMuted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { fontSize: fontSize.sm, color: colors.textSub },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: 2 },
  date: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  leafWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: 'rgba(56,189,248,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: spacing.lg, gap: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  statSub: { fontSize: fontSize.xs, color: colors.textMuted },
  statLabel: { fontSize: fontSize.xs, color: colors.textSub, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: fontSize.sm, color: colors.primary },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardDay: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  calBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,146,60,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  calBadgeText: { fontSize: fontSize.xs, color: colors.warning, fontWeight: '600' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mealDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  mealInfo: { flex: 1 },
  mealType: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase' },
  mealName: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  mealCal: { fontSize: fontSize.xs, color: colors.textSub },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  typeText: { fontSize: fontSize.xs, fontWeight: '700' },
  durationText: { fontSize: fontSize.xs, color: colors.textMuted },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  exName: { flex: 1, fontSize: fontSize.sm, color: colors.textSub },
  exDetail: { fontSize: fontSize.xs, color: colors.textMuted },
  weightLogCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weightValue: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  weightDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.bg },
  tipCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  hkRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.sm, paddingHorizontal: spacing.md,
  },
  hkLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  hkPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bgCardAlt, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  hkPillText: { fontSize: fontSize.xs, color: colors.text, fontWeight: '600' },
});
