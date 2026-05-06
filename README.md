# Healthify

A React Native (Expo) health app powered by Claude AI that creates personalized diet plans, home exercise routines, and tracks your weight loss journey.

## Features

- **AI Onboarding** — Claude generates 10 personalized health questions to understand your goals
- **Smart Diet Plan** — 7-day plan using common household food items, tailored to your dietary preferences
- **Home Exercise Plan** — 7-day no-equipment workout routine based on your fitness level
- **Weight Tracker** — Daily weight logging with progress chart and goal tracking
- **Dark Modern UI** — Clean, easy-to-use interface for everyone

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get an Anthropic API key**
   - Sign up at [console.anthropic.com](https://console.anthropic.com)
   - Create an API key

3. **Run the app**
   ```bash
   npx expo start
   ```

4. **Enter your API key** when the app opens, then complete the health questionnaire.

## Tech Stack

- [Expo](https://expo.dev) (SDK 51)
- [React Navigation](https://reactnavigation.org) (Stack + Bottom Tabs)
- [Claude AI](https://anthropic.com) via `@anthropic-ai/sdk`
- [AsyncStorage](https://github.com/react-native-async-storage/async-storage) for local data
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) for API key
- [react-native-svg](https://github.com/software-mansion/react-native-svg) for weight charts

## Data Privacy

All your health data is stored locally on your device only. The Anthropic API key is stored in the device's secure keychain. Nothing is sent to any server except Claude API calls for plan generation.
