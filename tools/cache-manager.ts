#!/usr/bin/env ts-node

import "dotenv/config";
import { existsSync, unlinkSync } from "fs";
import {
  fetchLatestApp,
  fetchAllApps,
  type BrowserStackApp,
} from "../config/capabilities/api/browserstack-apps-api";
import {
  fetchDevices,
  type DeviceInfo,
} from "../config/capabilities/api/browserstack-devices-api";
import {
  readAppsCache,
  writeAppsCache,
  readDevicesCache,
  writeDevicesCache,
  CACHE_PATHS,
  type CachedApp,
  DualBuildCache,
} from "../config/capabilities/api/cache";

// Default minimum OS versions for device caching
// These ensure we only cache devices with recent, well-supported OS versions
const DEFAULT_MIN_ANDROID_VERSION = "14.0"; // Android 14+ (Google Play support)
const DEFAULT_MIN_IOS_VERSION = "17"; // iOS 17+ (Active Apple support)

// Default cache size (matches typical thread count)
const DEFAULT_CACHE_SIZE = 10;

// Maximum tablets per platform
const MAX_TABLETS_ANDROID = 2;
const MAX_TABLETS_IOS = 2;

/**
 * Smart device selection that ensures balanced distribution
 * - Guarantees exactly 2 tablets per platform
 * - Balanced OS version distribution
 * - Brand diversity for remaining phones
 */
function smartSelectDevices(
  devices: DeviceInfo[],
  targetCount: number,
  platform: "android" | "ios"
): DeviceInfo[] {
  if (devices.length <= targetCount) {
    return devices;
  }

  // Detect tablets
  const isTablet = (name: string) => {
    if (platform === "android") {
      return /\bTab\b/i.test(name);
    } else {
      return /\biPad\b/i.test(name);
    }
  };

  // Extract brand from device name
  const getBrand = (name: string): string => {
    if (platform === "android") {
      if (name.includes("Samsung")) return "Samsung";
      if (name.includes("Google") || name.includes("Pixel")) return "Google";
      if (name.includes("OnePlus")) return "OnePlus";
      if (name.includes("Motorola")) return "Motorola";
      if (name.includes("Xiaomi")) return "Xiaomi";
      if (name.includes("Oppo")) return "Oppo";
      if (name.includes("Vivo")) return "Vivo";
      if (name.includes("Huawei")) return "Huawei";
      return "Other";
    } else {
      // iOS: all Apple
      return "Apple";
    }
  };

  // Separate phones and tablets
  const allPhones = devices.filter((d) => !isTablet(d.name));
  const allTablets = devices.filter((d) => isTablet(d.name));

  const minTablets = platform === "android" ? MAX_TABLETS_ANDROID : MAX_TABLETS_IOS;
  const selected: DeviceInfo[] = [];

  // Step 1: First, select 2 tablets (if available) with different OS versions
  if (allTablets.length > 0) {
    const tabletsToSelect = Math.min(minTablets, allTablets.length);

    // Group tablets by OS version
    const tabletsByVersion = allTablets.reduce((acc, tablet) => {
      const version = tablet.version;
      if (!acc[version]) acc[version] = [];
      acc[version].push(tablet);
      return acc;
    }, {} as Record<string, DeviceInfo[]>);

    const tabletVersions = Object.keys(tabletsByVersion).sort((a, b) => parseFloat(b) - parseFloat(a));

    // Select tablets from different OS versions (one per version if possible)
    for (const version of tabletVersions) {
      if (selected.length >= tabletsToSelect) break;
      // Take the first tablet from this OS version
      selected.push(tabletsByVersion[version][0]);
    }
  }

  // Step 2: Select remaining devices from phones with balanced OS distribution
  const remainingSlots = targetCount - selected.length;

  if (remainingSlots > 0 && allPhones.length > 0) {
    // Group phones by OS version
    const phonesByVersion = allPhones.reduce((acc, device) => {
      const version = device.version;
      if (!acc[version]) acc[version] = [];
      acc[version].push(device);
      return acc;
    }, {} as Record<string, DeviceInfo[]>);

    const versions = Object.keys(phonesByVersion).sort((a, b) => parseFloat(b) - parseFloat(a));
    const brandCounts: Record<string, number> = {};

    // Calculate phones per version for balanced distribution
    const phonesPerVersion = Math.ceil(remainingSlots / versions.length);

    // Select phones from each version
    for (const version of versions) {
      if (selected.length >= targetCount) break;

      const versionPhones = phonesByVersion[version];
      const maxForThisVersion = Math.min(phonesPerVersion, targetCount - selected.length);

      // Sort phones by brand diversity (prefer brands we haven't used much)
      versionPhones.sort((a, b) => {
        const brandA = getBrand(a.name);
        const brandB = getBrand(b.name);
        const countA = brandCounts[brandA] || 0;
        const countB = brandCounts[brandB] || 0;
        return countA - countB;
      });

      // Add phones from this version
      let versionCount = 0;
      for (const device of versionPhones) {
        if (versionCount >= maxForThisVersion || selected.length >= targetCount) break;

        const brand = getBrand(device.name);
        selected.push(device);
        brandCounts[brand] = (brandCounts[brand] || 0) + 1;
        versionCount++;
      }
    }

    // If we still need more devices, fill from remaining phones
    if (selected.length < targetCount) {
      const remaining = allPhones.filter((d) => !selected.includes(d));
      const needed = targetCount - selected.length;
      selected.push(...remaining.slice(0, needed));
    }
  }

  return selected.slice(0, targetCount);
}

