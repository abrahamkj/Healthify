import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { AIService } from '../services/aiService';

const UNIT_OPTIONS = ['Metric (kg, cm)', 'Imperial (lbs, ft/in)'];

const BASE_QUESTIONS = [
  { id: 'q1', text: 'What is your current weight?', type: 'number', unit: 'kg', placeholder: 'e.g. 70' },
  { id: 'q2', text: 'What is your height?', type: 'number', unit: 'cm', placeholder: 'e.g. 170' },
  { id: 'q3', text: 'How old are you?', type: 'number', unit: 'years', placeholder: 'e.g. 28' },
  { id: 'q4', text: 'What is your target weight?', type: 'number', unit: 'kg', placeholder: 'e.g. 60' },
  { id: 'q5', text: 'What is your primary health goal?', type: 'single_choice', options: ['Weight Loss', 'Build Muscle', 'Stay Fit', 'Improve Energy', 'Manage Health Condition'] },
  { id: 'q6', text: 'What is your dietary preference?', type: 'single_choice', options: ['No Restriction', 'Vegetarian', 'Vegan', 'Non-Vegetarian', 'Gluten Free'] },
  { id: 'q7', text: 'What is your current activity level?', type: 'single_choice', options: ['Sedentary (desk job)', 'Lightly Active', 'Moderately Active', 'Very Active'] },
  { id: 'q8', text: 'Any foods you want to avoid?', type: 'multi_choice', options: ['Dairy', 'Nuts', 'Eggs', 'Seafood', 'Gluten', 'Soy', 'None'] },
  { id: 'q9', text: 'Any medical conditions we should consider?', type: 'multi_choice', options: ['Diabetes', 'Hypertension', 'High Cholesterol', 'Thyroid Issues', 'None'] },
  { id: 'q10', text: 'How many hours do you sleep per night?', type: 'single_choice', options: ['Less than 5 hours', '5-6 hours', '7-8 hours', 'More than 8 hours'] },
];

// Returns extra follow-up questions based on a given answer
function getFollowUps(questionId, answer, unitSystem) {
  const wUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const extras = [];
  if (questionId === 'q5') {
    if (answer === 'Manage Health Condition') {
      extras.push({ id: 'q5a', text: 'Which condition are you primarily managing?', type: 'single_choice', options: ['Type 2 Diabetes', 'Hypertension / BP', 'PCOS', 'Heart Disease', 'Obesity', 'Other'] });
    }
    if (answer === 'Weight Loss') {
      extras.push({ id: 'q5b', text: 'How long have you been trying to lose weight?', type: 'single_choice', options: ['Just starting', '1-3 months', '3-6 months', 'More than 6 months'] });
    }
  }
  if (questionId === 'q7') {
    if (answer === 'Sedentary (desk job)' || answer === 'Lightly Active') {
      extras.push({ id: 'q7a', text: 'How much time can you give for exercise each day?', type: 'single_choice', options: ['10-15 minutes', '20-30 minutes', '30-45 minutes', 'More than 45 minutes'] });
    }
  }
  if (questionId === 'q6') {
    if (['Vegetarian', 'Vegan'].includes(answer)) {
      extras.push({ id: 'q6a', text: 'What is your main protein source?', type: 'multi_choice', options: ['Lentils / Dal', 'Chickpeas / Beans', 'Paneer / Tofu', 'Nuts / Seeds', 'Protein Powder'] });
    }
  }
  if (questionId === 'q9') {
    const selected = Array.isArray(answer) ? answer : [answer];
    if (!selected.includes('None')) {
      extras.push({ id: 'q9a', text: 'Are you currently on medication for your condition?', type: 'single_choice', options: ['Yes, on medication', 'No medication', 'Managing through diet/lifestyle'] });
    }
  }
  return extras;
}

