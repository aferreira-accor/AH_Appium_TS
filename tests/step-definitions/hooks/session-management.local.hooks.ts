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
 * This ensures the app is restarted with the correct locale and shows
 * the environment selection screen (REC2, etc.)
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
        // No locale tags - just reload to show configuration screen (android-inhouse)
        console.log(`\n[LOCAL] 🔄 Reloading session for scenario #${scenarioCount} (android-inhouse without locale)`);
        console.log(`[LOCAL]    Scenario: ${scenario.pickle.name}`);
      }

      // Reload session - this will relaunch the app with new locale
      // For android-inhouse: app launches on AppConfigurationActivity (LAUNCHER activity)
      // Then the step "Given The app is launched" will select environment
      await browser.reloadSession(newCaps);

      if (locale && language) {
        console.log(`[LOCAL] ✅ Session reloaded with locale=${locale}, language=${language}`);
      } else {
        console.log(`[LOCAL] ✅ Session reloaded (same locale)`);
      }

      console.log(`[LOCAL] ℹ️  App will launch with configuration screen (handled by 'Given The app is launched' step)`);

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
