const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-6';

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'anthropic-version': API_VERSION,
  'anthropic-dangerous-direct-browser-access': 'true',
};

function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

async function callClaude(apiKey, prompt, maxTokens = 2000, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { ...BASE_HEADERS, 'x-api-key': apiKey },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw new Error(`Network error: ${e.message}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Anthropic error (${response.status}): ${msg}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from API.');
  return text;
}

function parseJSON(text, label) {
  const json = extractJSON(text);
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`${label} parse failed: ${e.message}. Raw: ${json.slice(0, 200)}`);
  }
}

const DIET_CONTEXT = (profile, weightUnit) =>
  `Profile: ${JSON.stringify(profile)}
RULES:
- Region: ${profile.location || 'not specified'} — use authentic local homely food from this region
- Meals per day: ${profile.mealsPerDay || '3 meals'}
- Max cooking time available: ${profile.cookingTimePerDay || '30 min'}
- Current water intake: ${profile.currentWaterIntake || 'unknown'} — suggest improvement if low
- Stress level: ${profile.stressLevel || 'unknown'}${profile.stressEatingHabit ? ` — eating habit: ${profile.stressEatingHabit}` : ''}
- Diet preference: ${profile.dietaryPreference}, avoid: ${JSON.stringify(profile.foodAvoid)}
- Goal: ${profile.goal}, weight unit: ${weightUnit}
Each meal needs: name, items (array), calories (number), prepTime, instructions.`;

const EXERCISE_CONTEXT = (profile) =>
  `Profile: ${JSON.stringify(profile)}
RULES: zero equipment, home only, activity level: ${profile.activityLevel}, conditions: ${JSON.stringify(profile.medicalConditions)}, goal: ${profile.goal}.
Workout days: 4-6 exercises each with name, sets, reps, restSeconds, description, modification. Rest days: activities array + description.`;

export const AIService = {
  async validateApiKey(apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...BASE_HEADERS, 'x-api-key': apiKey },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      clearTimeout(timer);

      if (response.ok) return { valid: true };
      const body = await response.json().catch(() => ({}));
      const msg = body?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) return { valid: false, error: `Invalid API key: ${msg}` };
      if (response.status === 403) return { valid: false, error: `Access denied: ${msg}` };
      if (response.status === 429) return { valid: false, error: 'Rate limit hit. Wait a moment and try again.' };
      return { valid: false, error: `Anthropic error (${response.status}): ${msg}` };
    } catch (e) {
      if (e.name === 'AbortError') return { valid: false, error: 'Timed out after 15s. Check your internet.' };
      throw e;
    }
  },

  async generateOnboardingQuestions(apiKey) {
    const text = await callClaude(
      apiKey,
      `Generate exactly 10 health onboarding questions for a personal health app.
Return ONLY a valid JSON object, no markdown, no explanation:
{"questions":[{"id":"q1","text":"?","type":"single_choice","options":["A","B"]}]}

Types: "number" (add "unit" and "placeholder"), "single_choice", "multi_choice" (add "options").

Questions to generate:
1. Current weight - number, unit: kg, placeholder: e.g. 70
2. Height - number, unit: cm, placeholder: e.g. 170
3. Age - number, unit: years, placeholder: e.g. 28
4. Target weight - number, unit: kg, placeholder: e.g. 60
5. Primary goal - single_choice: Weight Loss / Build Muscle / Stay Fit / Improve Energy / Manage Health Condition
6. Dietary preference - single_choice: No Restriction / Vegetarian / Vegan / Non-Vegetarian / Gluten Free
7. Activity level - single_choice: Sedentary (desk job) / Lightly Active / Moderately Active / Very Active
8. Foods to avoid - multi_choice: Dairy / Nuts / Eggs / Seafood / Gluten / Soy / None
9. Medical conditions - multi_choice: Diabetes / Hypertension / High Cholesterol / Thyroid Issues / None
10. Sleep per night - single_choice: Less than 5 hours / 5-6 hours / 7-8 hours / More than 8 hours`,
      2000,
    );
    return JSON.parse(extractJSON(text));
  },

  async generateDietPlan(apiKey, userProfile, unitSystem, onProgress) {
    const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
    const ctx = DIET_CONTEXT(userProfile, weightUnit);
    // Compact single-day template so prompts stay short
    const D = '{"dayName":"","totalCalories":0,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[{"name":"","items":[],"calories":0,"instructions":""}]}}';

    // Part 1: global settings + days 1-2
    onProgress('Diet plan: generating days 1–2 of 7...');
    const part1 = parseJSON(
      await callClaude(apiKey,
        `Personalized diet plan — ONLY days 1 (Monday) and 2 (Tuesday).
${ctx}
Return ONLY this JSON with both days filled:
{"dailyCalorieTarget":1800,"proteinTarget":"80g","waterIntake":"8 glasses","tips":["tip1","tip2","tip3"],"weeklyPlan":{"day1":${D},"day2":${D}}}`,
        2800,
      ),
      'Diet plan part 1',
    );

    // Part 2: days 3-4
    onProgress('Diet plan: generating days 3–4 of 7...');
    const part2 = parseJSON(
      await callClaude(apiKey,
        `Continue the same diet plan — ONLY days 3 (Wednesday) and 4 (Thursday).
${ctx}
Daily calorie target: ${part1.dailyCalorieTarget} kcal.
Return ONLY this JSON with both days filled:
{"weeklyPlan":{"day3":${D},"day4":${D}}}`,
        2800,
      ),
      'Diet plan part 2',
    );

    // Part 3: days 5-6-7
    onProgress('Diet plan: generating days 5–7 of 7...');
    const part3 = parseJSON(
      await callClaude(apiKey,
        `Continue the same diet plan — ONLY days 5 (Friday), 6 (Saturday) and 7 (Sunday).
${ctx}
Daily calorie target: ${part1.dailyCalorieTarget} kcal.
Return ONLY this JSON with all 3 days filled:
{"weeklyPlan":{"day5":${D},"day6":${D},"day7":${D}}}`,
        3500,
      ),
      'Diet plan part 3',
    );

    return {
      dailyCalorieTarget: part1.dailyCalorieTarget,
      proteinTarget: part1.proteinTarget,
      waterIntake: part1.waterIntake,
      tips: part1.tips,
      weeklyPlan: { ...part1.weeklyPlan, ...part2.weeklyPlan, ...part3.weeklyPlan },
    };
  },

  async generateExercisePlan(apiKey, userProfile, onProgress) {
    const ctx = EXERCISE_CONTEXT(userProfile);
    const W = '{"dayName":"","type":"workout","duration":30,"caloriesBurned":180,"warmup":"","exercises":[{"name":"","sets":3,"reps":"12","restSeconds":45,"description":"","modification":""}],"cooldown":""}';
    const R = '{"dayName":"","type":"rest","duration":20,"caloriesBurned":40,"activities":[],"description":""}';

    // Part 1: tips + days 1-3
    onProgress('Exercise plan: generating days 1–3 of 7...');
    const part1 = parseJSON(
      await callClaude(apiKey,
        `Home exercise plan — ONLY days 1 (Monday), 2 (Tuesday), 3 (Wednesday). Include 1 rest day among them.
${ctx}
Return ONLY this JSON:
{"tips":["tip1","tip2"],"weeklyPlan":{"day1":${W},"day2":${R},"day3":${W}}}`,
        3000,
      ),
      'Exercise plan part 1',
    );

    // Part 2: days 4-7
    onProgress('Exercise plan: generating days 4–7 of 7...');
    const part2 = parseJSON(
      await callClaude(apiKey,
        `Continue the same home exercise plan — ONLY days 4 (Thursday), 5 (Friday), 6 (Saturday), 7 (Sunday). Include 1 rest day.
${ctx}
Return ONLY this JSON:
{"weeklyPlan":{"day4":${W},"day5":${W},"day6":${W},"day7":${R}}}`,
        3500,
      ),
      'Exercise plan part 2',
    );

    return {
      tips: part1.tips,
      weeklyPlan: { ...part1.weeklyPlan, ...part2.weeklyPlan },
    };
  },

  async generateHealthPlans(apiKey, userProfile, unitSystem, onProgress) {
    const dietPlan = await this.generateDietPlan(apiKey, userProfile, unitSystem, onProgress);
    const exercisePlan = await this.generateExercisePlan(apiKey, userProfile, onProgress);
    return { dietPlan, exercisePlan };
  },
};