/**
 * Helper function to display all BrowserStackApp fields consistently
 */
function displayAppDetails(app: BrowserStackApp, prefix: string = "     ") {
  console.log(`${prefix} app_name: ${app.app_name}`);
  console.log(`${prefix} app_version: ${app.app_version}`);
  console.log(`${prefix} app_url: ${app.app_url}`);
  console.log(`${prefix} app_id: ${app.app_id}`);
  console.log(`${prefix} uploaded_at: ${app.uploaded_at}`);
  if (app.custom_id) {
    console.log(`${prefix} custom_id: ${app.custom_id}`);
  }
  if (app.shareable_id) {
    console.log(`${prefix} shareable_id: ${app.shareable_id}`);
  }
}

/**
 * Update apps cache for specified platforms
 */
async function updateApps(
  platforms: string[] = ["android-inhouse", "ios-sandbox"]
) {
  const cache = readAppsCache();

  for (const platform of platforms) {
    if (
      platform !== "android-inhouse" &&
      platform !== "android-store" &&
      platform !== "ios-sandbox" &&
      platform !== "ios-store"
    ) {
      console.error(
        `Invalid platform: ${platform}. Must be 'android-inhouse', 'android-store', 'ios-sandbox', or 'ios-store'.`
      );
      continue;
    }

    try {
      if (platform === "ios-store") {
        console.log(`🔄 Fetching latest iOS store app...`);
        const app = await fetchLatestApp("ios", "store");

        cache.iosStore = {
          app,
          timestamp: Date.now(),
        };

        console.log(`✅ ios-store: ${app.app_url} (v${app.app_version})`);
      } else if (platform === "android-store") {
        console.log(
          `🔄 Fetching Android store apps (will select Google prod pipeline)...`
        );
        const allStoreApps = await fetchAllApps("android", "store");
        const preferred = allStoreApps.find((a) =>
          a.custom_id?.startsWith("PipelineGoogleProdRelease_googleProdRelease")
        );

        if (!preferred) {
          throw new Error(
            "No Android store app found for PipelineGoogleProdRelease_googleProdRelease"
          );
        }

        cache.androidStore = {
          app: preferred,
          timestamp: Date.now(),
        };

        console.log(
          `✅ android-store: ${preferred.app_url} (v${preferred.app_version})`
        );
      } else if (platform === "ios-sandbox") {
        console.log(`🔄 Fetching iOS sandbox apps (DAILY + RELEASE)...`);

        // Save current env var
        const originalBuildType = process.env.IOS_SANDBOX_BS_BUILD_TYPE;

        let dailyApp = null;
        let releaseApp = null;

        // Fetch DAILY build
        try {
          process.env.IOS_SANDBOX_BS_BUILD_TYPE = "DAILY";
          dailyApp = await fetchLatestApp("ios", "sandbox");
          console.log(
            `   ✅ DAILY: ${dailyApp.app_url} (v${dailyApp.app_version})`
          );
        } catch {
          console.log(
            `   ⚠️  DAILY: Not found in recent 100 apps (too old or not uploaded yet)`
          );
        }

        // Fetch RELEASE build
        try {
          process.env.IOS_SANDBOX_BS_BUILD_TYPE = "RELEASE";
          releaseApp = await fetchLatestApp("ios", "sandbox");
          console.log(
            `   ✅ RELEASE: ${releaseApp.app_url} (v${releaseApp.app_version})`
          );
        } catch {
          console.log(
            `   ⚠️  RELEASE: Not found in recent 100 apps (too old or not uploaded yet)`
          );
        }

        // Restore original env var
        if (originalBuildType) {
          process.env.IOS_SANDBOX_BS_BUILD_TYPE = originalBuildType;
        } else {
          delete process.env.IOS_SANDBOX_BS_BUILD_TYPE;
        }

        // Only cache if at least one build was found
        if (!dailyApp && !releaseApp) {
          throw new Error("Neither DAILY nor RELEASE builds found for ios-sandbox");
        }

        cache.iosSandbox = {
          daily: dailyApp ? {
            app: dailyApp,
            timestamp: Date.now(),
          } : undefined,
          release: releaseApp ? {
            app: releaseApp,
            timestamp: Date.now(),
          } : undefined,
        };

        if (dailyApp && releaseApp) {
          console.log(`✅ ios-sandbox: Cached both DAILY and RELEASE builds`);
        } else if (dailyApp) {
          console.log(`✅ ios-sandbox: Cached DAILY build only`);
        } else {
          console.log(`✅ ios-sandbox: Cached RELEASE build only`);
        }
      } else if (platform === "android-inhouse") {
        console.log(`🔄 Fetching Android inhouse apps (DAILY + RELEASE)...`);

        // Save current env var
        const originalBuildType = process.env.ANDROID_INHOUSE_BS_BUILD_TYPE;

        let dailyApp = null;
        let releaseApp = null;

        // Fetch DAILY build
        try {
          process.env.ANDROID_INHOUSE_BS_BUILD_TYPE = "DAILY";
          dailyApp = await fetchLatestApp("android", "inhouse");
          console.log(
            `   ✅ DAILY: ${dailyApp.app_url} (v${dailyApp.app_version})`
          );
        } catch {
          console.log(
            `   ⚠️  DAILY: Not found in recent 100 apps (too old or not uploaded yet)`
          );
        }

        // Fetch RELEASE build
        try {
          process.env.ANDROID_INHOUSE_BS_BUILD_TYPE = "RELEASE";
          releaseApp = await fetchLatestApp("android", "inhouse");
          console.log(
            `   ✅ RELEASE: ${releaseApp.app_url} (v${releaseApp.app_version})`
          );
        } catch {
          console.log(
            `   ⚠️  RELEASE: Not found in recent 100 apps (too old or not uploaded yet)`
          );
        }

        // Restore original env var
        if (originalBuildType) {
          process.env.ANDROID_INHOUSE_BS_BUILD_TYPE = originalBuildType;
        } else {
          delete process.env.ANDROID_INHOUSE_BS_BUILD_TYPE;
        }

        // Only cache if at least one build was found
        if (!dailyApp && !releaseApp) {
          throw new Error("Neither DAILY nor RELEASE builds found for android-inhouse");
        }

        cache.androidInhouse = {
          daily: dailyApp ? {
            app: dailyApp,
            timestamp: Date.now(),
          } : undefined,
          release: releaseApp ? {
            app: releaseApp,
            timestamp: Date.now(),
          } : undefined,
        };

        if (dailyApp && releaseApp) {
          console.log(`✅ android-inhouse: Cached both DAILY and RELEASE builds`);
        } else if (dailyApp) {
          console.log(`✅ android-inhouse: Cached DAILY build only`);
        } else {
          console.log(`✅ android-inhouse: Cached RELEASE build only`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to update ${platform}:`, error);
    }
  }

  writeAppsCache(cache);
  console.log(`📁 Apps cache updated: ${CACHE_PATHS.APPS}`);
}

/**
 * Show available devices for specified platforms
 */
async function showDevices(
  platforms: string[],
  minVersion?: string,
  maxVersion?: string
) {
  for (const platform of platforms) {
    if (platform !== "android" && platform !== "ios") {
      console.error(
        `Invalid platform: ${platform}. Must be 'android' or 'ios'.`
      );
      continue;
    }

    try {
      console.log(`🔄 Fetching available ${platform} devices...`);
      let devices = await fetchDevices(platform as "android" | "ios");

      // Filter by OS version if specified
      if (minVersion || maxVersion) {
        const beforeFilterCount = devices.length;

        if (minVersion) {
          const min = parseFloat(minVersion);
          devices = devices.filter(
            (device: DeviceInfo) => parseFloat(device.version) >= min
          );
        }

        if (maxVersion) {
          const max = parseFloat(maxVersion);
          devices = devices.filter(
            (device: DeviceInfo) => parseFloat(device.version) <= max
          );
        }

        const filterDesc = minVersion && maxVersion
          ? `${minVersion} <= OS <= ${maxVersion}`
          : minVersion
          ? `OS >= ${minVersion}`
          : `OS <= ${maxVersion}`;

        console.log(
          `📱 ${platform.toUpperCase()} Devices (${devices.length}/${beforeFilterCount} matching ${filterDesc}):`
        );
      } else {
        console.log(
          `📱 ${platform.toUpperCase()} Devices (${devices.length} total):`
        );
      }

      if (devices.length === 0) {
        console.log("   No devices found matching criteria");
      } else {
        // Group by OS version for better readability
        const devicesByVersion = devices.reduce(
          (acc: Record<string, DeviceInfo[]>, device: DeviceInfo) => {
            if (!acc[device.version]) {
              acc[device.version] = [];
            }
            acc[device.version].push(device);
            return acc;
          },
          {}
        );

        Object.keys(devicesByVersion)
          .sort((a, b) => {
            // Parse version numbers for proper numeric sorting
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            return aNum - bNum;
          })
          .forEach((version) => {
            console.log(`\n  📱 ${version}:`);
            devicesByVersion[version].forEach((device: DeviceInfo) => {
              console.log(`     • ${device.name}`);
            });
          });
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Failed to fetch ${platform} devices:`, error);
    }
  }
}

/**
 * Update device cache for specified platforms with optional version filtering
 */
async function updateDevices(
  platforms: string[] = ["android", "ios"],
  minVersion?: string,
  maxVersion?: string
) {
  const cache = readDevicesCache();

  for (const platform of platforms) {
    if (platform !== "android" && platform !== "ios") {
      console.error(
        `Invalid platform: ${platform}. Must be 'android' or 'ios'.`
      );
      continue;
    }

    try {
      console.log(`🔄 Fetching available ${platform} devices...`);
      let devices = await fetchDevices(platform as "android" | "ios");

      // Apply default minimum version if no filter specified
      let effectiveMinVersion = minVersion;
      const effectiveMaxVersion = maxVersion;

      if (!minVersion && !maxVersion) {
        // Apply default minimum versions
        effectiveMinVersion = platform === "android"
          ? DEFAULT_MIN_ANDROID_VERSION
          : DEFAULT_MIN_IOS_VERSION;
      }

      // Filter by OS version
      const beforeFilterCount = devices.length;
      let hasFilter = false;

      if (effectiveMinVersion) {
        const min = parseFloat(effectiveMinVersion);
        devices = devices.filter(
          (device: DeviceInfo) => parseFloat(device.version) >= min
        );
        hasFilter = true;
      }

      if (effectiveMaxVersion) {
        const max = parseFloat(effectiveMaxVersion);
        devices = devices.filter(
          (device: DeviceInfo) => parseFloat(device.version) <= max
        );
        hasFilter = true;
      }

      // Apply smart selection to get balanced device distribution
      const beforeSmartSelection = devices.length;
      devices = smartSelectDevices(devices, DEFAULT_CACHE_SIZE, platform as "android" | "ios");

      // Display appropriate message
      if (hasFilter) {
        if (minVersion || maxVersion) {
          // User-specified filter
          const filterDesc = effectiveMinVersion && effectiveMaxVersion
            ? `${effectiveMinVersion} <= OS <= ${effectiveMaxVersion}`
            : effectiveMinVersion
            ? `OS >= ${effectiveMinVersion}`
            : `OS <= ${effectiveMaxVersion}`;
          console.log(
            `📦 Filtered ${beforeSmartSelection}/${beforeFilterCount} ${platform} devices (${filterDesc})`
          );
        } else {
          // Default filter
          console.log(
            `📦 Filtered ${beforeSmartSelection}/${beforeFilterCount} ${platform} devices (default filter: OS >= ${effectiveMinVersion})`
          );
        }
      }

      console.log(
        `🎯 Smart selection: ${devices.length} devices (balanced OS distribution, max 2 tablets)`
      );

      if (devices.length === 0) {
        console.log(
          `⚠️  No ${platform} devices found matching criteria - skipping cache update`
        );
        continue;
      }

      // Update device cache
      const deviceCacheKey = `${platform}Devices` as
        | "androidDevices"
        | "iosDevices";
      cache[deviceCacheKey] = {
        devices,
        timestamp: Date.now(),
      };

      console.log(`✅ ${platform}: Cached ${devices.length} devices`);

      // Show summary of cached devices by version
      const devicesByVersion = devices.reduce(
        (acc: Record<string, number>, device: DeviceInfo) => {
          acc[device.version] = (acc[device.version] || 0) + 1;
          return acc;
        },
        {}
      );

      Object.keys(devicesByVersion)
        .sort((a, b) => {
          const aNum = parseFloat(a);
          const bNum = parseFloat(b);
          return aNum - bNum;
        })
        .forEach((version) => {
          console.log(
            `     • ${version}: ${devicesByVersion[version]} devices`
          );
        });
    } catch (error) {
      console.error(`❌ Failed to update ${platform} devices:`, error);
    }
  }

  writeDevicesCache(cache);
  console.log(`📁 Device cache updated: ${CACHE_PATHS.DEVICES}`);
}

/**
 * Show live apps currently uploaded on BrowserStack
 */
async function showApps(platforms: string[]) {
  console.log("🔄 Fetching live apps from BrowserStack...");

  for (const platform of platforms) {
    if (
      platform !== "android-inhouse" &&
      platform !== "android-store" &&
      platform !== "ios-sandbox" &&
      platform !== "ios-store"
    ) {
      console.error(
        `Invalid platform: ${platform}. Must be 'android-inhouse', 'android-store', 'ios-sandbox', or 'ios-store'.`
      );
      continue;
    }

    try {
      if (platform === "ios-store") {
        console.log(`\n📱 iOS STORE Apps on BrowserStack `);
        const apps = await fetchAllApps("ios", "store");

        if (apps && apps.length > 0) {
          apps.forEach((app, index) => {
            const prefix = index === 0 ? "  🔥 Latest:" : `  ${index + 1}.`;
            console.log(prefix);
            displayAppDetails(app, "      ");
            console.log(""); // Empty line between entries
          });
          console.log(
            `  📊 Total: ${apps.length} store builds found (sorted by version)`
          );
        } else {
          console.log(`  ❌ No store apps found for iOS`);
        }
        continue;
      }

      if (platform === "android-store") {
        console.log(`\n📱 ANDROID STORE Apps on BrowserStack `);
        const apps = await fetchAllApps("android", "store");

        if (apps && apps.length > 0) {
          apps.forEach((app, index) => {
            const prefix = index === 0 ? "  🔥 Latest:" : `  ${index + 1}.`;
            console.log(prefix);
            displayAppDetails(app, "      ");
            console.log(""); // Empty line between entries
          });
          console.log(
            `  📊 Total: ${apps.length} store builds found (sorted by version)`
          );
        } else {
          console.log(`  ❌ No store apps found for Android`);
        }
        continue;
      }

      if (platform === "ios-sandbox") {
        console.log(`\n📱 iOS SANDBOX Apps on BrowserStack `);
        const apps = await fetchAllApps("ios", "sandbox");

        if (apps && apps.length > 0) {
          apps.forEach((app, index) => {
            const prefix = index === 0 ? "  🔥 Latest:" : `  ${index + 1}.`;
            console.log(prefix);
            displayAppDetails(app, "      ");
            console.log(""); // Empty line between entries
          });
          console.log(
            `  📊 Total: ${apps.length} sandbox builds found (sorted by version)`
          );
        } else {
          console.log(`  ❌ No sandbox apps found for iOS`);
        }
        continue;
      }

      if (platform === "android-inhouse") {
        console.log(`\n📱 ANDROID INHOUSE Apps on BrowserStack `);
        const apps = await fetchAllApps("android", "inhouse");

        if (apps && apps.length > 0) {
          apps.forEach((app, index) => {
            const prefix = index === 0 ? "  🔥 Latest:" : `  ${index + 1}.`;
            console.log(prefix);
            displayAppDetails(app, "      ");
            console.log(""); // Empty line between entries
          });
          console.log(
            `  📊 Total: ${apps.length} inhouse builds found (sorted by version)`
          );
        } else {
          console.log(`  ❌ No inhouse apps found for Android`);
        }
        continue;
      }
    } catch (error) {
      console.error(`❌ Failed to fetch ${platform} apps:`, error);
    }
  }
}

/**
 * Show cached app and device information
 */
function showCache() {
  const appsCache = readAppsCache();
  const devicesCache = readDevicesCache();

  if (
    Object.keys(appsCache).length === 0 &&
    Object.keys(devicesCache).length === 0
  ) {
    console.log("📭 No cache data found");
    return;
  }

  // Show apps
  const appPlatforms = [
    "androidInhouse",
    "androidStore",
    "iosSandbox",
    "iosStore",
  ].filter((p) => appsCache[p as keyof typeof appsCache]);
  if (appPlatforms.length > 0) {
    console.log("📱 Cached Apps:");
    for (const platform of appPlatforms) {
      const displayName =
        platform === "iosStore"
          ? "ios-store"
          : platform === "androidStore"
          ? "android-store"
          : platform === "iosSandbox"
          ? "ios-sandbox"
          : platform === "androidInhouse"
          ? "android-inhouse"
          : platform;

      const cachedEntry = appsCache[platform as keyof typeof appsCache];

      // Handle store apps (single CachedApp)
      if (platform === "androidStore" || platform === "iosStore") {
        const cachedApp = cachedEntry as CachedApp;
        if (cachedApp?.app) {
          const age = Math.round(
            (Date.now() - cachedApp.timestamp) / (1000 * 60 * 60)
          );
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
            const age = Math.round(
              (Date.now() - dualCache.daily.timestamp) / (1000 * 60 * 60)
            );
            console.log(`    📅 DAILY (cached ${age} hours ago):`);
            displayAppDetails(dualCache.daily.app, "       ");
          }

          if (dualCache.release?.app) {
            const age = Math.round(
              (Date.now() - dualCache.release.timestamp) / (1000 * 60 * 60)
            );
            console.log(`    🚀 RELEASE (cached ${age} hours ago):`);
            displayAppDetails(dualCache.release.app, "       ");
          }
        }
      }
    }
    console.log("");
  }

  // Show devices
  const devicePlatforms = ["androidDevices", "iosDevices"].filter(
    (p) => devicesCache[p as keyof typeof devicesCache]
  ) as ("androidDevices" | "iosDevices")[];
  if (devicePlatforms.length > 0) {
    console.log("📱 Cached Devices:");
    for (const deviceKey of devicePlatforms) {
      const cachedDevices = devicesCache[deviceKey];
      if (cachedDevices?.devices) {
        const platformName = deviceKey === "androidDevices" ? "android" : "ios";
        const age = Math.round(
          (Date.now() - cachedDevices.timestamp) / (1000 * 60 * 60)
        );

        console.log(
          `  ${platformName}: ${cachedDevices.devices.length} devices`
        );
        console.log(`    Cached: ${age} hours ago`);

        // Group devices by version for summary
        const devicesByVersion = cachedDevices.devices.reduce(
          (acc: Record<string, number>, device: DeviceInfo) => {
            acc[device.version] = (acc[device.version] || 0) + 1;
            return acc;
          },
          {}
        );

        Object.keys(devicesByVersion)
          .sort((a, b) => {
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            return aNum - bNum;
          })
          .forEach((version) => {
            console.log(
              `      • ${version}: ${devicesByVersion[version]} devices`
            );
          });
        console.log("");
      }
    }
  }
}

/**
 * Clear app cache
 */
function clearCache() {
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

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle version filtering (only "min X" and "max Y" syntax is supported)
  let minVersion: string | undefined;
  let maxVersion: string | undefined;

  // Parse arguments: min <version> max <version>
  for (let i = 1; i < args.length; i += 2) {
    const keyword = args[i];
    const value = args[i + 1];

    if (keyword === "min" && value) {
      minVersion = value;
    } else if (keyword === "max" && value) {
      maxVersion = value;
    } else if (keyword && keyword !== "min" && keyword !== "max") {
      // Reject invalid syntax
      console.error(`❌ Invalid filter syntax: "${keyword}"`);
      console.error(`   Only "min <version>" and "max <version>" are supported for filtering.`);
      console.error(`   Examples:`);
      console.error(`     npm run update-devices:android -- min 15`);
      console.error(`     npm run update-devices:android -- max 18`);
      console.error(`     npm run update-devices:android -- min 15 max 18`);
      console.error(`     npm run show-devices:ios -- min 17 max 26`);
      console.error(``);
      console.error(`   Without arguments, default filters are applied:`);
      console.error(`     Android: >= ${DEFAULT_MIN_ANDROID_VERSION}`);
      console.error(`     iOS: >= ${DEFAULT_MIN_IOS_VERSION}`);
      process.exit(1);
    }
  }

  switch (command) {
    case "show":
      showCache();
      break;

    case "show-apps:android":
      await showApps(["android-inhouse"]);
      break;

    case "show-apps:android-inhouse":
      await showApps(["android-inhouse"]);
      break;

    case "show-apps:android-store":
      await showApps(["android-store"]);
      break;

    case "show-apps:ios":
      await showApps(["ios-sandbox"]);
      break;

    case "show-apps:ios-sandbox":
      await showApps(["ios-sandbox"]);
      break;

    case "clear":
      clearCache();
      break;

    case "android-inhouse":
      await updateApps(["android-inhouse"]);
      break;

    case "ios-sandbox":
      await updateApps(["ios-sandbox"]);
      break;

    case "ios-store":
      await updateApps(["ios-store"]);
      break;

    case "android-store":
      await updateApps(["android-store"]);
      break;

    case "show-apps:ios-store":
      await showApps(["ios-store"]);
      break;

    case "show-apps:android-store":
      await showApps(["android-store"]);
      break;

    case "show-devices:android":
      await showDevices(["android"], minVersion, maxVersion);
      break;

    case "show-devices:ios":
      await showDevices(["ios"], minVersion, maxVersion);
      break;

    case "update-devices:android":
      await updateDevices(["android"], minVersion, maxVersion);
      break;

    case "update-devices:ios":
      await updateDevices(["ios"], minVersion, maxVersion);
      break;

    default:
      console.log("Usage:");
      console.log(
        "  npm run update-apps:android-inhouse                # Update Android inhouse apps only"
      );
      console.log(
        "  npm run update-apps:android-store                  # Update Android store apps only"
      );
      console.log(
        "  npm run update-apps:ios-sandbox                    # Update iOS sandbox apps only"
      );
      console.log(
        "  npm run update-apps:ios-store                      # Update iOS store apps only"
      );
      console.log(
        "  npm run show-cache                                 # Show cached apps and devices"
      );
      console.log(
        "  npm run show-apps:android-inhouse                  # Show live Android inhouse apps on BrowserStack"
      );
      console.log(
        "  npm run show-apps:android-store                    # Show live Android store apps on BrowserStack"
      );
      console.log(
        "  npm run show-apps:ios-sandbox                      # Show live iOS sandbox apps on BrowserStack"
      );
      console.log(
        "  npm run show-apps:ios-store                        # Show live iOS store apps on BrowserStack"
      );
      console.log(
        "  npm run show-devices:android                       # Show live Android devices"
      );
      console.log(
        "  npm run show-devices:ios                           # Show live iOS devices"
      );
      console.log(
        "  npm run update-devices:android                     # Cache Android devices only"
      );
      console.log(
        "  npm run update-devices:ios                         # Cache iOS devices only"
      );
      console.log(
        "  npm run clear-cache                                # Clear cache"
      );
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Update failed:", error);
    process.exit(1);
  });
}

export { updateApps, showDevices, updateDevices, showCache, clearCache };
