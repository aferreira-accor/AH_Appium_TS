/**
 * Shared utilities for session management hooks
 * Used by both local and BrowserStack session management
 */

/**
 * Extract locale and language from scenario tags
 * @param scenario Cucumber scenario object
 * @returns Object with locale and language, or undefined if not found
 */
export function extractLocaleFromScenario(scenario: any): {
  locale?: string;
  language?: string;
  timezone?: string;
} {
  const tags = scenario.pickle.tags.map((tag: any) => tag.name);

  const localeTag = tags.find((tag: string) => tag.startsWith('@locale:'));
  const locale = localeTag ? localeTag.replace('@locale:', '') : undefined;

  const languageTag = tags.find((tag: string) => tag.startsWith('@language:'));
  const language = languageTag ? languageTag.replace('@language:', '') : undefined;

  const timezoneTag = tags.find((tag: string) => tag.startsWith('@timezone:'));
  const timezone = timezoneTag ? timezoneTag.replace('@timezone:', '') : undefined;

  return { locale, language, timezone };
}

/**
 * Check if we're running in local mode (not BrowserStack)
 * @returns true if local mode, false if BrowserStack mode
 */
export function isLocalMode(): boolean {
  return process.env.EXECUTION_TYPE === 'local' || !process.env.BROWSERSTACK_USERNAME;
}

/**
 * Check if we're in parallel split mode (1 scenario per worker)
 * @returns true if parallel split mode
 */
export function isParallelSplitMode(): boolean {
  return process.env.WDIO_PARALLEL_EXECUTION === 'true';
}

/**
 * Check if the app needs to be restarted to show the configuration screen
 * ONLY android-inhouse has the AppConfigurationActivity screen
 * - ios-sandbox: Uses Appium arguments (no restart needed)
 * - android-store: No configuration screen
 * - ios-store: No configuration screen
 * @returns true if app restart is required (android-inhouse only)
 */
export function requiresAppRestart(): boolean {
  // ONLY android-inhouse requires app restart to display configuration screen
  return !!process.env.ANDROID_INHOUSE_LOCAL_TEST_ENVIRONMENT;
}

/**
 * Log scenario completion status
 * @param scenario Cucumber scenario object
 * @param prefix Optional prefix for logs (e.g., "[LOCAL]", "[BS]")
 */
export function logScenarioCompletion(scenario: any, prefix: string = '[SESSION]'): void {
  const status = scenario.result?.status || 'UNKNOWN';
  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`\n${prefix} ${icon} Scenario completed: ${scenario.pickle.name} (${status})`);
}
