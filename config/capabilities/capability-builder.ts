import "dotenv/config";
import { type BrowserStackApp } from "./api/browserstack-apps-api";
import {
  fetchDevices,
  getAndroidDevices,
  getIOSDevices,
  type DeviceInfo,
} from "./api/browserstack-devices-api";
import {
  selectDevices,
  getDeviceSelectionConfig,
} from "./utils/device-selector";
import { resolveAppInfo } from "./utils/app-resolver";
import { resolveDevicesFromCache } from "./utils/device-cache-resolver";
import { BROWSERSTACK_PROJECT_NAME } from "./browserstack-config-builder";
import { getDefaultLocaleConfig, type LocaleConfig } from "./locale-configs";

// Global locale configuration - can be overridden by Cucumber steps
// Default is fr_FR (French market)
let activeLocaleConfig: LocaleConfig = getDefaultLocaleConfig();

/**
 * Set the active locale configuration for capability generation
 * This is called by Cucumber step definitions to configure locale-specific settings
 * @param localeConfig - Locale configuration to apply
 */
export function setActiveLocaleConfig(localeConfig: LocaleConfig): void {
  activeLocaleConfig = localeConfig;
}

/**
 * Get the current active locale configuration
 * @returns Current locale configuration
 */
export function getActiveLocaleConfig(): LocaleConfig {
  return activeLocaleConfig;
}

export interface DeviceConfig {
  name: string;
  version: string;
}

interface BrowserStackCapability {
  platformName: string;
  "appium:platformVersion": string;
  "appium:deviceName": string;
  "appium:automationName": string;
  "appium:app": string;
  "appium:appPackage"?: string;
  "appium:appActivity"?: string;
  "appium:bundleId"?: string;
  "appium:arguments"?: string[];
  "appium:newCommandTimeout"?: number;
  "appium:noReset"?: boolean;
  "appium:fullReset"?: boolean;
  // Locale settings
  "appium:language": string;
  "appium:locale": string;
  // Other Appium options
  "appium:ensureWebviewsHavePages"?: boolean;
  "appium:nativeWebScreenshot"?: boolean;
  "appium:connectHardwareKeyboard"?: boolean;
  "appium:autoGrantPermissions"?: boolean;
  "appium:disableSuppressAccessibilityService"?: boolean;
  "appium:skipServerInstallation"?: boolean;
  // Custom Appium options (official location for custom properties)
  "appium:options"?: {
    wdioLocaleId?: string;
    [key: string]: unknown;
  };
  "bstack:options": {
    // Project & Build identification
    projectName: string;
    buildName: string;

    // Connection & Infrastructure
    local: boolean;

    // Test Environment
    timezone?: string;
    geoLocation?: string;
    deviceOrientation?: "portrait" | "landscape";

    // Video & Debugging
    video: boolean;
    debug: boolean;
    interactiveDebugging: boolean;

    // Logs
    deviceLogs: boolean;
    appiumLogs: boolean;
    networkLogs: boolean;
    networkLogsOptions?: {
      captureContent: boolean;
    };
    networkLogsExcludeHosts?: string[];

    // Accessibility
    accessibility: boolean;
  };
}

// Android app configuration shape
interface AndroidAppConfig {
  packageName: string;
  mainActivity?: string;
}

