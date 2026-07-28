# Development Workflow & Best Practices

As this project scales and incorporates more native device capabilities, it's essential to understand the difference between standard Expo development (Metro Fast Refresh) and Native development (recompiling the app binaries).

This guide will help you develop features quickly without rebuilding the app unnecessarily.

---

## 🚀 1. The Standard Workflow (`npx expo start`)

**Use this for 95% of your development.**

When you run `npx expo start`, it starts the Metro bundler. This only bundles **JavaScript and TypeScript** code and sends it over the air to your development client.

### When to use this:
- **UI Changes:** Modifying any React components, styles, NativeWind classes, or layout structure.
- **Business Logic:** Editing hooks, Zustand stores, state management, or React Query.
- **API integrations:** Changing Supabase queries, edge functions, or standard `fetch` requests.
- **Adding pure JS libraries:** Installing NPM packages that do NOT contain native iOS/Android code (e.g., `date-fns`, `zod`, `react-hook-form`).

**Why?**
Because UI and TS changes are hot-reloadable. Metro will inject the changes into your running app instantly (Fast Refresh) without needing to recompile a single line of Java, Kotlin, Swift, or Objective-C.

---

## 🛠 2. The Native Workflow (`npx expo run:android` or `run:ios`)

**Use this only when you change Native code.**

When you run `npx expo run:android`, Expo actually compiles the underlying Android project (using Gradle, Kotlin/Java) and generates a fresh `.apk` / `.aab` to install on your emulator or device.

### When to use this:
- **Installing Native Modules:** If you install an NPM package that interacts directly with device hardware or OS APIs (e.g., `@react-native-google-signin/google-signin`, `expo-camera`, `expo-notifications`, `react-native-reanimated`).
- **Modifying `app.json` plugins:** If you add a new Expo Config Plugin to the `plugins` array.
- **Adding Custom Fonts or Assets:** If you add new static fonts or modify the splash screen/app icon.

**Why?**
The Metro bundler (`npx expo start`) can only send JavaScript over the air. It cannot send native Java/Swift binaries. If you add a native module and try to run it via `npx expo start`, the JavaScript will ask the OS for a module (like `RNGoogleSignin`) that doesn't exist in the installed app binary, causing the app to crash or the module to fail.

---

## 🛡 3. Architecture for Fast Development

To prevent the entire app from crashing when a native module is missing (such as when a designer opens the app in Expo Go or an older dev client), our architecture strictly **isolates native modules**.

### Best Practice: Safe Native Imports
Never import a volatile native module statically at the top of a file if it's the only thing that could crash a route.

**Bad:**
```typescript
import { GoogleSignin } from "@react-native-google-signin/google-signin"; // ❌ Crashes Metro Router if native binary isn't built
```

**Good:**
```typescript
let GoogleSignin: any = null;
try {
  // ✅ Safely require the module. If the binary is missing, it catches the error and disables the feature gracefully.
  const GoogleModule = require("@react-native-google-signin/google-signin");
  GoogleSignin = GoogleModule.GoogleSignin;
} catch (error) {
  console.warn("Native module missing. Feature disabled until app is rebuilt.");
}
```
This architecture ensures that **business logic remains pure TypeScript** and **UI changes remain hot-reloadable**, allowing the rest of the app to function perfectly even if a specific native feature is temporarily broken or missing from the current binary.

---

## ⚡ 4. How to Test Efficiently

1. **Daily Development:** Just run `npx expo start` and use your existing emulator or physical device. Enjoy instant hot-reloading.
2. **Adding a Native Feature:** 
   - Stop the Metro server.
   - Run `npx expo run:android`. Wait for the 2-5 minute Gradle build.
   - Once the new binary is installed, go back to step 1 (`npx expo start`) for all future UI/logic tweaks.
3. **If `npx expo run:android` fails (No Emulator):**
   - Ensure an Android Virtual Device (AVD) is running via Android Studio, or plug in a physical Android device via USB with USB Debugging enabled.
   - Verify connection by running `adb devices` in your terminal.
