import Anthropic from '@anthropic-ai/sdk';

function extractJSON(text) {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) return blockMatch[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

function createClient(apiKey) {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export const AIService = {
  async validateApiKey(apiKey) {
    try {
      const client = createClient(apiKey);
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch {
      return false;
    }
  },

  async generateOnboardingQuestions(apiKey) {
    const client = createClient(apiKey);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Generate exactly 10 health onboarding questions for a personal health app that will create a custom diet plan and home exercise plan.

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
For "number" type, add a "unit" field (e.g. "years", "kg", "lbs", "cm").
For "number" type, add "placeholder" field.
For "single_choice"/"multi_choice", add "options" array (2-5 options).

Make these 10 questions:
1. Current weight (number, will show both kg and lbs pickers based on user preference)
2. Height (number)
3. Age (number, unit: years)
4. Target weight (number)
5. Primary health goal (single_choice: Weight Loss, Build Muscle, Stay Fit, Improve Energy, Manage Health Condition)
6. Dietary preference (single_choice: No Restriction, Vegetarian, Vegan, Non-Vegetarian, Gluten Free)
7. Current activity level (single_choice: Sedentary (desk job), Lightly Active, Moderately Active, Very Active)
8. Any food allergies or things you avoid (multi_choice: Dairy, Nuts, Eggs, Seafood, Gluten, Soy, None)
9. Medical conditions to consider (multi_choice: Diabetes, Hypertension, High Cholesterol, Thyroid Issues, None)
10. How many hours do you sleep per night (single_choice: Less than 5, 5-6 hours, 7-8 hours, More than 8)`,
        },
      ],
    });

    const raw = response.content[0].text;
    const json = extractJSON(raw);
    return JSON.parse(json);
  },

  async generateHealthPlans(apiKey, userProfile, unitSystem, onProgress) {
    const client = createClient(apiKey);
    const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs';
    const heightUnit = unitSystem === 'metric' ? 'cm' : 'inches';

    onProgress && onProgress('Crafting your personalized diet plan...');

    const dietResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Create a personalized 7-day diet plan based on this health profile:
${JSON.stringify(userProfile, null, 2)}

RULES:
- Use ONLY common household/homely food items found in any kitchen
- Simple preparation under 30 minutes
- Focus on the user's primary goal: ${userProfile.goal}
- Strictly respect: dietary preference (${userProfile.dietaryPreference}), avoid: ${JSON.stringify(userProfile.foodAvoid)}
- Weight unit: ${weightUnit}, height unit: ${heightUnit}
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
          "name": "Rice and Dal",
          "items": ["1 cup cooked rice", "1 cup dal", "1 tbsp ghee", "salad"],
          "calories": 520,
          "prepTime": "20 mins",
          "instructions": "Cook dal with turmeric and salt. Serve with rice."
        },
        "dinner": {
          "name": "Vegetable Soup",
          "items": ["mixed vegetables", "1 cup broth", "spices"],
          "calories": 280,
          "prepTime": "15 mins",
          "instructions": "Boil veggies in broth with spices."
        },
        "snacks": [
          {
            "name": "Apple with Peanut Butter",
            "items": ["1 apple", "1 tbsp peanut butter"],
            "calories": 200,
            "instructions": "Slice apple, dip in peanut butter."
          }
        ]
      }
    },
    "day2": { "dayName": "Tuesday", "totalCalories": 1760, "meals": {} },
    "day3": { "dayName": "Wednesday", "totalCalories": 1800, "meals": {} },
    "day4": { "dayName": "Thursday", "totalCalories": 1750, "meals": {} },
    "day5": { "dayName": "Friday", "totalCalories": 1790, "meals": {} },
    "day6": { "dayName": "Saturday", "totalCalories": 1820, "meals": {} },
    "day7": { "dayName": "Sunday", "totalCalories": 1770, "meals": {} }
  },
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}

Fill ALL 7 days completely with real meals, items, calories, and instructions.`,
        },
      ],
    });

    onProgress && onProgress('Building your home exercise routine...');

    const exerciseResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Create a personalized 7-day home exercise plan based on this health profile:
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
    }
  },
  "tips": ["Tip 1", "Tip 2"]
}

Fill ALL 7 days. Include 2 rest days (type: "rest"). For workout days include 4-6 exercises each.`,
        },
      ],
    });

    const dietJSON = extractJSON(dietResponse.content[0].text);
    const exerciseJSON = extractJSON(exerciseResponse.content[0].text);

    return {
      dietPlan: JSON.parse(dietJSON),
      exercisePlan: JSON.parse(exerciseJSON),
    };
  },
};