// Hardcoded app configuration
const APP_CONFIG = {
  androidInhouse: {
    packageName: "com.accor.appli.hybrid.inhouse",
    mainActivity:
      "com.accor.appconfiguration.appconfiguration.view.AppConfigurationActivity",
  },
  androidStore: {
    packageName: "com.accor.appli.hybrid",
  },
  iosSandbox: {
    bundleId: "fr.accor.push.sandbox",
  },
  iosStore: {
    bundleId: "fr.accor.push",
  },
  browserStack: {
    projectName: BROWSERSTACK_PROJECT_NAME,
    newCommandTimeout: 300, // 5 minutes - handles queue wait time + long Android Inhouse startup
    idleTimeout: 120, // 2 minutes - cleanup zombie sessions faster (saves BrowserStack minutes)
    options: {
      // === Connection & Infrastructure ===
      local: false, // No local tunnel (tests run on BrowserStack cloud)

      // === Test Environment ===
      timezone: "Paris", // Europe/Paris timezone (overridden by locale config in multi-locale mode)
      // geoLocation: "FR", // DISABLED - Requires BrowserStack Enterprise plan
      deviceOrientation: "portrait" as const, // Force portrait mode for deterministic tests

      // === Video & Debugging ===
      video: true, // Record video of test execution
      debug: true, // Enable automatic screenshots for each Appium command
      interactiveDebugging: true, // Enable live debugging during test execution

      // === Logs ===
      deviceLogs: true, // Capture device logs (console, system logs)
      appiumLogs: true, // Capture raw Appium server logs
      networkLogs: true, // Capture network traffic (HAR format)
      networkLogsOptions: {
        captureContent: true, // Capture request/response bodies
      },
      // Exclude OneTrust domains from MITM proxy to allow certificate pinning
      networkLogsExcludeHosts: ["mobile-data.onetrust.io"],

      // === Accessibility ===
      accessibility: false, // Accessibility testing disabled (enable if needed)
    },
  },
};

/**
 * Generate build name for BrowserStack sessions
 */
function mapBuildLabel(
  platform: "android" | "ios",
  buildType: "inhouse" | "sandbox" | "store"
): string {
  if (platform === "android") {
    return buildType === "inhouse" ? "Android Inhouse" : "Android Store";
  }
  return buildType === "sandbox" ? "iOS Sandbox" : "iOS Store";
}

function generateBuildName(
  platform: "android" | "ios",
  buildType: "inhouse" | "sandbox" | "store",
  appVersion?: string
): string {
  const teamMember = process.env.TEAM_MEMBER;
  const label = mapBuildLabel(platform, buildType);
  const versionSuffix = appVersion ? ` - ${appVersion}` : "";
  return `${teamMember} - ${label}${versionSuffix}`;
}

// Re-export device functions from API module
export { fetchDevices, getAndroidDevices, getIOSDevices };

/**
 * Generate Android capabilities for BrowserStack (using cached devices)
 */
// ----- Helpers (small, focused) -----

function resolveApp(
  platform: "android" | "ios",
  buildType: "inhouse" | "sandbox" | "store"
): BrowserStackApp {
  const { app } = resolveAppInfo({ platform, buildType });
  return app;
}

function getCachedDevices(platform: "android" | "ios"): DeviceInfo[] {
  const { devices } = resolveDevicesFromCache({ platform });
  return devices;
}

function selectAndroidDevices(
  devices: DeviceInfo[],
  sessionCount: number,
  buildType: "inhouse" | "store"
) {
  const deviceConfig = getDeviceSelectionConfig("android", buildType);
  return selectDevices({
    devices,
    sessionCount,
    platform: "android",
    specificDeviceName: deviceConfig.specificDeviceName,
    useRandomSelection: deviceConfig.useRandomSelection,
  });
}

function selectIOSDevices(
  devices: DeviceInfo[],
  sessionCount: number,
  buildType: "sandbox" | "store"
) {
  const deviceConfig = getDeviceSelectionConfig("ios", buildType);

  return selectDevices({
    devices,
    sessionCount,
    platform: "ios",
    specificDeviceName: deviceConfig.specificDeviceName,
    useRandomSelection: deviceConfig.useRandomSelection,
  });
}

