import { createBrowserStackConfig } from "../capabilities/browserstack-config-builder";
import { generateIosSandboxCapabilities, generateiOSCapabilitiesWithLocales } from "../capabilities/capability-builder";

/**
 * Configuration for iOS Sandbox BrowserStack testing
 *
 * Environment variables used:
 * - IOS_SANDBOX_BS_PARALLEL_SESSIONS: Number of parallel test sessions
 * - IOS_SANDBOX_BS_TAGS: Cucumber tags filter (optional)
 * - IOS_SANDBOX_BS_BUILD_TYPE: Build type (DAILY or RELEASE)
 * - IOS_SANDBOX_BS_TEST_ENVIRONMENT: Test environment for debug arguments
 * - BROWSERSTACK_USERNAME: BrowserStack username
 * - BROWSERSTACK_ACCESS_KEY: BrowserStack access key
 */
export const config = createBrowserStackConfig({
  platform: 'ios',
  buildType: 'sandbox',
  envPrefix: 'IOS_SANDBOX_BS',
  capabilityGenerator: generateIosSandboxCapabilities,
  capabilityGeneratorWithLocales: (locales) => generateiOSCapabilitiesWithLocales(locales, 'sandbox'),
});
