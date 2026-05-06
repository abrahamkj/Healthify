import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// expo-secure-store is not available on web; fall back to AsyncStorage
let SecureStore = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const KEYS = {
  API_KEY: 'healthify_api_key',
  USER_PROFILE: 'healthify_user_profile',
  DIET_PLAN: 'healthify_diet_plan',
  EXERCISE_PLAN: 'healthify_exercise_plan',
  WEIGHT_LOG: 'healthify_weight_log',
  ONBOARDING_ANSWERS: 'healthify_onboarding_answers',
  UNIT_SYSTEM: 'healthify_unit_system',
  LAST_PLAN_DATE: 'healthify_last_plan_date',
};

export const StorageService = {
  async getApiKey() {
    try {
      if (SecureStore) return await SecureStore.getItemAsync(KEYS.API_KEY);
      return await AsyncStorage.getItem(KEYS.API_KEY);
    } catch {
      return null;
    }
  },

  async setApiKey(key) {
    if (SecureStore) return await SecureStore.setItemAsync(KEYS.API_KEY, key);
    await AsyncStorage.setItem(KEYS.API_KEY, key);
  },

  async deleteApiKey() {
    if (SecureStore) return await SecureStore.deleteItemAsync(KEYS.API_KEY);
    await AsyncStorage.removeItem(KEYS.API_KEY);
  },

  async getUserProfile() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.USER_PROFILE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setUserProfile(profile) {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  async getDietPlan() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DIET_PLAN);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setDietPlan(plan) {
    await AsyncStorage.setItem(KEYS.DIET_PLAN, JSON.stringify(plan));
  },

  async getExercisePlan() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.EXERCISE_PLAN);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setExercisePlan(plan) {
    await AsyncStorage.setItem(KEYS.EXERCISE_PLAN, JSON.stringify(plan));
  },

  async getWeightLog() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.WEIGHT_LOG);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async addWeightEntry(weight, unit = 'kg') {
    const log = await this.getWeightLog();
    const today = new Date().toISOString().split('T')[0];
    const existing = log.findIndex(e => e.date === today);
    const entry = { date: today, weight: parseFloat(weight), unit, timestamp: Date.now() };
    if (existing >= 0) {
      log[existing] = entry;
    } else {
      log.push(entry);
    }
    log.sort((a, b) => a.date.localeCompare(b.date));
    await AsyncStorage.setItem(KEYS.WEIGHT_LOG, JSON.stringify(log));
    return log;
  },

  async deleteWeightEntry(date) {
    const log = await this.getWeightLog();
    const updated = log.filter(e => e.date !== date);
    await AsyncStorage.setItem(KEYS.WEIGHT_LOG, JSON.stringify(updated));
    return updated;
  },

  async getUnitSystem() {
    try {
      return (await AsyncStorage.getItem(KEYS.UNIT_SYSTEM)) || 'metric';
    } catch {
      return 'metric';
    }
  },

  async setUnitSystem(system) {
    await AsyncStorage.setItem(KEYS.UNIT_SYSTEM, system);
  },

  async getOnboardingAnswers() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ONBOARDING_ANSWERS);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setOnboardingAnswers(answers) {
    await AsyncStorage.setItem(KEYS.ONBOARDING_ANSWERS, JSON.stringify(answers));
  },

  async getLastPlanDate() {
    return AsyncStorage.getItem(KEYS.LAST_PLAN_DATE);
  },

  async setLastPlanDate(date) {
    await AsyncStorage.setItem(KEYS.LAST_PLAN_DATE, date);
  },

  async clearUserData() {
    await AsyncStorage.multiRemove([
      KEYS.USER_PROFILE,
      KEYS.DIET_PLAN,
      KEYS.EXERCISE_PLAN,
      KEYS.WEIGHT_LOG,
      KEYS.ONBOARDING_ANSWERS,
      KEYS.UNIT_SYSTEM,
      KEYS.LAST_PLAN_DATE,
    ]);
  },

  async clearAll() {
    await this.clearUserData();
    try {
      await this.deleteApiKey();
    } catch { /* ignore */ }
  },
};