function buildAndroidCapability(
  device: DeviceInfo,
  app: BrowserStackApp,
  appConfig: AndroidAppConfig,
  buildType: "inhouse" | "store",
  localeConfig?: LocaleConfig
): BrowserStackCapability {
  const locale = localeConfig || getActiveLocaleConfig();
  const defaultConfig = getDefaultLocaleConfig();

  // Use provided values or fall back to defaults
  const language = locale.language ?? defaultConfig.language ?? "fr";
  const localeId = locale.locale ?? defaultConfig.locale ?? "fr_FR";
  const timezone = locale.timezone ?? defaultConfig.timezone ?? "Paris";

  // Create unique identifier for this exact locale+language+timezone combination
  // This allows filtering scenarios by the complete configuration, not just locale
  const uniqueLocaleId = `${localeId}__${language}__${timezone}`;

  const capability: BrowserStackCapability = {
    platformName: "Android",
    "appium:platformVersion": device.version,
    "appium:deviceName": device.name,
    "appium:automationName": "uiautomator2",
    "appium:app": app.app_url,
    "appium:appPackage": appConfig.packageName,
    "appium:newCommandTimeout": APP_CONFIG.browserStack.newCommandTimeout,
    "appium:noReset": false,
    "appium:fullReset": false,
    "appium:language": language,
    "appium:locale": localeId,
    // Store unique locale configuration ID for beforeSession hook (custom Appium options)
    "appium:options": {
      wdioLocaleId: uniqueLocaleId,
      wdioLocale: localeId,
      wdioLanguage: language,
      wdioTimezone: timezone,
    },
    "bstack:options": {
      projectName: APP_CONFIG.browserStack.projectName,
      buildName: generateBuildName("android", buildType, app.app_version),
      ...APP_CONFIG.browserStack.options,
      // Override timezone from active locale
      // Note: geoLocation disabled (requires BrowserStack Enterprise plan)
      timezone: timezone,
    },
  };

  if (appConfig.mainActivity) {
    capability["appium:appActivity"] = appConfig.mainActivity;
  }

  return capability;
}

function buildIOSArguments(buildType: "sandbox" | "store"): string[] | undefined {
  if (buildType === "store") {
    return undefined;
  }
  return [
    "-debug_environment",
    process.env.IOS_SANDBOX_BS_TEST_ENVIRONMENT!,
    "-debug_qa_enable_ids",
    "true",
  ];
}

function buildIOSCapability(
  device: DeviceInfo,
  app: BrowserStackApp,
  buildType: "sandbox" | "store",
  bundleId: string,
  localeConfig?: LocaleConfig
): BrowserStackCapability {
  const locale = localeConfig || getActiveLocaleConfig();
  const defaultConfig = getDefaultLocaleConfig();

  // Use provided values or fall back to defaults
  const language = locale.language ?? defaultConfig.language ?? "fr";
  const localeId = locale.locale ?? defaultConfig.locale ?? "fr_FR";
  const timezone = locale.timezone ?? defaultConfig.timezone ?? "Paris";

  // Create unique identifier for this exact locale+language+timezone combination
  // This allows filtering scenarios by the complete configuration, not just locale
  const uniqueLocaleId = `${localeId}__${language}__${timezone}`;

  return {
    platformName: "iOS",
    "appium:platformVersion": device.version,
    "appium:deviceName": device.name,
    "appium:automationName": "XCUITest",
    "appium:app": app.app_url,
    "appium:bundleId": bundleId,
    "appium:arguments": buildIOSArguments(buildType),
    "appium:newCommandTimeout": APP_CONFIG.browserStack.newCommandTimeout,
    "appium:noReset": false,
    "appium:fullReset": false,
    "appium:language": language,
    "appium:locale": localeId,
    // Store unique locale configuration ID for beforeSession hook (custom Appium options)
    "appium:options": {
      wdioLocaleId: uniqueLocaleId,
      wdioLocale: localeId,
      wdioLanguage: language,
      wdioTimezone: timezone,
    },
    "bstack:options": {
      projectName: APP_CONFIG.browserStack.projectName,
      buildName: generateBuildName("ios", buildType, app.app_version),
      ...APP_CONFIG.browserStack.options,
      // Override timezone from active locale
      // Note: geoLocation disabled (requires BrowserStack Enterprise plan)
      timezone: timezone,
    },
  };
}

// ----- Public generators -----

