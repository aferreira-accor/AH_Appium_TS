import { createBrowserStackConfig } from "../capabilities/browserstack-config-builder";
import { generateAndroidStoreCapabilities, generateAndroidCapabilitiesWithLocales } from "../capabilities/capability-builder";

/**
 * Configuration for Android Store BrowserStack testing
 *
 * Environment variables used:
 * - ANDROID_STORE_BS_PARALLEL_SESSIONS: Number of parallel test sessions
 * - ANDROID_STORE_BS_TAGS: Cucumber tags filter (optional)
 * - BROWSERSTACK_USERNAME: BrowserStack username
 * - BROWSERSTACK_ACCESS_KEY: BrowserStack access key
 */
export const config = createBrowserStackConfig({
  platform: 'android',
  buildType: 'store',
  envPrefix: 'ANDROID_STORE_BS',
  capabilityGenerator: generateAndroidStoreCapabilities,
  capabilityGeneratorWithLocales: (locales) => generateAndroidCapabilitiesWithLocales(locales, 'store'),
});
