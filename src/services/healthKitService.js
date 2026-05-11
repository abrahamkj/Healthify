import { Platform } from 'react-native';

// Only required on iOS — prevents bundler errors on web/Android
let HK = null;
if (Platform.OS === 'ios') {
  try { HK = require('react-native-health').default; } catch {}
}

const PERMS = HK ? {
  permissions: {
    read: [
      HK.Constants.Permissions.Weight,
      HK.Constants.Permissions.StepCount,
      HK.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [
      HK.Constants.Permissions.Weight,
      HK.Constants.Permissions.Workout,
    ],
  },
} : null;

let _initialized = false;

async function ensureInit() {
  if (!HK || _initialized) return _initialized;
  return new Promise((resolve) => {
    HK.initHealthKit(PERMS, (err) => {
      if (!err) _initialized = true;
      resolve(!err);
    });
  });
}

const kgToLbs = (kg) => kg * 2.20462;
const lbsToKg = (lbs) => lbs / 2.20462;

export const HealthKitService = {
  isAvailable: Platform.OS === 'ios',

  async initialize() {
    if (Platform.OS !== 'ios') return { success: false, reason: 'not-ios' };
    const ok = await ensureInit();
    return { success: ok };
  },

  // Returns { value, date } in the app's unit system, or null
  async getLatestWeight(unitSystem = 'metric') {
    if (!await ensureInit()) return null;
    return new Promise((resolve) => {
      HK.getLatestWeight({ unit: 'pound' }, (err, result) => {
        if (err || !result?.value) { resolve(null); return; }
        const kg = lbsToKg(result.value);
        resolve({
          value: unitSystem === 'metric'
            ? Math.round(kg * 10) / 10
            : Math.round(result.value * 10) / 10,
          date: result.startDate,
        });
      });
    });
  },

  // weightKg: number in kg (convert if needed before calling)
  async saveWeight(weightKg, isoDate) {
    if (!await ensureInit()) return false;
    return new Promise((resolve) => {
      HK.saveWeight(
        { value: kgToLbs(weightKg), date: isoDate || new Date().toISOString() },
        (err) => resolve(!err),
      );
    });
  },

  async getTodaySteps() {
    if (!await ensureInit()) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return new Promise((resolve) => {
      HK.getStepCount({ date: start.toISOString() }, (err, result) => {
        resolve(err ? null : Math.round(result?.value || 0));
      });
    });
  },

  async getTodayActiveCalories() {
    if (!await ensureInit()) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return new Promise((resolve) => {
      HK.getActiveEnergyBurned(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        (err, results) => {
          if (err || !results?.length) { resolve(null); return; }
          resolve(Math.round(results.reduce((s, r) => s + (r.value || 0), 0)));
        },
      );
    });
  },

  // durationMinutes, caloriesBurned, startDateISO optional (defaults to now)
  async saveWorkout({ durationMinutes, caloriesBurned, startDateISO }) {
    if (!await ensureInit()) return false;
    const start = new Date(startDateISO || Date.now() - durationMinutes * 60 * 1000);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return new Promise((resolve) => {
      HK.saveWorkout({
        type: HK.Constants.Activities.FunctionalStrengthTraining,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        duration: durationMinutes * 60,
        energyBurned: caloriesBurned,
        energyBurnedUnit: 'calorie',
      }, (err) => resolve(!err));
    });
  },
};
