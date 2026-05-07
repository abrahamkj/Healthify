import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, fontSize } from '../theme';
import { StorageService } from '../services/storageService';
import { AIService } from '../services/aiService';

export default function ApiKeyScreen({ navigation }) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleContinue() {
    const trimmed = apiKey.trim();
    setErrorMsg('');

    if (!trimmed) {
      setErrorMsg('Please enter your Anthropic API key.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setErrorMsg('API key must start with "sk-ant-". Check that you copied it correctly.');
      return;
    }

    setLoading(true);
    try {
      const result = await AIService.validateApiKey(trimmed);
      if (result.valid) {
        await StorageService.setApiKey(trimmed);
        navigation.replace('Onboarding');
      } else {
        setErrorMsg(result.error || 'API key rejected by Anthropic. Please check and try again.');
      }
    } catch (e) {
      setErrorMsg(`Connection failed: ${e.message}. Check your internet connection.`);
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    navigation.replace('Onboarding', { skipAI: true });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={['#1E3A5F', colors.bg]} style={styles.headerGradient}>
            <View style={styles.logoContainer}>
              <Ionicons name="leaf" size={52} color={colors.primary} />
              <Text style={styles.appName}>Healthify</Text>
              <Text style={styles.tagline}>Your AI-powered health companion</Text>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.title}>Get Started</Text>
            <Text style={styles.subtitle}>
              Healthify uses Claude AI to build a personalized diet plan and home exercise routine.
              Enter your Anthropic API key to enable AI features.
            </Text>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your key is stored securely on your device only. Get one free at{' '}
                <Text style={styles.link}>console.anthropic.com</Text>
              </Text>
            </View>

            <Text style={styles.label}>Anthropic API Key</Text>
            <View style={[styles.inputRow, errorMsg ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="sk-ant-api03-..."
                placeholderTextColor={colors.textMuted}
                value={apiKey}
                onChangeText={v => { setApiKey(v); setErrorMsg(''); }}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowKey(v => !v)}>
                <Ionicons
                  name={showKey ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textSub}
                />
              </TouchableOpacity>
            </View>

            {/* Error box */}
            {errorMsg ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <>
                  <ActivityIndicator color={colors.bg} />
                  <Text style={styles.btnText}>Validating key…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.btnText}>Validate & Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.bg} />
                </>
              )}
            </TouchableOpacity>

            {/* Skip option */}
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip for now — explore without AI</Text>
            </TouchableOpacity>

            <View style={styles.steps}>
              <Text style={styles.stepsTitle}>What happens next?</Text>
              {[
                { icon: 'chatbubble-ellipses', text: 'AI asks you 10 personalized health questions' },
                { icon: 'restaurant', text: 'Get a 7-day diet plan using homely foods' },
                { icon: 'barbell', text: 'Receive a 7-day home workout routine' },
                { icon: 'trending-down', text: 'Track your weight progress daily' },
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={step.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  headerGradient: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  logoContainer: { alignItems: 'center', gap: spacing.sm },
  appName: { fontSize: fontSize.xxxl, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  tagline: { fontSize: fontSize.md, color: colors.textSub, marginTop: spacing.xs },
  content: {
    flex: 1,
    padding: spacing.lg,
    marginTop: -spacing.lg,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
  subtitle: { fontSize: fontSize.md, color: colors.textSub, lineHeight: 22, marginBottom: spacing.lg },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  infoText: { flex: 1, fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '600' },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSub,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  inputError: { borderColor: colors.danger },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  eyeBtn: { padding: spacing.md },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    marginBottom: spacing.md,
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.danger, lineHeight: 20 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.bg },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  skipText: { fontSize: fontSize.sm, color: colors.textMuted, textDecorationLine: 'underline' },
  steps: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  stepsTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: 'rgba(56,189,248,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepText: { flex: 1, fontSize: fontSize.sm, color: colors.textSub, lineHeight: 20 },
});