export function generateAndroidCapabilities(
  sessionCount: number,
  buildType?: "inhouse" | "store"
) {
  const effectiveBuild: "inhouse" | "store" = buildType ?? "inhouse";
  const app = resolveApp("android", effectiveBuild);
  const devices = getCachedDevices("android");

  // Determine device pool size based on configuration
  // If RANDOM_DEVICES is disabled (empty/false) AND a specific DEVICE_NAME is set:
  //   → Use pool of 1 device (the specific device)
  // Otherwise:
  //   → Use pool of 10 devices for rotation
  const deviceConfig = getDeviceSelectionConfig("android", effectiveBuild);
  const useSingleDevice = !deviceConfig.useRandomSelection && deviceConfig.specificDeviceName?.trim();
  const devicePoolSize = useSingleDevice ? 1 : 10;

  const deviceSelection = selectAndroidDevices(devices, devicePoolSize, effectiveBuild);
  const appConfig: AndroidAppConfig =
    effectiveBuild === "store"
      ? APP_CONFIG.androidStore
      : APP_CONFIG.androidInhouse;

  // Initialize device pool for session rotation (BrowserStack per-scenario sessions)
  const { setDevicePool } = require('../../tests/support/capability-store');
  const devicePoolData = deviceSelection.selectedDevices.map(d => ({ name: d.name, version: d.version }));
  setDevicePool(devicePoolData);

  console.log(`\n[DEVICE POOL] 🎲 Initialized pool with ${devicePoolData.length} device(s):`);
  devicePoolData.forEach((d, i) => {
    console.log(`[DEVICE POOL]   ${i + 1}. ${d.name} (v${d.version})`);
  });

  // In parallel mode (sessionCount=1), we create ONLY 1 capability
  // But the device pool has 10 devices for rotation via beforeSession hook
  const capabilities: BrowserStackCapability[] = [];
  for (let i = 0; i < sessionCount; i++) {
    capabilities.push(
      buildAndroidCapability(
        deviceSelection.selectedDevices[i],
        app,
        appConfig,
        effectiveBuild
      )
    );
  }
  return capabilities;
}

/**
 * Generate iOS capabilities for BrowserStack (using cached devices)
 */
export function generateiOSCapabilities(
  sessionCount: number,
  buildType?: "sandbox" | "store"
) {
  const effectiveBuild: "sandbox" | "store" = buildType ?? "sandbox";
  const app = resolveApp("ios", effectiveBuild);
  const devices = getCachedDevices("ios");

  // Determine device pool size based on configuration
  // If RANDOM_DEVICES is disabled (empty/false) AND a specific DEVICE_NAME is set:
  //   → Use pool of 1 device (the specific device)
  // Otherwise:
  //   → Use pool of 10 devices for rotation
  const deviceConfig = getDeviceSelectionConfig("ios", effectiveBuild);
  const useSingleDevice = !deviceConfig.useRandomSelection && deviceConfig.specificDeviceName?.trim();
  const devicePoolSize = useSingleDevice ? 1 : 10;

  const selection = selectIOSDevices(devices, devicePoolSize, effectiveBuild);
  const appConfig =
    effectiveBuild === "store" ? APP_CONFIG.iosStore : APP_CONFIG.iosSandbox;

  // Initialize device pool for session rotation (BrowserStack per-scenario sessions)
  const { setDevicePool } = require('../../tests/support/capability-store');
  const devicePoolData = selection.selectedDevices.map(d => ({ name: d.name, version: d.version }));
  setDevicePool(devicePoolData);

  console.log(`\n[DEVICE POOL] 🎲 Initialized pool with ${devicePoolData.length} device(s):`);
  devicePoolData.forEach((d, i) => {
    console.log(`[DEVICE POOL]   ${i + 1}. ${d.name} (v${d.version})`);
  });

  // In parallel mode (sessionCount=1), we create ONLY 1 capability
  // But the device pool has 10 devices for rotation via beforeSession hook
  const capabilities: BrowserStackCapability[] = [];
  for (let i = 0; i < sessionCount; i++) {
    capabilities.push(
      buildIOSCapability(
        selection.selectedDevices[i],
        app,
        effectiveBuild,
        appConfig.bundleId
      )
    );
  }
  return capabilities;
}

// Thin wrappers for readability in platform configs
export function generateAndroidInhouseCapabilities(sessionCount: number) {
  return generateAndroidCapabilities(sessionCount, "inhouse");
}

export function generateAndroidStoreCapabilities(sessionCount: number) {
  return generateAndroidCapabilities(sessionCount, "store");
}

export function generateIosSandboxCapabilities(sessionCount: number) {
  return generateiOSCapabilities(sessionCount, "sandbox");
}

export function generateIosStoreCapabilities(sessionCount: number) {
  return generateiOSCapabilities(sessionCount, "store");
}

