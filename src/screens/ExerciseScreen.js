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

const DAY_KEYS = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];

function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

export default function ExerciseScreen() {
  const [exercisePlan, setExercisePlan] = useState(null);
  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, []),
  );

  async function loadPlan() {
    const plan = await StorageService.getExercisePlan();
    setExercisePlan(plan);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadPlan();
    setRefreshing(false);
  }

  const dayKey = DAY_KEYS[selectedDay];
  const dayPlan = exercisePlan?.weeklyPlan?.[dayKey];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Exercise Plan</Text>
      </View>

      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {DAY_KEYS.map((key, i) => {
          const name = exercisePlan?.weeklyPlan?.[key]?.dayName ||
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
          const type = exercisePlan?.weeklyPlan?.[key]?.type;
          const isToday = i === getTodayIndex();
          const isSelected = i === selectedDay;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.dayBtn, isSelected && styles.dayBtnSelected]}
              onPress={() => setSelectedDay(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayBtnText, isSelected && styles.dayBtnTextSelected]}>
                {name.slice(0, 3)}
              </Text>
              {type === 'rest' && (
                <Ionicons
                  name="leaf"
                  size={10}
                  color={isSelected ? colors.bg : colors.success}
                />
              )}
              {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {!exercisePlan ? (
          <EmptyState />
        ) : !dayPlan ? (
          <EmptyState message="No plan for this day." />
        ) : dayPlan.type === 'rest' ? (
          <RestDayView day={dayPlan} />
        ) : (
          <WorkoutView day={dayPlan} />
        )}

        {exercisePlan?.tips && exercisePlan.tips.length > 0 && (
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>Fitness Tips</Text>
            {exercisePlan.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name="bulb" size={16} color={colors.warning} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkoutView({ day }) {
  return (
    <>
      {/* Summary card */}
      <LinearGradient colors={['#1E3A5F', colors.bgCard]} style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="barbell" size={28} color={colors.primary} />
          <View>
            <Text style={styles.summaryDay}>{day.dayName}</Text>
            <Text style={styles.summaryType}>Workout Day</Text>
          </View>
        </View>
        <View style={styles.summaryStats}>
          <StatItem icon="time-outline" value={`${day.duration} min`} label="Duration" color={colors.primary} />
          <StatItem icon="flame" value={`~${day.caloriesBurned}`} label="Cal Burned" color={colors.warning} />
          <StatItem icon="list" value={`${(day.exercises || []).length}`} label="Exercises" color={colors.secondary} />
        </View>
      </LinearGradient>

      {/* Warmup */}
      {day.warmup && (
        <View style={styles.warmupCard}>
          <View style={styles.warmupHeader}>
            <Ionicons name="sunny-outline" size={18} color={colors.warning} />
            <Text style={styles.warmupTitle}>Warm Up</Text>
          </View>
          <Text style={styles.warmupText}>{day.warmup}</Text>
        </View>
      )}

      {/* Exercises */}
      <Text style={styles.sectionLabel}>Exercises</Text>
      {(day.exercises || []).map((ex, i) => (
        <ExerciseCard key={i} exercise={ex} index={i + 1} />
      ))}

      {/* Cooldown */}
      {day.cooldown && (
        <View style={styles.warmupCard}>
          <View style={styles.warmupHeader}>
            <Ionicons name="moon-outline" size={18} color={colors.secondary} />
            <Text style={[styles.warmupTitle, { color: colors.secondary }]}>Cool Down</Text>
          </View>
          <Text style={styles.warmupText}>{day.cooldown}</Text>
        </View>
      )}
    </>
  );
}

function RestDayView({ day }) {
  return (
    <View style={styles.restContainer}>
      <LinearGradient colors={['rgba(74,222,128,0.15)', colors.bgCard]} style={styles.restCard}>
        <Ionicons name="leaf" size={48} color={colors.success} />
        <Text style={styles.restTitle}>{day.dayName} — Rest Day</Text>
        <Text style={styles.restSub}>{day.description || 'Active recovery and light movement.'}</Text>
        <View style={styles.restStats}>
          <StatItem icon="time-outline" value={`${day.duration} min`} label="Light Activity" color={colors.success} />
          <StatItem icon="flame" value={`~${day.caloriesBurned}`} label="Cal Burned" color={colors.warning} />
        </View>
      </LinearGradient>

      {(day.activities || []).length > 0 && (
        <View style={styles.activitiesCard}>
          <Text style={styles.sectionLabel}>Suggested Activities</Text>
          {day.activities.map((act, i) => (
            <View key={i} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <Text style={styles.activityText}>{act}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ExerciseCard({ exercise, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.exCard}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.85}
    >
      <View style={styles.exCardTop}>
        <View style={styles.exNum}>
          <Text style={styles.exNumText}>{index}</Text>
        </View>
        <View style={styles.exInfo}>
          <Text style={styles.exName}>{exercise.name}</Text>
          <View style={styles.exTags}>
            <Tag value={`${exercise.sets} sets`} color={colors.primary} />
            <Tag value={exercise.reps} color={colors.secondary} />
            {exercise.restSeconds && (
              <Tag value={`${exercise.restSeconds}s rest`} color={colors.textMuted} />
            )}
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>

      {expanded && (
        <View style={styles.exCardBody}>
          {exercise.description && (
            <>
              <Text style={styles.subLabel}>How to do it</Text>
              <Text style={styles.exDesc}>{exercise.description}</Text>
            </>
          )}
          {exercise.modification && (
            <View style={styles.modCard}>
              <Ionicons name="accessibility" size={14} color={colors.success} />
              <Text style={styles.modText}>
                <Text style={{ fontWeight: '700' }}>Easier version: </Text>
                {exercise.modification}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatItem({ icon, value, label, color }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tag({ value, color }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.tagText, { color }]}>{value}</Text>
    </View>
  );
}

function EmptyState({ message }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="barbell-outline" size={60} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Exercise Plan</Text>
      <Text style={styles.emptyText}>
        {message || 'Complete your health profile to get a personalized 7-day home exercise plan.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  screenTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  daySelector: { maxHeight: 68 },
  daySelectorContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  dayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    minWidth: 52,
    gap: 2,
  },
  dayBtnSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  dayBtnTextSelected: { color: colors.bg },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  todayDotSelected: { backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xxl },
  summaryCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryDay: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  summaryType: { fontSize: fontSize.sm, color: colors.primary },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: fontSize.md, fontWeight: '700' },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  warmupCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  warmupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warmupTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.warning },
  warmupText: { fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  exCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exNum: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(56,189,248,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exNumText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  exInfo: { flex: 1, gap: spacing.xs },
  exName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  exTags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tag: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: fontSize.xs, fontWeight: '600' },
  exCardBody: { marginTop: spacing.md, gap: spacing.sm },
  subLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  exDesc: { fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
  modCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  modText: { flex: 1, fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
  restContainer: { gap: spacing.md },
  restCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  restTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  restSub: {
    fontSize: fontSize.md,
    color: colors.textSub,
    textAlign: 'center',
    lineHeight: 22,
  },
  restStats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  activitiesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  activityText: { fontSize: fontSize.md, color: colors.textSub },
  tipsSection: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tipsTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  tipRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
