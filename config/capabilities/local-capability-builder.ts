import "dotenv/config";
import { filterDevicesByName } from "../utils/localDeviceFilter";
import { localDevices } from "../devices/local-devices";
import { config as baseConfig } from "../base.conf";
import { findMatchingFeatureFile } from "./utils/cucumber-tag-parser";
import { readFileSync } from "fs";

// ----- Helpers -----

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v : undefined;
}

function getFirstDevice(platform: "android" | "ios", deviceName?: string) {
  const devices = filterDevicesByName(localDevices[platform], deviceName);
  return devices[0];
}

/**
 * Extract locale and language from Cucumber tags
 * @param tags - Tag expression string (e.g., "@locale:fr_FR and @language:fr")
 * @returns Object with locale and language, or undefined if not found
 */
function extractLocaleFromTags(tags?: string): {
  locale?: string;
  language?: string;
} {
  if (!tags) return {};

  // Extract @locale:XX_YY
  const localeMatch = tags.match(/@locale:([a-z]{2}_[A-Z]{2})/);
  const locale = localeMatch ? localeMatch[1] : undefined;

  // Extract @language:XX
  const languageMatch = tags.match(/@language:([a-z]{2})/);
  const language = languageMatch ? languageMatch[1] : undefined;

  return { locale, language };
}

/**
 * Find all tags from matching scenario in feature files
 * This allows extracting @locale: and @language: tags even when filtering by other tags like @Test
 * @param tagExpression - Tag expression to filter scenarios (e.g., "@Test")
 * @returns All tags found on the matching scenario, joined as a string
 */
function findAllTagsFromMatchingScenario(
  tagExpression?: string
): string | undefined {
  if (!tagExpression) return undefined;

  try {
    // Find the feature file that contains scenarios matching the tag expression
    const specs = Array.isArray(baseConfig.specs)
      ? (baseConfig.specs.flat() as string[])
      : baseConfig.specs
      ? [baseConfig.specs as string]
      : [];

    const matchingFile = findMatchingFeatureFile(specs, tagExpression);
    if (!matchingFile) return undefined;

    // Read the feature file
    const content = readFileSync(matchingFile, "utf-8");
    const lines = content.split("\n");

    // Tags at Feature level (inherited by all scenarios)
    const featureTags: string[] = [];
    let scenarioTags: string[] = [];
    let foundFeature = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a tag line
      if (line.startsWith("@")) {
        const lineTags = line.split(/\s+/).filter((t) => t.startsWith("@"));

        if (!foundFeature) {
          // Before Feature line = Feature-level tags
          featureTags.push(...lineTags);
        } else {
          // After Feature line = Scenario-level tags
          scenarioTags.push(...lineTags);
        }
      }
      // Check if this is the Feature line
      else if (line.startsWith("Feature:")) {
        foundFeature = true;
      }
      // Check if this is a scenario line
      else if (line.startsWith("Scenario:")) {
        // Combine Feature tags + Scenario tags
        const allTags = [...featureTags, ...scenarioTags];
        const tagsStr = allTags.join(" ");

        // Check if scenario matches the tag expression
        if (tagsStr.includes(tagExpression.replace(/^@/, ""))) {
          // Found matching scenario, return all its tags (Feature + Scenario)
          return allTags.join(" ");
        }

        // Reset scenario tags for next scenario
        scenarioTags = [];
      }
    }
  } catch (error) {
    console.warn("[findAllTagsFromMatchingScenario] Error:", error);
  }

  return undefined;
}

/**
 * Extract locale and language from scenario tags, even when filtering by other tags
 * This function finds the matching scenario and extracts ALL its tags to get locale/language
 * @param tagExpression - Tag expression used for filtering (e.g., "@Test")
 * @returns Object with locale and language from the matching scenario
 */
function extractLocaleFromScenario(tagExpression?: string): {
  locale?: string;
  language?: string;
} {
  if (!tagExpression) return {};

  // First, find all tags from the matching scenario
  const allScenarioTags = findAllTagsFromMatchingScenario(tagExpression);

  // Then extract locale and language from those tags
  return extractLocaleFromTags(allScenarioTags);
}

// ----- App Configuration Constants -----