/**
 * Generate iOS capabilities with specific locales
 * Creates one capability per locale, each with a different device
 * Used for multi-locale testing where each scenario runs on its corresponding locale
 * @param localeConfigs - Array of locale configurations to use
 * @param buildType - Build type (sandbox or store)
 * @returns Array of capabilities, one per locale
 */
export function generateiOSCapabilitiesWithLocales(
  localeConfigs: LocaleConfig[],
  buildType?: "sandbox" | "store"
) {
  const effectiveBuild: "sandbox" | "store" = buildType ?? "sandbox";
  const app = resolveApp("ios", effectiveBuild);
  const devices = getCachedDevices("ios");

  // Determine device pool size based on configuration
  // If RANDOM_DEVICES is disabled (empty/false) AND a specific DEVICE_NAME is set:
  //   → Use pool of 1 device (the specific device)
  // Otherwise:
  //   → Use pool of 10 devices for rotation
  const deviceConfig = getDeviceSelectionConfig("ios", effectiveBuild);
  const useSingleDevice = !deviceConfig.useRandomSelection && deviceConfig.specificDeviceName?.trim();
  const devicePoolSize = useSingleDevice ? 1 : 10;

  const selection = selectIOSDevices(devices, devicePoolSize, effectiveBuild);
  const appConfig =
    effectiveBuild === "store" ? APP_CONFIG.iosStore : APP_CONFIG.iosSandbox;

  // NOTE: Device pool initialization is done ONCE in browserstack-config-builder.ts
  // to avoid reinitializing it for each worker

  // Create one capability per locale
  // Each capability uses the FIRST device from pool, but rotation happens via beforeSession hook
  const capabilities: BrowserStackCapability[] = [];
  for (let i = 0; i < localeConfigs.length; i++) {
    capabilities.push(
      buildIOSCapability(
        selection.selectedDevices[0], // All capabilities start with first device (rotation via hook)
        app,
        effectiveBuild,
        appConfig.bundleId,
        localeConfigs[i]  // Pass specific locale config
      )
    );
  }

  // Return both capabilities and device selection for pool initialization
  return { capabilities, deviceSelection: selection.selectedDevices };
}

/**
 * Generate Android capabilities with specific locales
 * Creates one capability per locale, each with a different device
 * Used for multi-locale testing where each scenario runs on its corresponding locale
 * @param localeConfigs - Array of locale configurations to use
 * @param buildType - Build type (inhouse or store)
 * @returns Array of capabilities, one per locale
 */
export function generateAndroidCapabilitiesWithLocales(
  localeConfigs: LocaleConfig[],
  buildType?: "inhouse" | "store"
) {
  const effectiveBuild: "inhouse" | "store" = buildType ?? "inhouse";
  const app = resolveApp("android", effectiveBuild);
  const devices = getCachedDevices("android");

  // Determine device pool size based on configuration
  // If RANDOM_DEVICES is disabled (empty/false) AND a specific DEVICE_NAME is set:
  //   → Use pool of 1 device (the specific device)
  // Otherwise:
  //   → Use pool of 10 devices for rotation
  const deviceConfig = getDeviceSelectionConfig("android", effectiveBuild);
  const useSingleDevice = !deviceConfig.useRandomSelection && deviceConfig.specificDeviceName?.trim();
  const devicePoolSize = useSingleDevice ? 1 : 10;

  const deviceSelection = selectAndroidDevices(devices, devicePoolSize, effectiveBuild);
  const appConfig: AndroidAppConfig =
    effectiveBuild === "store"
      ? APP_CONFIG.androidStore
      : APP_CONFIG.androidInhouse;

  // NOTE: Device pool initialization is done ONCE in browserstack-config-builder.ts
  // to avoid reinitializing it for each worker

  // Create one capability per locale
  // Each capability uses the FIRST device from pool, but rotation happens via beforeSession hook
  const capabilities: BrowserStackCapability[] = [];
  for (let i = 0; i < localeConfigs.length; i++) {
    capabilities.push(
      buildAndroidCapability(
        deviceSelection.selectedDevices[0], // All capabilities start with first device (rotation via hook)
        app,
        appConfig,
        effectiveBuild,
        localeConfigs[i]  // Pass specific locale config
      )
    );
  }

  // Return both capabilities and device selection for pool initialization
  return { capabilities, deviceSelection: deviceSelection.selectedDevices };
}
