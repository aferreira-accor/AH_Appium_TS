import { Given } from "@wdio/cucumber-framework";
import { setActiveLocaleConfig } from "../../../config/capabilities/capability-builder";
import { parseLocaleFromTable } from "../../../config/capabilities/locale-configs";

/**
 * Cucumber step to configure locale settings for international testing
 *
 * IMPORTANT: Due to WebdriverIO/BrowserStack limitations, this step does NOT
 * restart the session. Instead, it configures the locale BEFORE the next test runs.
 *
 * For the locale to take effect, you must:
 * 1. Set the locale configuration in a Before hook OR
 * 2. Use this step and then manually restart your test run
 *
 * The recommended approach is to use Scenario Outline with environment variables
 * or to configure locale in wdio hooks.
 *
 * @example Gherkin usage:
 * ```gherkin
 * Given I configure the user environment with:
 *   | language   | locale | timezone |
 *   | fr         | fr_FR  | Paris    |
 * ```
 */
Given(
  "I configure the user environment with:",
  async function (dataTable: any) {
    // Parse locale configuration from Gherkin table
    const newLocaleConfig = parseLocaleFromTable(dataTable);

    console.log(
      `[LOCALE] Requested locale configuration: ${newLocaleConfig.locale}`
    );
    console.log(`  - Language: ${newLocaleConfig.language}`);
    console.log(`  - Timezone: ${newLocaleConfig.timezone}`);

    // Update the active locale configuration for future session creation
    setActiveLocaleConfig(newLocaleConfig);

    // Get current session capabilities to compare
    const currentCapabilities = (driver as any).capabilities;
    const currentLanguage = currentCapabilities["appium:language"];
    const currentLocale = currentCapabilities["appium:locale"];

    console.log(`[LOCALE] Current session locale: ${currentLocale} (${currentLanguage})`);
    console.log(`[LOCALE] Requested locale: ${newLocaleConfig.locale} (${newLocaleConfig.language})`);

    // Check if locale matches
    if (
      currentLanguage === newLocaleConfig.language &&
      currentLocale === newLocaleConfig.locale
    ) {
      console.log(`[LOCALE] ✓ Session already configured with requested locale`);
    } else {
      console.warn(
        `[LOCALE] ⚠ WARNING: Current session has different locale. ` +
        `Locale changes require a new test session to take effect.`
      );
      console.warn(
        `[LOCALE] This step is informational only. To test with different locales, ` +
        `use separate test runs with environment variables or wdio hooks.`
      );
    }

    // Store locale in Cucumber World for assertions
    this.expectedLocale = newLocaleConfig;
  }
);

/**
 * Alternative step using predefined locale identifiers
 *
 * @example Gherkin usage:
 * ```gherkin
 * Given I configure the environment for "fr_FR"
 * Given I configure the environment for "en_US"
 * Given I configure the environment for "ja_JP"
 * ```
 */
Given(
  'I configure the environment for {string}',
  async function (localeId: string) {
    const { getLocaleConfig } = await import(
      "../../../config/capabilities/locale-configs"
    );

    const newLocaleConfig = getLocaleConfig(localeId);

    console.log(
      `[LOCALE] Requested predefined locale: ${localeId}`
    );

    setActiveLocaleConfig(newLocaleConfig);

    // Get current session capabilities
    const currentCapabilities = (driver as any).capabilities;
    const currentLanguage = currentCapabilities["appium:language"];
    const currentLocale = currentCapabilities["appium:locale"];

    console.log(`[LOCALE] Current session: ${currentLocale} (${currentLanguage})`);
    console.log(`[LOCALE] Requested: ${newLocaleConfig.locale} (${newLocaleConfig.language})`);

    if (
      currentLanguage === newLocaleConfig.language &&
      currentLocale === newLocaleConfig.locale
    ) {
      console.log(`[LOCALE] ✓ Session already configured with ${localeId}`);
    } else {
      console.warn(
        `[LOCALE] ⚠ WARNING: Session has different locale. ` +
        `Use separate test runs for different locales.`
      );
    }

    this.expectedLocale = newLocaleConfig;
  }
);
