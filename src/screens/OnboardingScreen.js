import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { AIService } from '../services/aiService';

const UNIT_OPTIONS = ['Metric (kg, cm)', 'Imperial (lbs, ft/in)'];

export default function OnboardingScreen({ navigation }) {
  const [stage, setStage] = useState('loading'); // loading | unit | questions | generating
  const [unitSystem, setUnitSystem] = useState('metric');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [textValue, setTextValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [progressMsg, setProgressMsg] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      const apiKey = await StorageService.getApiKey();
      const result = await AIService.generateOnboardingQuestions(apiKey);
      setQuestions(result.questions);
      setStage('unit');
    } catch (e) {
      Alert.alert('Error', 'Failed to load questions. Check your internet connection.', [
        { text: 'Retry', onPress: loadQuestions },
      ]);
    }
  }

  function animateIn() {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }

  useEffect(() => {
    if (stage === 'questions') animateIn();
  }, [currentIdx, stage]);

  function handleUnitSelect(unit) {
    const sys = unit.startsWith('Metric') ? 'metric' : 'imperial';
    setUnitSystem(sys);
    StorageService.setUnitSystem(sys);
    setStage('questions');
    animateIn();
  }

  const currentQ = questions[currentIdx];

  function handleNext() {
    const qId = currentQ.id;
    let answer;

    if (currentQ.type === 'number' || currentQ.type === 'text') {
      if (!textValue.trim()) {
        Alert.alert('Required', 'Please enter a value to continue.');
        return;
      }
      answer = textValue.trim();
    } else if (currentQ.type === 'single_choice') {
      if (selectedOptions.length === 0) {
        Alert.alert('Required', 'Please select an option.');
        return;
      }
      answer = selectedOptions[0];
    } else if (currentQ.type === 'multi_choice') {
      if (selectedOptions.length === 0) {
        Alert.alert('Required', 'Please select at least one option.');
        return;
      }
      answer = selectedOptions;
    }

    const newAnswers = { ...answers, [qId]: answer };
    setAnswers(newAnswers);
    setTextValue('');
    setSelectedOptions([]);

    if (currentIdx < questions.length - 1) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      setCurrentIdx(i => i + 1);
    } else {
      finishOnboarding(newAnswers);
    }
  }

  function handleBack() {
    if (currentIdx === 0) {
      setStage('unit');
      return;
    }
    setCurrentIdx(i => i - 1);
    const prev = questions[currentIdx - 1];
    const prevAnswer = answers[prev.id];
    if (Array.isArray(prevAnswer)) {
      setSelectedOptions(prevAnswer);
      setTextValue('');
    } else {
      setTextValue(prevAnswer || '');
      setSelectedOptions([]);
    }
  }

  function toggleOption(opt) {
    if (currentQ.type === 'single_choice') {
      setSelectedOptions([opt]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt],
      );
    }
  }

  async function finishOnboarding(allAnswers) {
    setStage('generating');
    try {
      const apiKey = await StorageService.getApiKey();
      const wUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
      const hUnit = unitSystem === 'metric' ? 'cm' : 'inches';

      const profile = buildProfile(allAnswers, questions, unitSystem);
      await StorageService.setOnboardingAnswers(allAnswers);
      await StorageService.setUserProfile(profile);

      const { dietPlan, exercisePlan } = await AIService.generateHealthPlans(
        apiKey,
        profile,
        unitSystem,
        msg => setProgressMsg(msg),
      );

      await StorageService.setDietPlan(dietPlan);
      await StorageService.setExercisePlan(exercisePlan);
      await StorageService.setLastPlanDate(new Date().toISOString().split('T')[0]);

      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Error', `Failed to generate your plan: ${e.message}`, [
        { text: 'Retry', onPress: () => finishOnboarding(allAnswers) },
      ]);
      setStage('questions');
    }
  }

  if (stage === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your questions...</Text>
      </View>
    );
  }

  if (stage === 'generating') {
    return (
      <View style={styles.centered}>
        <LinearGradient colors={[colors.bgCard, colors.bg]} style={styles.genCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.genTitle}>Building Your Plan</Text>
          <Text style={styles.genMsg}>{progressMsg || 'Analyzing your health profile...'}</Text>
          <View style={styles.genSteps}>
            {['Analyzing profile', 'Creating diet plan', 'Building exercise routine'].map(
              (s, i) => (
                <View key={i} style={styles.genStep}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.genStepText}>{s}</Text>
                </View>
              ),
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (stage === 'unit') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Ionicons name="leaf" size={40} color={colors.primary} />
            <Text style={styles.headerTitle}>Welcome to Healthify</Text>
            <Text style={styles.headerSub}>Let's personalize your experience</Text>
          </View>
          <Text style={styles.questionText}>Which unit system do you prefer?</Text>
          <View style={styles.optionsGrid}>
            {UNIT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.unitCard}
                onPress={() => handleUnitSelect(opt)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={opt.startsWith('Metric') ? 'speedometer-outline' : 'flag-outline'}
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.unitLabel}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!currentQ) return null;

  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.progressLabel}>
          <Text style={styles.progressText}>
            Question {currentIdx + 1} of {questions.length}
          </Text>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.questionScroll}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.questionCard}>
              <View style={styles.qNum}>
                <Text style={styles.qNumText}>{currentIdx + 1}</Text>
              </View>
              <Text style={styles.questionText}>{currentQ.text}</Text>

              {(currentQ.type === 'number' || currentQ.type === 'text') && (
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={currentQ.placeholder || 'Your answer...'}
                    placeholderTextColor={colors.textMuted}
                    value={textValue}
                    onChangeText={setTextValue}
                    keyboardType={currentQ.type === 'number' ? 'decimal-pad' : 'default'}
                    autoFocus
                  />
                  {currentQ.unit && (
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText}>
                        {unitSystem === 'imperial' && currentQ.unit === 'kg'
                          ? 'lbs'
                          : unitSystem === 'imperial' && currentQ.unit === 'cm'
                          ? 'inches'
                          : currentQ.unit}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {(currentQ.type === 'single_choice' || currentQ.type === 'multi_choice') && (
                <View style={styles.optionsList}>
                  {currentQ.type === 'multi_choice' && (
                    <Text style={styles.multiHint}>Select all that apply</Text>
                  )}
                  {(currentQ.options || []).map(opt => {
                    const selected = selectedOptions.includes(opt);
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                        onPress={() => toggleOption(opt)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.optionText, selected && styles.optionTextSelected]}
                        >
                          {opt}
                        </Text>
                        {selected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={colors.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.nextBtnText}>
              {currentIdx === questions.length - 1 ? 'Finish' : 'Next'}
            </Text>
            <Ionicons
              name={currentIdx === questions.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={20}
              color={colors.bg}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildProfile(answers, questions, unitSystem) {
  const map = {};
  questions.forEach(q => {
    map[q.id] = answers[q.id];
  });

  const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const heightUnit = unitSystem === 'metric' ? 'cm' : 'inches';

  return {
    unitSystem,
    weightUnit,
    heightUnit,
    currentWeight: `${map.q1 || '?'} ${weightUnit}`,
    height: `${map.q2 || '?'} ${heightUnit}`,
    age: `${map.q3 || '?'} years`,
    targetWeight: `${map.q4 || '?'} ${weightUnit}`,
    goal: map.q5 || 'Stay Fit',
    dietaryPreference: map.q6 || 'No Restriction',
    activityLevel: map.q7 || 'Sedentary',
    foodAvoid: map.q8 || ['None'],
    medicalConditions: map.q9 || ['None'],
    sleepHours: map.q10 || '7-8 hours',
    rawAnswers: map,
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSub,
  },
  genCard: {
    width: '90%',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  genTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  genMsg: {
    fontSize: fontSize.md,
    color: colors.primary,
    textAlign: 'center',
  },
  genSteps: { width: '100%', marginTop: spacing.md, gap: spacing.sm },
  genStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  genStepText: { fontSize: fontSize.sm, color: colors.textSub },
  scroll: { flexGrow: 1, padding: spacing.lg },
  header: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.text,
  },
  headerSub: {
    fontSize: fontSize.md,
    color: colors.textSub,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.bgCard,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  progressText: { fontSize: fontSize.xs, color: colors.textMuted },
  questionScroll: { flexGrow: 1, padding: spacing.lg },
  questionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  qNum: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(56,189,248,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qNumText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  questionText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 28,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  textInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  unitBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderRadius: radius.sm,
    margin: spacing.sm,
  },
  unitBadgeText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  optionsList: { gap: spacing.sm, marginTop: spacing.sm },
  multiHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  optionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  optionText: {
    fontSize: fontSize.md,
    color: colors.textSub,
    flex: 1,
  },
  optionTextSelected: { color: colors.text, fontWeight: '600' },
  optionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  unitCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nextBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.bg,
  },
});
