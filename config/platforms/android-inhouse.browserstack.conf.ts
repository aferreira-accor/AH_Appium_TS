import { createBrowserStackConfig } from "../capabilities/browserstack-config-builder";
import { generateAndroidInhouseCapabilities, generateAndroidCapabilitiesWithLocales } from "../capabilities/capability-builder";

/**
 * Configuration for Android Inhouse BrowserStack testing
 *
 * Environment variables used:
 * - ANDROID_INHOUSE_BS_PARALLEL_SESSIONS: Number of parallel test sessions
 * - ANDROID_INHOUSE_BS_TAGS: Cucumber tags filter (optional)
 * - ANDROID_INHOUSE_BS_BUILD_TYPE: Build type (DAILY or RELEASE)
 * - BROWSERSTACK_USERNAME: BrowserStack username
 * - BROWSERSTACK_ACCESS_KEY: BrowserStack access key
 */
export const config = createBrowserStackConfig({
  platform: 'android',
  buildType: 'inhouse',
  envPrefix: 'ANDROID_INHOUSE_BS',
  capabilityGenerator: generateAndroidInhouseCapabilities,
  capabilityGeneratorWithLocales: (locales) => generateAndroidCapabilitiesWithLocales(locales, 'inhouse'),
});