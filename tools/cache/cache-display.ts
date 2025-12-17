/**
 * Cache display and utility functions
 * Handles showing apps, cache status, and clearing cache
 */

import { existsSync, unlinkSync } from "fs";
import { fetchAllApps } from "../../config/capabilities/api/browserstack-apps-api";
import {
  readAppsCache,
  readDevicesCache,
  CACHE_PATHS,
  type CachedApp,
  type DualBuildCache,
} from "../../config/capabilities/api/cache";
import type { DeviceInfo } from "../../config/capabilities/api/browserstack-devices-api";
import { displayAppDetails, type AppPlatform } from "./app-cache";

/**
 * Validate app platform string
 */
function isValidAppPlatform(platform: string): platform is AppPlatform {
  return ["android-inhouse", "android-store", "ios-sandbox", "ios-store"].includes(platform);
}

/**
 * Calculate cache age in hours
 */
function getCacheAgeHours(timestamp: number): number {
  return Math.round((Date.now() - timestamp) / (1000 * 60 * 60));
}

/**
 * Show live apps currently uploaded on BrowserStack for a single platform
 */
async function showPlatformApps(platform: AppPlatform): Promise<void> {
  const platformConfig: Record<AppPlatform, { apiPlatform: "android" | "ios"; buildType: string; label: string }> = {
    "ios-store": { apiPlatform: "ios", buildType: "store", label: "iOS STORE" },
    "android-store": { apiPlatform: "android", buildType: "store", label: "ANDROID STORE" },
    "ios-sandbox": { apiPlatform: "ios", buildType: "sandbox", label: "iOS SANDBOX" },
    "android-inhouse": { apiPlatform: "android", buildType: "inhouse", label: "ANDROID INHOUSE" },
  };

  const config = platformConfig[platform];
  console.log(`\n📱 ${config.label} Apps on BrowserStack `);

  const apps = await fetchAllApps(config.apiPlatform, config.buildType as "store" | "sandbox" | "inhouse");

  if (apps && apps.length > 0) {
    apps.forEach((app, index) => {
      const prefix = index === 0 ? "  🔥 Latest:" : `  ${index + 1}.`;
      console.log(prefix);
      displayAppDetails(app, "      ");
      console.log(""); // Empty line between entries
    });
    console.log(`  📊 Total: ${apps.length} ${config.buildType} builds found (sorted by version)`);
  } else {
    console.log(`  ❌ No ${config.buildType} apps found for ${config.apiPlatform}`);
  }
}

/**
 * Show live apps currently uploaded on BrowserStack
 */
export async function showApps(platforms: string[]): Promise<void> {
  console.log("🔄 Fetching live apps from BrowserStack...");

  for (const platform of platforms) {
    if (!isValidAppPlatform(platform)) {
      console.error(
        `Invalid platform: ${platform}. Must be 'android-inhouse', 'android-store', 'ios-sandbox', or 'ios-store'.`
      );
      continue;
    }

    try {
      await showPlatformApps(platform);
    } catch (error) {
      console.error(`❌ Failed to fetch ${platform} apps:`, error);
    }
  }
}

/**
 * Display cached apps information
 */
function displayCachedApps(appsCache: ReturnType<typeof readAppsCache>): void {
  const platformMapping: Record<string, string> = {
    iosStore: "ios-store",
    androidStore: "android-store",
    iosSandbox: "ios-sandbox",
    androidInhouse: "android-inhouse",
  };

  const appPlatforms = ["androidInhouse", "androidStore", "iosSandbox", "iosStore"].filter(
    (p) => appsCache[p as keyof typeof appsCache]
  );

  if (appPlatforms.length === 0) return;

  console.log("📱 Cached Apps:");

  for (const platform of appPlatforms) {
    const displayName = platformMapping[platform] || platform;
    const cachedEntry = appsCache[platform as keyof typeof appsCache];

    // Handle store apps (single CachedApp)
    if (platform === "androidStore" || platform === "iosStore") {
      const cachedApp = cachedEntry as CachedApp;
      if (cachedApp?.app) {
        const age = getCacheAgeHours(cachedApp.timestamp);
        console.log(`  ${displayName} (cached ${age} hours ago):`);
        displayAppDetails(cachedApp.app, "    ");
      }
    }
    // Handle inhouse/sandbox apps (DualBuildCache)
    else {
      const dualCache = cachedEntry as DualBuildCache;
      if (dualCache?.daily || dualCache?.release) {
        console.log(`  ${displayName}:`);

        if (dualCache.daily?.app) {
          const age = getCacheAgeHours(dualCache.daily.timestamp);
          console.log(`    📅 DAILY (cached ${age} hours ago):`);
          displayAppDetails(dualCache.daily.app, "       ");
        }

        if (dualCache.release?.app) {
          const age = getCacheAgeHours(dualCache.release.timestamp);
          console.log(`    🚀 RELEASE (cached ${age} hours ago):`);
          displayAppDetails(dualCache.release.app, "       ");
        }
      }
    }
  }
  console.log("");
}

/**
 * Display cached devices information
 */
function displayCachedDevices(devicesCache: ReturnType<typeof readDevicesCache>): void {
  const devicePlatforms = ["androidDevices", "iosDevices"].filter(
    (p) => devicesCache[p as keyof typeof devicesCache]
  ) as ("androidDevices" | "iosDevices")[];

  if (devicePlatforms.length === 0) return;

  console.log("📱 Cached Devices:");

  for (const deviceKey of devicePlatforms) {
    const cachedDevices = devicesCache[deviceKey];
    if (!cachedDevices?.devices) continue;

    const platformName = deviceKey === "androidDevices" ? "android" : "ios";
    const age = getCacheAgeHours(cachedDevices.timestamp);

    console.log(`  ${platformName}: ${cachedDevices.devices.length} devices`);
    console.log(`    Cached: ${age} hours ago`);

    // Group devices by version for summary
    const devicesByVersion = cachedDevices.devices.reduce((acc, device: DeviceInfo) => {
      acc[device.version] = (acc[device.version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedVersions = Object.keys(devicesByVersion).sort(
      (a, b) => parseFloat(a) - parseFloat(b)
    );

    for (const version of sortedVersions) {
      console.log(`      • ${version}: ${devicesByVersion[version]} devices`);
    }
    console.log("");
  }
}

/**
 * Show cached app and device information
 */
export function showCache(): void {
  const appsCache = readAppsCache();
  const devicesCache = readDevicesCache();

  if (Object.keys(appsCache).length === 0 && Object.keys(devicesCache).length === 0) {
    console.log("📭 No cache data found");
    return;
  }

  displayCachedApps(appsCache);
  displayCachedDevices(devicesCache);
}

/**
 * Clear app and device caches
 */
export function clearCache(): void {
  try {
    let cleared = false;

    if (existsSync(CACHE_PATHS.APPS)) {
      unlinkSync(CACHE_PATHS.APPS);
      console.log("🗑️  Apps cache cleared");
      cleared = true;
    }

    if (existsSync(CACHE_PATHS.DEVICES)) {
      unlinkSync(CACHE_PATHS.DEVICES);
      console.log("🗑️  Devices cache cleared");
      cleared = true;
    }

    if (!cleared) {
      console.log("📭 No cache to clear");
    }
  } catch (error) {
    console.error("❌ Failed to clear cache:", error);
  }
}