export default function OnboardingScreen({ navigation, route }) {
  const skipAI = route?.params?.skipAI === true;
  const [stage, setStage] = useState('loading');
  const [unitSystem, setUnitSystem] = useState('metric');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [textValue, setTextValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [progressMsg, setProgressMsg] = useState('');
  const [genError, setGenError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => { loadQuestions(); }, []);

  async function loadQuestions() {
    if (skipAI) { setQuestions(BASE_QUESTIONS); setStage('unit'); return; }
    try {
      const apiKey = await StorageService.getApiKey();
      if (!apiKey) { setQuestions(BASE_QUESTIONS); setStage('unit'); return; }
      const result = await AIService.generateOnboardingQuestions(apiKey);
      setQuestions(result.questions?.length > 0 ? result.questions : BASE_QUESTIONS);
      setStage('unit');
    } catch {
      setQuestions(BASE_QUESTIONS);
      setStage('unit');
    }
  }

  function animateIn() {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  useEffect(() => { if (stage === 'questions') animateIn(); }, [currentIdx, stage]);

  function handleUnitSelect(opt) {
    const sys = opt.startsWith('Metric') ? 'metric' : 'imperial';
    setUnitSystem(sys);
    StorageService.setUnitSystem(sys);
    setStage('questions');
    animateIn();
  }

  const currentQ = questions[currentIdx];

  function handleNext() {
    let answer;
    if (currentQ.type === 'number' || currentQ.type === 'text') {
      if (!textValue.trim()) { Alert.alert('Required', 'Please enter a value.'); return; }
      answer = textValue.trim();
    } else if (currentQ.type === 'single_choice') {
      if (!selectedOptions.length) { Alert.alert('Required', 'Please select an option.'); return; }
      answer = selectedOptions[0];
    } else {
      if (!selectedOptions.length) { Alert.alert('Required', 'Please select at least one option.'); return; }
      answer = selectedOptions;
    }

    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);

    // Inject adaptive follow-up questions right after current position
    const followUps = getFollowUps(currentQ.id, answer, unitSystem);
    let updatedQuestions = questions;
    if (followUps.length > 0) {
      const alreadyAdded = followUps.every(fq => questions.find(q => q.id === fq.id));
      if (!alreadyAdded) {
        updatedQuestions = [
          ...questions.slice(0, currentIdx + 1),
          ...followUps,
          ...questions.slice(currentIdx + 1),
        ];
        setQuestions(updatedQuestions);
      }
    }

    setTextValue('');
    setSelectedOptions([]);

    if (currentIdx < updatedQuestions.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      finishOnboarding(newAnswers, updatedQuestions);
    }
  }

  function handleBack() {
    if (currentIdx === 0) { setStage('unit'); return; }
    const prev = questions[currentIdx - 1];
    const prevAns = answers[prev.id];
    if (Array.isArray(prevAns)) { setSelectedOptions(prevAns); setTextValue(''); }
    else { setTextValue(prevAns || ''); setSelectedOptions([]); }
    setCurrentIdx(i => i - 1);
  }

  function toggleOption(opt) {
    if (currentQ.type === 'single_choice') { setSelectedOptions([opt]); return; }
    setSelectedOptions(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  }

  async function finishOnboarding(allAnswers, qs) {
    const profile = buildProfile(allAnswers, qs || questions, unitSystem);
    await StorageService.setOnboardingAnswers(allAnswers);
    await StorageService.setUserProfile(profile);

    const apiKey = await StorageService.getApiKey();
    if (!apiKey || skipAI) { navigation.replace('Main'); return; }

    setStage('generating');
    setGenError('');

    try {
      const { dietPlan, exercisePlan } = await AIService.generateHealthPlans(
        apiKey, profile, unitSystem,
        msg => setProgressMsg(msg),
      );
      await StorageService.setDietPlan(dietPlan);
      await StorageService.setExercisePlan(exercisePlan);
      await StorageService.setLastPlanDate(new Date().toISOString().split('T')[0]);
      navigation.replace('Main');
    } catch (e) {
      setGenError(e.message);
    }
  }

  // ── Loading ──────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your questions...</Text>
      </View>
    );
  }

  // ── Generating plans ─────────────────────────────────────
  if (stage === 'generating') {
    return (
      <View style={styles.centered}>
        <LinearGradient colors={[colors.bgCard, colors.bg]} style={styles.genCard}>
          {genError ? (
            <>
              <Ionicons name="alert-circle" size={44} color={colors.danger} />
              <Text style={styles.genTitle}>Plan Generation Failed</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{genError}</Text>
              </View>
              <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.replace('Main')}>
                <Text style={styles.retryBtnText}>Go to App (retry from Settings)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.genTitle}>Building Your Plan</Text>
              <Text style={styles.genMsg}>{progressMsg || 'Starting...'}</Text>
              <Text style={styles.genNote}>This may take 30–60 seconds. Please wait.</Text>
            </>
          )}
        </LinearGradient>
      </View>
    );
  }

  // ── Unit selection ────────────────────────────────────────
  if (stage === 'unit') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Ionicons name="leaf" size={40} color={colors.primary} />
            <Text style={styles.headerTitle}>Welcome to Healthify</Text>
            <Text style={styles.headerSub}>Let's personalise your experience</Text>
          </View>
          <Text style={styles.questionText}>Which unit system do you prefer?</Text>
          <View style={styles.optionsGrid}>
            {UNIT_OPTIONS.map(opt => (
              <TouchableOpacity key={opt} style={styles.unitCard} onPress={() => handleUnitSelect(opt)} activeOpacity={0.8}>
                <Ionicons name={opt.startsWith('Metric') ? 'speedometer-outline' : 'flag-outline'} size={32} color={colors.primary} />
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
  const isAdaptive = currentQ.id.includes('a') || currentQ.id.includes('b');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressLabel}>
          <Text style={styles.progressText}>Question {currentIdx + 1} of {questions.length}</Text>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        <ScrollView contentContainerStyle={styles.questionScroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.questionCard}>
              {isAdaptive && (
                <View style={styles.followUpBadge}>
                  <Ionicons name="git-branch-outline" size={12} color={colors.secondary} />
                  <Text style={styles.followUpText}>Follow-up question</Text>
                </View>
              )}
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
                        {unitSystem === 'imperial' && currentQ.unit === 'kg' ? 'lbs'
                          : unitSystem === 'imperial' && currentQ.unit === 'cm' ? 'in'
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
                    const sel = selectedOptions.includes(opt);
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.optionBtn, sel && styles.optionBtnSelected]}
                        onPress={() => toggleOption(opt)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
                        {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
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
            <Ionicons name={currentIdx === questions.length - 1 ? 'checkmark' : 'arrow-forward'} size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildProfile(answers, questions, unitSystem) {
  const map = {};
  questions.forEach(q => { if (answers[q.id] !== undefined) map[q.id] = answers[q.id]; });
  const wUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const hUnit = unitSystem === 'metric' ? 'cm' : 'inches';
  return {
    unitSystem, weightUnit: wUnit, heightUnit: hUnit,
    currentWeight: `${map.q1 || '?'} ${wUnit}`,
    height: `${map.q2 || '?'} ${hUnit}`,
    age: `${map.q3 || '?'} years`,
    targetWeight: `${map.q4 || '?'} ${wUnit}`,
    goal: map.q5 || 'Stay Fit',
    specificCondition: map.q5a || null,
    goalDuration: map.q5b || null,
    dietaryPreference: map.q6 || 'No Restriction',
    proteinSources: map.q6a || null,
    activityLevel: map.q7 || 'Sedentary',
    exerciseTimeAvailable: map.q7a || null,
    foodAvoid: map.q8 || ['None'],
    medicalConditions: map.q9 || ['None'],
    onMedication: map.q9a || null,
    sleepHours: map.q10 || '7-8 hours',
    rawAnswers: map,
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSub },
  genCard: { width: '100%', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  genTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  genMsg: { fontSize: fontSize.md, color: colors.primary, textAlign: 'center' },
  genNote: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', width: '100%' },
  errorBoxText: { fontSize: fontSize.sm, color: colors.danger, lineHeight: 20 },
  retryBtn: { backgroundColor: colors.bgCardAlt, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: spacing.sm },
  retryBtnText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  scroll: { flexGrow: 1, padding: spacing.lg },
  header: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: fontSize.md, color: colors.textSub },
  progressBar: { height: 4, backgroundColor: colors.bgCard },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  progressText: { fontSize: fontSize.xs, color: colors.textMuted },
  questionScroll: { flexGrow: 1, padding: spacing.lg },
  questionCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  followUpBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  followUpText: { fontSize: 11, color: colors.secondary, fontWeight: '600' },
  qNum: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: 'rgba(56,189,248,0.15)', justifyContent: 'center', alignItems: 'center' },
  qNumText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  questionText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, lineHeight: 28 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  textInput: { flex: 1, padding: spacing.md, fontSize: fontSize.lg, color: colors.text },
  unitBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(56,189,248,0.15)', borderRadius: radius.sm, margin: spacing.sm },
  unitBadgeText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  optionsList: { gap: spacing.sm, marginTop: spacing.sm },
  multiHint: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  optionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bgCardAlt, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: 'rgba(56,189,248,0.1)' },
  optionText: { fontSize: fontSize.md, color: colors.textSub, flex: 1 },
  optionTextSelected: { color: colors.text, fontWeight: '600' },
  optionsGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  unitCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  unitLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, textAlign: 'center' },
  navRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  backBtn: { width: 50, height: 50, borderRadius: radius.full, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  nextBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  nextBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.bg },
});
