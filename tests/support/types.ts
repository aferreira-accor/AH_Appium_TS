/**
 * Shared type definitions for the test automation framework
 */

// ============================================
// Cucumber Types
// ============================================

/**
 * Cucumber tag object from pickle
 */
export interface CucumberTag {
  name: string;
  id?: string;
}

/**
 * Cucumber pickle (parsed scenario)
 */
export interface CucumberPickle {
  id: string;
  uri: string;
  name: string;
  language: string;
  steps: readonly {
    id: string;
    text: string;
    argument?: unknown;
  }[];
  tags: readonly CucumberTag[];
}

/**
 * Cucumber scenario result
 */
export interface CucumberResult {
  status: string;  // Status from Cucumber (PASSED, FAILED, SKIPPED, PENDING, UNDEFINED, AMBIGUOUS, etc.)
  duration?: number | { seconds: number; nanos: number };
  message?: string;
  error?: Error;
}

/**
 * Cucumber scenario object passed to hooks
 */
export interface CucumberScenario {
  pickle: CucumberPickle;
  result?: CucumberResult;
  gherkinDocument?: {
    uri?: string;
    feature?: {
      name?: string;
      description?: string;
    };
  };
}

// ============================================
// Device Types
// ============================================

/**
 * Device information from BrowserStack or local config
 */
export interface DeviceInfo {
  name: string;
  version: string;
}

/**
 * Device pool for session rotation
 */
export interface DevicePool {
  devices: DeviceInfo[];
  counter: number;
}

// ============================================
// Capability Types
// ============================================

/**
 * Base Appium options stored in capabilities
 */
export interface AppiumOptions {
  wdioLocale?: string;
  wdioLanguage?: string;
  wdioTimezone?: string;
  wdioLocaleId?: string;
  wdioDevicePool?: DeviceInfo[];
  [key: string]: unknown;
}

/**
 * BrowserStack options in capabilities
 */
export interface BrowserStackOptions {
  projectName?: string;
  buildName?: string;
  timezone?: string;
  geoLocation?: string;
  deviceOrientation?: 'portrait' | 'landscape';
  video?: boolean;
  debug?: boolean;
  local?: boolean;
  [key: string]: unknown;
}

/**
 * WebdriverIO/Appium capabilities
 */
export interface AppiumCapabilities {
  platformName: string;
  'appium:platformVersion'?: string;
  'appium:deviceName'?: string;
  'appium:automationName'?: string;
  'appium:app'?: string;
  'appium:bundleId'?: string;
  'appium:appPackage'?: string;
  'appium:appActivity'?: string;
  'appium:language'?: string;
  'appium:locale'?: string;
  'appium:noReset'?: boolean;
  'appium:fullReset'?: boolean;
  'appium:newCommandTimeout'?: number;
  'appium:options'?: AppiumOptions;
  'bstack:options'?: BrowserStackOptions;
  specs?: string[];
  maxInstances?: number;
  [key: string]: unknown;
}

// ============================================
// Locale Types
// ============================================

/**
 * Locale configuration extracted from tags or config
 */
export interface LocaleConfig {
  locale?: string;
  language?: string;
  timezone?: string;
  specsPath?: string;
}

/**
 * Result from capability generator with locales
 */
export interface CapabilityGeneratorResult {
  capabilities: AppiumCapabilities[];
  deviceSelection: DeviceInfo[];
}
