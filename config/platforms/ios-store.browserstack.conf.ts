import { createBrowserStackConfig } from "../capabilities/browserstack-config-builder";
import { generateIosStoreCapabilities, generateiOSCapabilitiesWithLocales } from "../capabilities/capability-builder";

/**
 * Configuration for iOS Store BrowserStack testing
 *
 * Environment variables used:
 * - IOS_STORE_BS_PARALLEL_SESSIONS: Number of parallel test sessions
 * - IOS_STORE_BS_TAGS: Cucumber tags filter (optional)
 * - BROWSERSTACK_USERNAME: BrowserStack username
 * - BROWSERSTACK_ACCESS_KEY: BrowserStack access key
 *
 * Multi-locale support:
 * When scenarios with different @locale:XX_YY or @American/@Japanese tags are detected,
 * the framework automatically creates one capability per locale.
 * Each worker then filters scenarios to run only those matching its locale.
 */
export const config = createBrowserStackConfig({
  platform: 'ios',
  buildType: 'store',
  envPrefix: 'IOS_STORE_BS',
  capabilityGenerator: generateIosStoreCapabilities,
  capabilityGeneratorWithLocales: (locales) => generateiOSCapabilitiesWithLocales(locales, 'store'),
});