const APP_CONFIGS = {
  firebase: {
    appPackage: "dev.firebase.appdistribution",
    appActivity: "dev.firebase.appdistribution.MainActivity",
  },
  androidInhouse: {
    appPackage: "com.accor.appli.hybrid.inhouse",
    appActivity:
      "com.accor.appconfiguration.appconfiguration.view.AppConfigurationActivity",
  },
  androidStore: {
    appPackage: "com.accor.appli.hybrid",
  },
  iosSandbox: {
    bundleId: "fr.accor.push.sandbox",
    getArguments: () => [
      "-debug_environment",
      getEnv("IOS_SANDBOX_LOCAL_TEST_ENVIRONMENT") || "rec2",
      "-debug_qa_enable_ids",
      "true",
    ],
  },
  iosStore: {
    bundleId: "fr.accor.push",
  },
  testflight: {
    bundleId: "com.apple.TestFlight",
  },
} as const;

function determineAndroidAppFromTags(tags?: string): {
  appPackage: string;
  appActivity?: string;
} {
  if (
    tags?.match("@firebase and @android_inhouse") ||
    tags?.match("@firebase and @android_store") ||
    tags?.match("@firebase")
  ) {
    return APP_CONFIGS.firebase;
  }
  if (tags?.includes("@android_store")) {
    return APP_CONFIGS.androidStore;
  }
  // default to inhouse
  return APP_CONFIGS.androidInhouse;
}

function determineIOSBundleFromTags(tags?: string): string {
  if (
    tags?.match("@testflight and @ios_sandbox") ||
    tags?.match("@testflight and @ios_store") ||
    tags?.match("@testflight")
  ) {
    return APP_CONFIGS.testflight.bundleId;
  }
  if (tags?.includes("@ios_store")) {
    return APP_CONFIGS.iosStore.bundleId;
  }
  // default to sandbox
  return APP_CONFIGS.iosSandbox.bundleId;
}

/**
 * Helper function to generate a single capability for local testing
 * Session management (one session per scenario) is handled by session-management.hooks.ts
 * @param buildCapability - Function that builds a single capability
 * @returns Array with one capability (WebdriverIO always expects an array)
 */
function generateSingleCapability<T>(
  buildCapability: () => T
): T[] {
  // Always return a single capability
  // The session-management.hooks.ts will handle session restarts between scenarios
  return [buildCapability()];
}

// ----- Small builders to avoid duplication -----

type AndroidCapabilityInput = {
  platformVersion: string;
  udid: string;
  deviceName: string;
  appPackage: string;
  appActivity?: string;
  locale?: string;
  language?: string;
};

function buildSingleAndroidCapability(input: AndroidCapabilityInput) {
  const cap: Record<string, unknown> = {
    platformName: "Android",
    "appium:platformVersion": input.platformVersion,
    "appium:udid": input.udid,
    "appium:automationName": "uiautomator2",
    "appium:appPackage": input.appPackage,
    "appium:noReset": false,
    "appium:fullReset": false,
    "appium:newCommandTimeout": 300,
    "appium:deviceName": input.deviceName,
  };

  if (input.appActivity) cap["appium:appActivity"] = input.appActivity;

  // Apply locale and language if provided
  if (input.locale) cap["appium:locale"] = input.locale;
  if (input.language) cap["appium:language"] = input.language;

  // Store locale/language in options for beforeSession hook compatibility
  if (input.locale || input.language) {
    cap["appium:options"] = {
      wdioLocale: input.locale,
      wdioLanguage: input.language,
    };
  }

  return cap;
}

type IOSCapabilityInput = {
  platformVersion: string;
  deviceName: string;
  udid: string;
  bundleId: string;
  args?: string[];
  extra?: Record<string, unknown>;
  locale?: string;
  language?: string;
};

function buildSingleIOSCapability(input: IOSCapabilityInput) {
  const cap: Record<string, unknown> = {
    platformName: "iOS",
    "appium:platformVersion": input.platformVersion,
    "appium:deviceName": input.deviceName,
    "appium:udid": input.udid,
    "appium:automationName": "XCUITest",
    "appium:orientation": "PORTRAIT",
    "appium:bundleId": input.bundleId,
    "appium:noReset": false,
    "appium:fullReset": false,
    "appium:useNewWDA": true,
    "appium:showXcodeLog": true,
    "appium:newCommandTimeout": 300,
    "appium:webviewConnectTimeout": 5000,
    ...(input.extra || {}),
  };

  if (input.args) {
    cap["appium:processArguments"] = { args: input.args };
  }

  // Apply locale and language if provided
  if (input.locale) cap["appium:locale"] = input.locale;
  if (input.language) cap["appium:language"] = input.language;

  // Store locale/language in options for beforeSession hook compatibility
  if (input.locale || input.language) {
    cap["appium:options"] = {
      wdioLocale: input.locale,
      wdioLanguage: input.language,
    };
  }

  return cap;
}

