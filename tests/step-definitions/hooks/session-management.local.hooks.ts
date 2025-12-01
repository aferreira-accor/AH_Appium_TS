import { Before, After } from "@wdio/cucumber-framework";
import { extractLocaleFromScenario, isLocalMode, logScenarioCompletion, requiresAppRestart } from "./session-management.shared";
import { getStoredCapabilities } from "../../support/capability-store";

/**
 * Session Management Hooks - LOCAL MODE
 *
 * Behavior:
 * - First scenario: Uses initial session
 * - Scenarios without locale tags: Reuse session
 * - Scenarios with locale tags: Reload session + restart app with new locale
 *
 * IMPORTANT iOS LIMITATION:
 * iOS does NOT have an API to clear app data on real devices.
 * noReset: false does NOT work on iOS like it does on Android.
 *
 * Solutions for iOS app reset:
 * 1. fullReset: true - Reinstalls app (slow)
 * 2. App backdoor - Add process argument like "-debug_clear_data true"
 *    that the iOS app detects and clears its own data (UserDefaults, Keychain, etc.)
 */

// Only register hooks if we're in LOCAL mode
if (!isLocalMode()) {
  console.log('[LOCAL HOOKS] Skipped - BrowserStack mode detected');
} else {
  console.log('[LOCAL HOOKS] Registered - Local mode detected');

  // Track scenario execution count
  let scenarioCount = 0;
  let isFirstScenario = true;

  /**
   * Before each scenario: Manage session based on locale tags
   */
  Before({ timeout: 120000 }, async function (scenario) {
    scenarioCount++;
    const { locale, language, timezone } = extractLocaleFromScenario(scenario);

    // First scenario: use existing session
    if (isFirstScenario) {
      isFirstScenario = false;
      console.log(`\n[LOCAL] 🚀 Starting first scenario (worker's initial session)`);
      console.log(`[LOCAL]    Scenario: ${scenario.pickle.name}`);
      if (locale || language) {
        console.log(`[LOCAL] ℹ️  Tags: locale=${locale}, language=${language}`);
      }
      return;
    }

    // For android-inhouse, ALWAYS reload session to show configuration screen
    // For other builds, only reload if locale tags are present
    const needsReload = (locale && language) || requiresAppRestart();

    if (!needsReload) {
      console.log(`\n[LOCAL] ♻️  Reusing session for scenario #${scenarioCount} (no locale tags)`);
      console.log(`[LOCAL]    Scenario: ${scenario.pickle.name}`);
      return;
    }

    // Reload session with new locale (or same locale for android-inhouse)
    await reloadSessionWithLocale(scenario, scenarioCount, locale, language, timezone);
  });

  /**
   * Reload session with new locale and restart the app
   */
  async function reloadSessionWithLocale(
    scenario: any,
    scenarioCount: number,
    locale?: string,
    language?: string,
    timezone?: string
  ): Promise<void> {
    try {
      // Get stored capabilities
      const storedCaps = getStoredCapabilities();
      if (!storedCaps) {
        console.error('[LOCAL] ❌ No stored capabilities - cannot reload');
        return;
      }

      // Clone capabilities
      const newCaps = JSON.parse(JSON.stringify(storedCaps)) as any;
      const isAndroid = newCaps.platformName === 'Android';

      // If locale/language provided, update capabilities
      if (locale && language) {
        console.log(`\n[LOCAL] 🔄 Reloading session for scenario #${scenarioCount} (Local with locale)`);
        console.log(`[LOCAL]    Scenario: ${scenario.pickle.name}`);
        console.log(`[LOCAL] 🌍 Locale: ${locale}, Language: ${language}${timezone ? `, Timezone: ${timezone}` : ''}`);

        // Set language (same format for both platforms: lowercase)
        newCaps['appium:language'] = language.toLowerCase();

        if (isAndroid) {
          // For Android: extract country code and convert to UPPERCASE
          const countryCode = locale.includes('_')
            ? locale.split('_')[1].toUpperCase()
            : locale.toUpperCase();
          newCaps['appium:locale'] = countryCode;
        } else {
          // For iOS: use full locale format (e.g., "fr_FR")
          newCaps['appium:locale'] = locale;
        }
      } else {
        // No locale tags - reload session anyway to ensure 1 scenario = 1 session
        console.log(`\n[LOCAL] 🔄 Reloading session for scenario #${scenarioCount} (no locale tags)`);
        console.log(`[LOCAL]    Scenario: ${scenario.pickle.name}`);
      }

      // ========================================
      // PLATFORM-SPECIFIC BEHAVIOR
      // ========================================
      // ANDROID INHOUSE:
      //   1. browser.reloadSession() launches the app
      //   2. Step "Given The app is launched" clicks on "debug_relaunchApp_button"
      //      → This button RELAUNCHES the app with a FULL RESET (clears data)
      //      → That's why we see OneTrust between scenarios on Android
      //
      // ANDROID STORE:
      //   1. browser.reloadSession() clears app data and launches
      //   2. No configuration screen, app starts fresh
      //
      // iOS (SANDBOX/STORE):
      //   1. reloadSession() launches the app BUT DOES NOT CLEAR DATA
      //   2. iOS has NO API to clear app data on real devices
      //   3. Solutions:
      //      - fullReset: true (slow, reinstalls app)
      //      - App backdoor with "-debug_clear_data" process argument
      // ========================================

      await browser.reloadSession(newCaps);

      if (locale && language) {
        console.log(`[LOCAL] ✅ Session reloaded with locale=${locale}, language=${language}`);
      } else {
        console.log(`[LOCAL] ✅ Session reloaded (same locale)`);
      }

      console.log(`[LOCAL] ℹ️  App ready for scenario execution`);

    } catch (error) {
      console.error(`[LOCAL] ❌ Error reloading local session:`, error);
      throw error;
    }
  }

  /**
   * After each scenario: Log completion status
   */
  After(async function (scenario) {
    logScenarioCompletion(scenario, '[LOCAL]');
  });
}
