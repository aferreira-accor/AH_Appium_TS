/**
 * App configuration constants for local testing
 *
 * Contains package names, bundle IDs, and launch arguments for different app variants.
 * These configurations are used by local-capability-builder.ts to generate capabilities.
 */

import "dotenv/config";

// ----- Helper -----

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v : undefined;
}

// ----- App Configuration Constants -----

/**
 * App configurations for different platforms and build types
 */
export const APP_CONFIGS = {
  /** Firebase App Distribution (for testing internal builds) */
  firebase: {
    appPackage: "dev.firebase.appdistribution",
    appActivity: "dev.firebase.appdistribution.main.MainActivity",
  },

  /** Android Inhouse build (internal testing) */
  androidInhouse: {
    appPackage: "com.accor.appli.hybrid.inhouse",
    appActivity:
      "com.accor.appconfiguration.appconfiguration.view.AppConfigurationActivity",
  },

  /** Android Store build (production) */
  androidStore: {
    appPackage: "com.accor.appli.hybrid",
  },

  /** iOS Sandbox build (internal testing) */
  iosSandbox: {
    bundleId: "fr.accor.push.sandbox",
    /**
     * Get launch arguments for iOS Sandbox
     * Includes debug flags for test environment and auth token reset
     */
    getArguments: () => [
      "-debug_flushAuthToken",
      "true",  // Clear auth tokens on app launch (enables fresh start between scenarios)
      "-debug_environment",
      getEnv("IOS_SANDBOX_LOCAL_TEST_ENVIRONMENT") || "rec2",
      "-debug_qa_enable_ids",
      "true",
    ],
  },

  /** iOS Store build (production) */
  iosStore: {
    bundleId: "fr.accor.push",
    /**
     * Get launch arguments for iOS Store
     * ⚠️ iOS Store (RELEASE build) has NO debug flags compiled!
     * All process arguments are ignored:
     * - debug_qa_enable_ids → requires DEBUG_QA_ID_ENABLE (absent in Store)
     * - debug_environment → requires DEBUG_QA_PERSIST_SETTINGS (absent in Store)
     * - debug_flushAuthToken → requires !RELEASE (RELEASE is defined in Store)
     * See docs/IOS_ANDROID_RESET_DIFFERENCES.md for details
     */
    getArguments: () => [],  // No useful arguments in Store build
  },

  /** TestFlight (for TestFlight-based testing) */
  testflight: {
    bundleId: "com.apple.TestFlight",
  },
} as const;

// ----- Helper Functions -----

/**
 * Determine Android app package and activity based on tags
 * @param tags - Tag expression string
 * @returns Object with appPackage and optional appActivity
 */
export function determineAndroidAppFromTags(tags?: string): {
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

/**
 * Determine iOS bundle ID based on tags
 * @param tags - Tag expression string
 * @returns Bundle ID string
 */
export function determineIOSBundleFromTags(tags?: string): string {
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