// ----- Public API -----

export function generateLocalAndroidCapabilities() {
  // Try Firebase first, then Inhouse, then Store - at least one must be defined
  const deviceName =
    getEnv("ANDROID_FIREBASE_LOCAL_DEVICE_NAME") ??
    getEnv("ANDROID_INHOUSE_LOCAL_DEVICE_NAME") ??
    getEnv("ANDROID_STORE_LOCAL_DEVICE_NAME");

  if (!deviceName) {
    throw new Error(
      "At least one of ANDROID_FIREBASE_LOCAL_DEVICE_NAME, ANDROID_INHOUSE_LOCAL_DEVICE_NAME, or ANDROID_STORE_LOCAL_DEVICE_NAME must be defined"
    );
  }

  const device = getFirstDevice("android", deviceName);
  const tags =
    getEnv("ANDROID_FIREBASE_LOCAL_TAGS") ??
    getEnv("ANDROID_INHOUSE_LOCAL_TAGS") ??
    getEnv("ANDROID_STORE_LOCAL_TAGS");

  if (!tags) {
    throw new Error(
      "At least one of ANDROID_FIREBASE_LOCAL_TAGS, ANDROID_INHOUSE_LOCAL_TAGS, or ANDROID_STORE_LOCAL_TAGS must be defined"
    );
  }

  const app = determineAndroidAppFromTags(tags);

  return [
    buildSingleAndroidCapability({
      platformVersion: device.platformVersion,
      udid: device.udid,
      deviceName: device.deviceName,
      appPackage: app.appPackage,
      appActivity: app.appActivity,
    }),
  ];
}

export function generateLocalIOSCapabilities() {
  // Try TestFlight first, then Sandbox, then Store - at least one must be defined
  const deviceName =
    getEnv("IOS_TESTFLIGHT_LOCAL_DEVICE_NAME") ??
    getEnv("IOS_SANDBOX_LOCAL_DEVICE_NAME") ??
    getEnv("IOS_STORE_LOCAL_DEVICE_NAME");

  if (!deviceName) {
    throw new Error(
      "At least one of IOS_TESTFLIGHT_LOCAL_DEVICE_NAME, IOS_SANDBOX_LOCAL_DEVICE_NAME, or IOS_STORE_LOCAL_DEVICE_NAME must be defined"
    );
  }

  const device = getFirstDevice("ios", deviceName);
  const tags =
    getEnv("IOS_TESTFLIGHT_LOCAL_TAGS") ??
    getEnv("IOS_SANDBOX_LOCAL_TAGS") ??
    getEnv("IOS_STORE_LOCAL_TAGS");

  if (!tags) {
    throw new Error(
      "At least one of IOS_TESTFLIGHT_LOCAL_TAGS, IOS_SANDBOX_LOCAL_TAGS, or IOS_STORE_LOCAL_TAGS must be defined"
    );
  }

  const bundleId = determineIOSBundleFromTags(tags);

  const args =
    bundleId === APP_CONFIGS.iosSandbox.bundleId
      ? APP_CONFIGS.iosSandbox.getArguments()
      : undefined;

  const extra: Record<string, unknown> = {};
  if (bundleId === APP_CONFIGS.testflight.bundleId) {
    extra["appium:noReset"] = true;
    extra["appium:autoAcceptAlerts"] = true;
  }
  return [
    buildSingleIOSCapability({
      platformVersion: device.platformVersion,
      deviceName: device.deviceName,
      udid: device.udid,
      bundleId,
      args,
      extra,
    }),
  ];
}

// ----- Variant-specific wrappers -----
// These functions automatically detect locale and language from the matching scenario and apply them to the device
// Example: ANDROID_INHOUSE_LOCAL_TAGS="@Test" will find the scenario with @Test tag and extract its @locale: and @language: tags
// This allows filtering by any tag while still applying the scenario's locale configuration

