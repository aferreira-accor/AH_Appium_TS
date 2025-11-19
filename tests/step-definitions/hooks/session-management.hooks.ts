import { Before, After } from "@wdio/cucumber-framework";
import { getStoredCapabilities } from "../../support/capability-store";

/**
 * Session Management Hooks
 *
 * LOCAL MODE:
 * - Each scenario with locale tags creates a NEW session with that locale/language
 * - Scenarios without locale tags reuse the session
 *
 * BROWSERSTACK MODE:
 * - Each scenario (after the first) reloads the session
 * - This creates a new BrowserStack session, potentially on a different device
 * - Allows: 50 scenarios = 50 BrowserStack sessions with PARALLEL_SESSIONS controlling concurrency
 */

// Track scenario execution count PER WORKER
let scenarioCount = 0;
let isFirstScenario = true;

// Detect if we're in parallel split mode (1 scenario per worker)
const isParallelSplitMode = process.env.WDIO_PARALLEL_EXECUTION === 'true';

/**
 * Extract locale and language from scenario tags
 */
function extractLocaleFromScenario(scenario: any): { locale?: string; language?: string } {
  const tags = scenario.pickle.tags.map((tag: any) => tag.name);

  const localeTag = tags.find((tag: string) => tag.startsWith('@locale:'));
  const locale = localeTag ? localeTag.replace('@locale:', '') : undefined;

  const languageTag = tags.find((tag: string) => tag.startsWith('@language:'));
  const language = languageTag ? languageTag.replace('@language:', '') : undefined;

  return { locale, language };
}

/**
 * Before each scenario: Manage session based on execution mode
 */
