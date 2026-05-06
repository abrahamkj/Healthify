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
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';

const DAY_KEYS = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_ICONS = {
  breakfast: 'sunny',
  lunch: 'partly-sunny',
  dinner: 'moon',
  snacks: 'cafe',
};
const MEAL_COLORS = {
  breakfast: '#FB923C',
  lunch: '#38BDF8',
  dinner: '#A78BFA',
  snacks: '#4ADE80',
};

function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

export default function DietPlanScreen() {
  const [dietPlan, setDietPlan] = useState(null);
  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, []),
  );

  async function loadPlan() {
    const plan = await StorageService.getDietPlan();
    setDietPlan(plan);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadPlan();
    setRefreshing(false);
  }

  const dayKey = DAY_KEYS[selectedDay];
  const dayPlan = dietPlan?.weeklyPlan?.[dayKey];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Diet Plan</Text>
        {dietPlan && (
          <View style={styles.calTarget}>
            <Ionicons name="flame" size={14} color={colors.warning} />
            <Text style={styles.calTargetText}>{dietPlan.dailyCalorieTarget} kcal/day</Text>
          </View>
        )}
      </View>

      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {DAY_KEYS.map((key, i) => {
          const name = dietPlan?.weeklyPlan?.[key]?.dayName || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
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
        {!dietPlan ? (
          <EmptyState />
        ) : !dayPlan ? (
          <EmptyState message="No plan data for this day." />
        ) : (
          <>
            <View style={styles.daySummary}>
              <Text style={styles.dayFullName}>{dayPlan.dayName}</Text>
              <View style={styles.row}>
                <Ionicons name="flame" size={16} color={colors.warning} />
                <Text style={styles.dayCal}>{dayPlan.totalCalories} kcal total</Text>
              </View>
            </View>

            {MEAL_ORDER.map(mealType => {
              const data = dayPlan.meals?.[mealType];
              if (!data) return null;
              if (mealType === 'snacks' && Array.isArray(data)) {
                return (
                  <View key={mealType}>
                    <MealSectionHeader type="snacks" />
                    {data.map((snack, i) => (
                      <MealCard key={i} type="snacks" data={snack} />
                    ))}
                  </View>
                );
              }
              return (
                <View key={mealType}>
                  <MealSectionHeader type={mealType} />
                  <MealCard type={mealType} data={data} />
                </View>
              );
            })}

            {dietPlan.waterIntake && (
              <View style={styles.waterCard}>
                <Ionicons name="water" size={22} color="#38BDF8" />
                <View>
                  <Text style={styles.waterTitle}>Water Intake Goal</Text>
                  <Text style={styles.waterVal}>{dietPlan.waterIntake}</Text>
                </View>
              </View>
            )}

            {dietPlan.tips && dietPlan.tips.length > 0 && (
              <View style={styles.tipsSection}>
                <Text style={styles.tipsTitle}>Nutrition Tips</Text>
                {dietPlan.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Ionicons name="bulb" size={16} color={colors.warning} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MealSectionHeader({ type }) {
  const color = MEAL_COLORS[type];
  return (
    <View style={styles.mealHeader}>
      <View style={[styles.mealIconWrap, { backgroundColor: `${color}20` }]}>
        <Ionicons name={MEAL_ICONS[type]} size={16} color={color} />
      </View>
      <Text style={styles.mealHeaderText}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
    </View>
  );
}

function MealCard({ type, data }) {
  const [expanded, setExpanded] = useState(false);
  const color = MEAL_COLORS[type];

  return (
    <TouchableOpacity
      style={styles.mealCard}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.85}
    >
      <View style={styles.mealCardTop}>
        <View style={styles.mealCardLeft}>
          <Text style={styles.mealCardName}>{data.name}</Text>
          <View style={styles.row}>
            {data.prepTime && (
              <View style={styles.tag}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.tagText}>{data.prepTime}</Text>
              </View>
            )}
            <View style={[styles.tag, { backgroundColor: `${color}20` }]}>
              <Ionicons name="flame" size={12} color={color} />
              <Text style={[styles.tagText, { color }]}>{data.calories} kcal</Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>

      {expanded && (
        <View style={styles.mealCardBody}>
          <Text style={styles.subLabel}>Ingredients</Text>
          {(data.items || []).map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={[styles.itemDot, { backgroundColor: color }]} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
          {data.instructions && (
            <>
              <Text style={[styles.subLabel, { marginTop: spacing.sm }]}>How to Prepare</Text>
              <Text style={styles.instructions}>{data.instructions}</Text>
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ message }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="restaurant-outline" size={60} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Diet Plan</Text>
      <Text style={styles.emptyText}>
        {message || 'Complete your health profile to get a personalized 7-day diet plan.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  screenTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  calTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,146,60,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  calTargetText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.warning },
  daySelector: { maxHeight: 64 },
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
  },
  dayBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  dayBtnTextSelected: { color: colors.bg },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  todayDotSelected: { backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  daySummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dayFullName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dayCal: { fontSize: fontSize.sm, color: colors.warning, fontWeight: '600' },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  mealIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealHeaderText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  mealCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealCardLeft: { flex: 1, gap: spacing.xs },
  mealCardName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: fontSize.xs, color: colors.textMuted },
  mealCardBody: { marginTop: spacing.md, gap: spacing.xs },
  subLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemDot: { width: 6, height: 6, borderRadius: radius.full },
  itemText: { fontSize: fontSize.sm, color: colors.textSub, flex: 1 },
  instructions: {
    fontSize: fontSize.sm,
    color: colors.textSub,
    lineHeight: 20,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  waterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    marginTop: spacing.sm,
  },
  waterTitle: { fontSize: fontSize.sm, color: colors.textSub },
  waterVal: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
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