export function generateLocalAndroidInhouseCapabilities() {
  const device = getFirstDevice(
    "android",
    getEnv("ANDROID_INHOUSE_LOCAL_DEVICE_NAME")
  );
  const tags = getEnv("ANDROID_INHOUSE_LOCAL_TAGS");

  // Extract locale from first matching scenario
  const { locale, language } = extractLocaleFromScenario(tags);

  // Convert locale to Android format if needed
  let androidLocale: string | undefined;
  let androidLanguage: string | undefined;

  if (language) {
    androidLanguage = language.toLowerCase();
  }

  if (locale) {
    // For Android: extract country code from locale and convert to UPPERCASE
    // Example: "en_US" -> "US", "fr_FR" -> "FR"
    androidLocale = locale.includes('_')
      ? locale.split('_')[1].toUpperCase()
      : locale.toUpperCase();
  }

  // Single capability - session management handled by hooks
  return generateSingleCapability(() =>
    buildSingleAndroidCapability({
      platformVersion: device.platformVersion,
      udid: device.udid,
      deviceName: device.deviceName,
      appPackage: APP_CONFIGS.androidInhouse.appPackage,
      appActivity: APP_CONFIGS.androidInhouse.appActivity,
      locale: androidLocale,
      language: androidLanguage,
    })
  );
}

export function generateLocalAndroidStoreCapabilities() {
  const device = getFirstDevice(
    "android",
    getEnv("ANDROID_STORE_LOCAL_DEVICE_NAME")
  );
  const tags = getEnv("ANDROID_STORE_LOCAL_TAGS");

  // Extract locale from first matching scenario
  const { locale, language } = extractLocaleFromScenario(tags);

  // Convert locale to Android format if needed
  let androidLocale: string | undefined;
  let androidLanguage: string | undefined;

  if (language) {
    androidLanguage = language.toLowerCase();
  }

  if (locale) {
    // For Android: extract country code from locale and convert to UPPERCASE
    // Example: "en_US" -> "US", "fr_FR" -> "FR"
    androidLocale = locale.includes('_')
      ? locale.split('_')[1].toUpperCase()
      : locale.toUpperCase();
  }

  // Single capability - session management handled by hooks
  return generateSingleCapability(() =>
    buildSingleAndroidCapability({
      platformVersion: device.platformVersion,
      udid: device.udid,
      deviceName: device.deviceName,
      appPackage: APP_CONFIGS.androidStore.appPackage,
      locale: androidLocale,
      language: androidLanguage,
      // No appActivity or appWaitActivity for store
    })
  );
}

export function generateLocalIosSandboxCapabilities() {
  const device = getFirstDevice("ios", getEnv("IOS_SANDBOX_LOCAL_DEVICE_NAME"));
  const tags = getEnv("IOS_SANDBOX_LOCAL_TAGS");

  // Extract locale from first matching scenario
  const { locale, language } = extractLocaleFromScenario(tags);

  // For iOS: use full locale format (e.g., "fr_FR")
  const iosLocale = locale;
  const iosLanguage = language?.toLowerCase();

  // Single capability - session management handled by hooks
  return generateSingleCapability(() =>
    buildSingleIOSCapability({
      platformVersion: device.platformVersion,
      deviceName: device.deviceName,
      udid: device.udid,
      bundleId: APP_CONFIGS.iosSandbox.bundleId,
      args: APP_CONFIGS.iosSandbox.getArguments(),
      locale: iosLocale,
      language: iosLanguage,
    })
  );
}

export function generateLocalIosStoreCapabilities() {
  const device = getFirstDevice("ios", getEnv("IOS_STORE_LOCAL_DEVICE_NAME"));
  const tags = getEnv("IOS_STORE_LOCAL_TAGS");

  // Extract locale from first matching scenario
  const { locale, language } = extractLocaleFromScenario(tags);

  // For iOS: use full locale format (e.g., "fr_FR")
  const iosLocale = locale;
  const iosLanguage = language?.toLowerCase();

  // Single capability - session management handled by hooks
  return generateSingleCapability(() =>
    buildSingleIOSCapability({
      platformVersion: device.platformVersion,
      deviceName: device.deviceName,
      udid: device.udid,
      bundleId: APP_CONFIGS.iosStore.bundleId,
      locale: iosLocale,
      language: iosLanguage,
    })
  );
}
