import { Before, After } from "@wdio/cucumber-framework";
import { extractLocaleFromScenario, isLocalMode, isParallelSplitMode, logScenarioCompletion } from "./session-management.shared";
import { getStoredCapabilities } from "../../support/capability-store";

/**
 * Session Management Hooks - BROWSERSTACK MODE
 *
 * Two modes:
 * 1. PARALLEL SPLIT MODE (WDIO_PARALLEL_EXECUTION=true):
 *    - First scenario: Uses initial session
 *    - Subsequent scenarios: Reload session with next device from pool + locale from tags
 *    - Result: N scenarios = N BrowserStack sessions with device rotation
 *
 * 2. REGULAR MODE (WDIO_PARALLEL_EXECUTION=false):
 *    - First scenario: Uses initial session
 *    - Subsequent scenarios: Reload session with next device from pool
 *    - Result: N scenarios = N BrowserStack sessions with device rotation
 */

// Only register hooks if we're in BROWSERSTACK mode
if (isLocalMode()) {
  console.log('[BROWSERSTACK HOOKS] Skipped - Local mode detected');
} else {
  console.log('[BROWSERSTACK HOOKS] Registered - BrowserStack mode detected');

  // Track scenario execution count
  let scenarioCount = 0;
  let isFirstScenario = true;

  const parallelSplitMode = isParallelSplitMode();

  /**
   * Before each scenario: Manage BrowserStack session
   */
  Before({ timeout: 120000 }, async function (scenario) {
    scenarioCount++;

    if (parallelSplitMode) {
      await handleParallelSplitMode(scenario, scenarioCount);
    } else {
      await handleRegularBrowserStackMode(scenario, scenarioCount);
    }
  });

  /**
   * Handle parallel split mode (1 scenario per worker, multi-locale support)
   */
  async function handleParallelSplitMode(scenario: any, count: number): Promise<void> {
    const { locale, language, timezone } = extractLocaleFromScenario(scenario);

    // First scenario: use existing session
    if (isFirstScenario) {
      isFirstScenario = false;
      console.log(`\n[BS PARALLEL] 🚀 Parallel split mode - first scenario`);
      console.log(`[BS PARALLEL]    Scenario: ${scenario.pickle.name}`);
      if (locale || language) {
        console.log(`[BS PARALLEL] 🌍 Locale: ${locale}, Language: ${language}`);
      }
      return;
    }

    // Subsequent scenarios: reload session with correct locale + next device
    try {
      console.log(`\n[BS PARALLEL] 🔄 Reloading session for scenario #${count}`);
      console.log(`[BS PARALLEL]    Scenario: ${scenario.pickle.name}`);

      // Get stored capabilities
      const storedCaps = getStoredCapabilities();
      if (!storedCaps) {
        console.error('[BS PARALLEL] ❌ No stored capabilities - cannot reload');
        return;
      }

      // Get next device from the pool
      const { getNextDevice } = require('../../support/capability-store');
      const nextDevice = getNextDevice();

      if (!nextDevice) {
        console.error('[BS PARALLEL] ❌ No devices in pool - cannot reload');
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
        if (timezone) {
          if (!newCaps['bstack:options']) {
            newCaps['bstack:options'] = {};
          }
          newCaps['bstack:options'].timezone = timezone;
          console.log(`[BS PARALLEL] 🌍 Locale: ${locale}, Language: ${language}, Timezone: ${timezone}`);
        } else {
          console.log(`[BS PARALLEL] 🌍 Locale: ${locale}, Language: ${language}`);
        }
      }

      console.log(`[BS PARALLEL] 🎯 Next device: ${nextDevice.name} (v${nextDevice.version})`);

      // Reload session with new device + locale
      await browser.reloadSession(newCaps);

      console.log(`[BS PARALLEL] ✅ New BrowserStack session created: ${driver.sessionId}`);

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
      console.error(`[BS PARALLEL] ❌ Error reloading session:`, error);
      throw error;
    }
  }

  /**
   * Handle regular BrowserStack mode (multiple scenarios in one worker)
   */
  async function handleRegularBrowserStackMode(scenario: any, count: number): Promise<void> {
    const { locale, language } = extractLocaleFromScenario(scenario);

    // First scenario: use existing session
    if (isFirstScenario) {
      isFirstScenario = false;
      console.log(`\n[BS] 🚀 Starting first scenario (worker's initial session)`);
      console.log(`[BS]    Scenario: ${scenario.pickle.name}`);
      if (locale || language) {
        console.log(`[BS] ℹ️  Tags: locale=${locale}, language=${language}`);
      }
      return;
    }

    // Subsequent scenarios: reload session to get new BrowserStack session + device
    try {
      console.log(`\n[BS] 🔄 Reloading session for scenario #${count} (BrowserStack)`);
      console.log(`[BS]    Scenario: ${scenario.pickle.name}`);

      // Get the original capabilities from the config
      const storedCaps = getStoredCapabilities();
      if (!storedCaps) {
        console.error('[BS] ❌ No stored capabilities - cannot reload');
        return;
      }

      // Get next device from the pool (round-robin)
      const { getNextDevice } = require('../../support/capability-store');
      const nextDevice = getNextDevice();

      if (!nextDevice) {
        console.error('[BS] ❌ No devices in pool - cannot reload');
        return;
      }

      // Clone capabilities and update with next device
      const newCaps = JSON.parse(JSON.stringify(storedCaps)) as any;
      newCaps['appium:deviceName'] = nextDevice.name;
      newCaps['appium:platformVersion'] = nextDevice.version;

      console.log(`[BS] 🎯 Next device: ${nextDevice.name} (v${nextDevice.version})`);

      // Reload session with new device
      await browser.reloadSession(newCaps);

      console.log(`[BS] ✅ New BrowserStack session created: ${driver.sessionId}`);

      // Update BrowserStack session name to scenario name
      try {
        await browser.executeScript(
          `browserstack_executor: {"action": "setSessionName", "arguments": {"name": "${scenario.pickle.name}"}}`,
          []
        );
      } catch {
        // Ignore if session name update fails (non-critical)
      }

    } catch (error) {
      console.error(`[BS] ❌ Error reloading BrowserStack session:`, error);
      throw error;
    }
  }

  /**
   * After each scenario: Log completion status
   */
  After(async function (scenario) {
    const prefix = parallelSplitMode ? '[BS PARALLEL]' : '[BS]';
    logScenarioCompletion(scenario, prefix);
  });
}