Before({ timeout: 120000 }, async function (scenario) {
  const isLocal = process.env.EXECUTION_TYPE === 'local' ||
                  !process.env.BROWSERSTACK_USERNAME;

  scenarioCount++;

  // Extract locale and language from scenario tags
  const { locale, language } = extractLocaleFromScenario(scenario);

  // In parallel split mode, each scenario might have different locale
  // First scenario uses the initial session, subsequent scenarios reload with new locale if needed
  if (isParallelSplitMode && !isLocal) {
    if (isFirstScenario) {
      // First scenario: use existing session but log locale info
      isFirstScenario = false;
      console.log(`\n[SESSION] 🚀 Parallel split mode - first scenario`);
      console.log(`[SESSION]    Scenario: ${scenario.pickle.name}`);
      if (locale || language) {
        console.log(`[SESSION] 🌍 Locale: ${locale}, Language: ${language}`);
      }
      return;
    }

    // Subsequent scenarios: reload session with correct locale + next device
    try {
      console.log(`\n[SESSION] 🔄 Reloading session for scenario #${scenarioCount}`);
      console.log(`[SESSION]    Scenario: ${scenario.pickle.name}`);

      // Get stored capabilities
      const storedCaps = getStoredCapabilities();
      if (!storedCaps) {
        console.error('[SESSION] ❌ No stored capabilities - cannot reload');
        return;
      }

      // Get next device from the pool
      const { getNextDevice } = require('../../support/capability-store');
      const nextDevice = getNextDevice();

      if (!nextDevice) {
        console.error('[SESSION] ❌ No devices in pool - cannot reload');
        return;
      }

      // Clone capabilities and update with next device AND locale
      const newCaps = JSON.parse(JSON.stringify(storedCaps)) as any;
      newCaps['appium:deviceName'] = nextDevice.name;
      newCaps['appium:platformVersion'] = nextDevice.version;

      // Apply locale from scenario tags
      if (locale && language) {
        newCaps['appium:language'] = language;
        newCaps['appium:locale'] = locale;

        // Update BrowserStack timezone if available
        const timezoneTag = scenario.pickle.tags.find((tag: any) => tag.name.startsWith('@timezone:'));
        if (timezoneTag) {
          const timezone = timezoneTag.name.replace('@timezone:', '');
          if (!newCaps['bstack:options']) {
            newCaps['bstack:options'] = {};
          }
          newCaps['bstack:options'].timezone = timezone;
          console.log(`[SESSION] 🌍 Locale: ${locale}, Language: ${language}, Timezone: ${timezone}`);
        } else {
          console.log(`[SESSION] 🌍 Locale: ${locale}, Language: ${language}`);
        }
      }

      console.log(`[SESSION] 🎯 Next device: ${nextDevice.name} (v${nextDevice.version})`);

      // Reload session with new device + locale
      await browser.reloadSession(newCaps);

      console.log(`[SESSION] ✅ New BrowserStack session created: ${driver.sessionId}`);

      // Update BrowserStack session name
      try {
        await browser.executeScript(
          `browserstack_executor: {"action": "setSessionName", "arguments": {"name": "${scenario.pickle.name}"}}`,
          []
        );
      } catch {
        // Ignore if session name update fails
      }

    } catch (error) {
      console.error(`[SESSION] ❌ Error reloading session:`, error);
      throw error;
    }
    return;
  }

  // First scenario in normal mode: just use the existing session
  if (isFirstScenario) {
    isFirstScenario = false;
    console.log(`\n[SESSION] 🚀 Starting first scenario (worker's initial session)`);
    console.log(`[SESSION]    Scenario: ${scenario.pickle.name}`);
    if (locale || language) {
      console.log(`[SESSION] ℹ️  Tags: locale=${locale}, language=${language}`);
    }
    return;
  }

  // BROWSERSTACK MODE (non-parallel): Reload session for each scenario to get new BrowserStack session
  if (!isLocal) {
    try {
      console.log(`\n[SESSION] 🔄 Reloading session for scenario #${scenarioCount} (BrowserStack)`);
      console.log(`[SESSION]    Scenario: ${scenario.pickle.name}`);

      // Get the original capabilities from the config
      const storedCaps = getStoredCapabilities();
      if (!storedCaps) {
        console.error('[SESSION] ❌ No stored capabilities - cannot reload');
        return;
      }

      // Get next device from the pool (round-robin)
      const { getNextDevice } = require('../../support/capability-store');
      const nextDevice = getNextDevice();

      if (!nextDevice) {
        console.error('[SESSION] ❌ No devices in pool - cannot reload');
        return;
      }

      // Clone capabilities and update with next device
      const newCaps = JSON.parse(JSON.stringify(storedCaps)) as any;
      newCaps['appium:deviceName'] = nextDevice.name;
      newCaps['appium:platformVersion'] = nextDevice.version;

      console.log(`[SESSION] 🎯 Next device: ${nextDevice.name} (v${nextDevice.version})`);

      // Reload session with new device
      await browser.reloadSession(newCaps);

      console.log(`[SESSION] ✅ New BrowserStack session created: ${driver.sessionId}`);

      // Update BrowserStack session name to scenario name (via executeScript hack)
      try {
        await browser.executeScript(
          `browserstack_executor: {"action": "setSessionName", "arguments": {"name": "${scenario.pickle.name}"}}`,
          []
        );
      } catch {
        // Ignore if session name update fails (non-critical)
      }

    } catch (error) {
      console.error(`[SESSION] ❌ Error reloading BrowserStack session:`, error);
      throw error;
    }
    return;
  }

  // LOCAL MODE: Reload session ONLY if scenario has locale tags
  if (!locale && !language) {
    // No locale tags, reuse current session
    console.log(`\n[SESSION] ♻️  Reusing session for scenario #${scenarioCount} (no locale tags)`);
    console.log(`[SESSION]    Scenario: ${scenario.pickle.name}`);
    return;
  }

  // LOCAL MODE with locale tags: Reload session with new locale
  try {
    console.log(`\n[SESSION] 🔄 Reloading session for scenario #${scenarioCount} (Local with locale)`);
    console.log(`[SESSION]    Scenario: ${scenario.pickle.name}`);
    console.log(`[SESSION] 🌍 Locale: ${locale}, Language: ${language}`);

    // Get stored capabilities
    const storedCaps = getStoredCapabilities();
    if (!storedCaps) {
      console.error('[SESSION] ❌ No stored capabilities - cannot reload');
      return;
    }

    // Clone and modify capabilities with new locale/language
    const newCaps = JSON.parse(JSON.stringify(storedCaps)) as any;

    const isAndroid = newCaps.platformName === 'Android';

    if (locale && language) {
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
    }

    // Reload session with new locale
    await browser.reloadSession(newCaps);

    console.log(`[SESSION] ✅ Session reloaded with locale=${locale}, language=${language}`);

  } catch (error) {
    console.error(`[SESSION] ❌ Error reloading local session:`, error);
    throw error;
  }
});

/**
 * After hook to log scenario completion
 */
After(async function (scenario) {
  const status = scenario.result?.status || 'UNKNOWN';
  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`\n[SESSION] ${icon} Scenario completed: ${scenario.pickle.name} (${status})`);
});
