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
  Alert,
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

  async function handleContinue() {
    const trimmed = apiKey.trim();
    if (!trimmed || !trimmed.startsWith('sk-ant-')) {
      Alert.alert('Invalid Key', 'Please enter a valid Anthropic API key (starts with sk-ant-).');
      return;
    }

    setLoading(true);
    try {
      const valid = await AIService.validateApiKey(trimmed);
      if (!valid) {
        Alert.alert('Invalid Key', 'Could not authenticate with this API key. Please check and try again.');
        return;
      }
      await StorageService.setApiKey(trimmed);
      navigation.replace('Onboarding');
    } catch (e) {
      Alert.alert('Error', 'Failed to validate key. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={['#1E3A5F', colors.bg]}
            style={styles.headerGradient}
          >
            <View style={styles.logoContainer}>
              <Ionicons name="leaf" size={52} color={colors.primary} />
              <Text style={styles.appName}>Healthify</Text>
              <Text style={styles.tagline}>Your AI-powered health companion</Text>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.title}>Get Started</Text>
            <Text style={styles.subtitle}>
              Healthify uses Claude AI to build a personalized diet plan and home
              exercise routine just for you. Enter your Anthropic API key to begin.
            </Text>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your API key is stored securely on your device only. Get a free key at{' '}
                <Text style={styles.link}>console.anthropic.com</Text>
              </Text>
            </View>

            <Text style={styles.label}>Anthropic API Key</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="sk-ant-api03-..."
                placeholderTextColor={colors.textMuted}
                value={apiKey}
                onChangeText={setApiKey}
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

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <>
                  <Text style={styles.btnText}>Validate & Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.bg} />
                </>
              )}
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
  appName: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.textSub,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    marginTop: -spacing.lg,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSub,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
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
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSub,
    lineHeight: 20,
  },
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
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  eyeBtn: { padding: spacing.md },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.bg,
  },
  steps: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  stepsTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(56,189,248,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSub,
    lineHeight: 20,
  },
});
