const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-6';

// Required for browser (web) environments; harmless on native
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'anthropic-version': API_VERSION,
  'anthropic-dangerous-direct-browser-access': 'true',
};

function extractJSON(text) {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) return blockMatch[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

async function callClaude(apiKey, prompt, maxTokens = 2000) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { ...BASE_HEADERS, 'x-api-key': apiKey },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export const AIService = {
  async validateApiKey(apiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
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
      clearTimeout(timeout);

      if (response.ok) return { valid: true };

      const body = await response.json().catch(() => ({}));
      const msg = body?.error?.message || `HTTP ${response.status}`;

      if (response.status === 401) return { valid: false, error: `Invalid API key: ${msg}` };
      if (response.status === 403) return { valid: false, error: `Access denied: ${msg}` };
      if (response.status === 429) return { valid: false, error: 'Rate limit hit. Wait a moment and try again.' };
      return { valid: false, error: `Anthropic error (${response.status}): ${msg}` };
    } catch (e) {
      if (e.name === 'AbortError') {
        return { valid: false, error: 'Request timed out after 10 seconds. Check your internet connection.' };
      }
      throw e;
    }
  },

  async generateOnboardingQuestions(apiKey) {
    const text = await callClaude(
      apiKey,
      `Generate exactly 10 health onboarding questions for a personal health app that will create a custom diet plan and home exercise plan.

Return ONLY a valid JSON object with NO markdown fences, no explanation:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here?",
      "type": "single_choice",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}

Question types allowed: "number" (numeric input), "text" (free text), "single_choice" (pick one), "multi_choice" (pick many).
For "number" type, add a "unit" field (e.g. "years", "kg", "lbs", "cm") and a "placeholder" field.
For "single_choice"/"multi_choice", add an "options" array with 2-5 choices.

Make exactly these 10 questions:
1. Current weight (number, unit: kg)
2. Height (number, unit: cm)
3. Age (number, unit: years)
4. Target weight (number, unit: kg)
5. Primary health goal (single_choice: Weight Loss, Build Muscle, Stay Fit, Improve Energy, Manage Health Condition)
6. Dietary preference (single_choice: No Restriction, Vegetarian, Vegan, Non-Vegetarian, Gluten Free)
7. Current activity level (single_choice: Sedentary (desk job), Lightly Active, Moderately Active, Very Active)
8. Any food allergies or things you avoid (multi_choice: Dairy, Nuts, Eggs, Seafood, Gluten, Soy, None)
9. Medical conditions to consider (multi_choice: Diabetes, Hypertension, High Cholesterol, Thyroid Issues, None)
10. How many hours do you sleep per night (single_choice: Less than 5, 5-6 hours, 7-8 hours, More than 8)`,
      2000,
    );
    return JSON.parse(extractJSON(text));
  },

  async generateHealthPlans(apiKey, userProfile, unitSystem, onProgress) {
    const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs';

    onProgress && onProgress('Crafting your personalized diet plan...');

    const dietText = await callClaude(
      apiKey,
      `Create a personalized 7-day diet plan based on this health profile:
${JSON.stringify(userProfile, null, 2)}

RULES:
- Use ONLY common household/homely food items found in any kitchen
- Simple preparation under 30 minutes
- Focus on the user's primary goal: ${userProfile.goal}
- Strictly respect dietary preference (${userProfile.dietaryPreference}) and avoid: ${JSON.stringify(userProfile.foodAvoid)}
- Weight unit: ${weightUnit}
- Calculate realistic daily calories based on weight, height, age, activity, and goal

Return ONLY valid JSON, no markdown:
{
  "dailyCalorieTarget": 1800,
  "proteinTarget": "120g",
  "waterIntake": "8 glasses",
  "weeklyPlan": {
    "day1": {
      "dayName": "Monday",
      "totalCalories": 1780,
      "meals": {
        "breakfast": {
          "name": "Oats with Banana",
          "items": ["1 cup rolled oats", "1 banana", "1 cup milk", "1 tsp honey"],
          "calories": 380,
          "prepTime": "10 mins",
          "instructions": "Boil oats in milk, slice banana on top, drizzle honey."
        },
        "lunch": {
          "name": "Dal Rice",
          "items": ["1 cup cooked rice", "1 cup dal", "salad"],
          "calories": 520,
          "prepTime": "20 mins",
          "instructions": "Cook dal with turmeric. Serve with rice."
        },
        "dinner": {
          "name": "Vegetable Soup",
          "items": ["mixed vegetables", "broth", "spices"],
          "calories": 280,
          "prepTime": "15 mins",
          "instructions": "Boil veggies in broth with spices."
        },
        "snacks": [
          {
            "name": "Apple with Peanut Butter",
            "items": ["1 apple", "1 tbsp peanut butter"],
            "calories": 200,
            "instructions": "Slice apple, serve with peanut butter."
          }
        ]
      }
    },
    "day2": { "dayName": "Tuesday", "totalCalories": 1760, "meals": { "breakfast": {}, "lunch": {}, "dinner": {}, "snacks": [] } },
    "day3": { "dayName": "Wednesday", "totalCalories": 1800, "meals": { "breakfast": {}, "lunch": {}, "dinner": {}, "snacks": [] } },
    "day4": { "dayName": "Thursday", "totalCalories": 1750, "meals": { "breakfast": {}, "lunch": {}, "dinner": {}, "snacks": [] } },
    "day5": { "dayName": "Friday", "totalCalories": 1790, "meals": { "breakfast": {}, "lunch": {}, "dinner": {}, "snacks": [] } },
    "day6": { "dayName": "Saturday", "totalCalories": 1820, "meals": { "breakfast": {}, "lunch": {}, "dinner": {}, "snacks": [] } },
    "day7": { "dayName": "Sunday", "totalCalories": 1770, "meals": { "breakfast": {}, "lunch": {}, "dinner": {}, "snacks": [] } }
  },
  "tips": ["Drink water before each meal", "Eat slowly and chew well", "Avoid screens while eating"]
}

Fill ALL 7 days completely with real meals, items, calories, and instructions.`,
      4096,
    );

    onProgress && onProgress('Building your home exercise routine...');

    const exerciseText = await callClaude(
      apiKey,
      `Create a personalized 7-day home exercise plan based on this health profile:
${JSON.stringify(userProfile, null, 2)}

RULES:
- ALL exercises must be doable at home with ZERO equipment
- Start easy if activity level is sedentary or lightly active
- Consider medical conditions: ${JSON.stringify(userProfile.medicalConditions)}
- Include 2 rest/light days per week
- Each workout: 20-45 minutes

Return ONLY valid JSON, no markdown:
{
  "weeklyPlan": {
    "day1": {
      "dayName": "Monday",
      "type": "workout",
      "duration": 30,
      "caloriesBurned": 180,
      "warmup": "5 minutes of marching in place and arm circles",
      "exercises": [
        {
          "name": "Bodyweight Squats",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 45,
          "description": "Stand with feet shoulder-width apart, lower until thighs parallel to floor, push back up.",
          "modification": "Hold a chair for balance if needed"
        }
      ],
      "cooldown": "5 minutes gentle stretching"
    },
    "day2": {
      "dayName": "Tuesday",
      "type": "rest",
      "duration": 20,
      "caloriesBurned": 60,
      "activities": ["15-minute brisk walk", "5 minutes stretching"],
      "description": "Active recovery day. Light movement helps reduce soreness."
    },
    "day3": { "dayName": "Wednesday", "type": "workout", "duration": 35, "caloriesBurned": 200, "warmup": "", "exercises": [], "cooldown": "" },
    "day4": { "dayName": "Thursday", "type": "rest", "duration": 20, "caloriesBurned": 50, "activities": [], "description": "" },
    "day5": { "dayName": "Friday", "type": "workout", "duration": 30, "caloriesBurned": 180, "warmup": "", "exercises": [], "cooldown": "" },
    "day6": { "dayName": "Saturday", "type": "workout", "duration": 40, "caloriesBurned": 220, "warmup": "", "exercises": [], "cooldown": "" },
    "day7": { "dayName": "Sunday", "type": "rest", "duration": 15, "caloriesBurned": 40, "activities": [], "description": "" }
  },
  "tips": ["Stay consistent", "Listen to your body"]
}

Fill ALL 7 days. Workout days need 4-6 exercises each with full details.`,
      4096,
    );

    return {
      dietPlan: JSON.parse(extractJSON(dietText)),
      exercisePlan: JSON.parse(extractJSON(exerciseText)),
    };
  },
};
