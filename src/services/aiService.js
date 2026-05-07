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
RULES: common homely food typical to ${profile.location || 'the user\'s region'}, under 30 min prep, diet: ${profile.dietaryPreference}, avoid: ${JSON.stringify(profile.foodAvoid)}, goal: ${profile.goal}, weight unit: ${weightUnit}.
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

    // Part 1: global targets + days 1-4
    onProgress('Diet plan: generating days 1–4 of 7...');
    const part1 = parseJSON(
      await callClaude(apiKey,
        `Create a personalized diet plan (days 1-4 of a 7-day plan).
${ctx}

Return ONLY this JSON (fill every field for all 4 days):
{"dailyCalorieTarget":1800,"proteinTarget":"80g","waterIntake":"8 glasses","tips":["tip1","tip2","tip3"],"weeklyPlan":{"day1":{"dayName":"Monday","totalCalories":1750,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[{"name":"","items":[],"calories":0,"instructions":""}]}},"day2":{"dayName":"Tuesday","totalCalories":1760,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[]}},"day3":{"dayName":"Wednesday","totalCalories":1740,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[]}},"day4":{"dayName":"Thursday","totalCalories":1770,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[]}}}}`,
        4096,
      ),
      'Diet plan part 1',
    );

    // Part 2: days 5-7
    onProgress('Diet plan: generating days 5–7 of 7...');
    const part2 = parseJSON(
      await callClaude(apiKey,
        `Continue the same personalized diet plan (days 5-7 of 7).
${ctx}
Daily calorie target: ${part1.dailyCalorieTarget} kcal.

Return ONLY this JSON (fill every field for all 3 days):
{"weeklyPlan":{"day5":{"dayName":"Friday","totalCalories":1750,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[]}},"day6":{"dayName":"Saturday","totalCalories":1800,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[]}},"day7":{"dayName":"Sunday","totalCalories":1730,"meals":{"breakfast":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"lunch":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"dinner":{"name":"","items":[],"calories":0,"prepTime":"","instructions":""},"snacks":[]}}}}`,
        4096,
      ),
      'Diet plan part 2',
    );

    return {
      dailyCalorieTarget: part1.dailyCalorieTarget,
      proteinTarget: part1.proteinTarget,
      waterIntake: part1.waterIntake,
      tips: part1.tips,
      weeklyPlan: { ...part1.weeklyPlan, ...part2.weeklyPlan },
    };
  },

  async generateExercisePlan(apiKey, userProfile, onProgress) {
    const ctx = EXERCISE_CONTEXT(userProfile);

    // Part 1: tips + days 1-4
    onProgress('Exercise plan: generating days 1–4 of 7...');
    const part1 = parseJSON(
      await callClaude(apiKey,
        `Create a home exercise plan (days 1-4 of a 7-day plan, include at least 1 rest day).
${ctx}

Return ONLY this JSON (fill every field):
{"tips":["tip1","tip2"],"weeklyPlan":{"day1":{"dayName":"Monday","type":"workout","duration":30,"caloriesBurned":180,"warmup":"5 min warmup","exercises":[{"name":"Squats","sets":3,"reps":"12","restSeconds":45,"description":"How to do it","modification":"Easier version"}],"cooldown":"5 min cooldown"},"day2":{"dayName":"Tuesday","type":"rest","duration":20,"caloriesBurned":50,"activities":["light walk"],"description":"Rest day"},"day3":{"dayName":"Wednesday","type":"workout","duration":35,"caloriesBurned":200,"warmup":"","exercises":[],"cooldown":""},"day4":{"dayName":"Thursday","type":"workout","duration":30,"caloriesBurned":180,"warmup":"","exercises":[],"cooldown":""}}}`,
        4096,
      ),
      'Exercise plan part 1',
    );

    // Part 2: days 5-7
    onProgress('Exercise plan: generating days 5–7 of 7...');
    const part2 = parseJSON(
      await callClaude(apiKey,
        `Continue the same home exercise plan (days 5-7 of 7, include 1 rest day).
${ctx}

Return ONLY this JSON (fill every field):
{"weeklyPlan":{"day5":{"dayName":"Friday","type":"workout","duration":30,"caloriesBurned":180,"warmup":"","exercises":[],"cooldown":""},"day6":{"dayName":"Saturday","type":"workout","duration":40,"caloriesBurned":220,"warmup":"","exercises":[],"cooldown":""},"day7":{"dayName":"Sunday","type":"rest","duration":15,"caloriesBurned":30,"activities":[],"description":""}}}`,
        4096,
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
