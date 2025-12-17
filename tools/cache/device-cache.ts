/**
 * Device cache management for BrowserStack
 * Handles fetching, filtering, and caching of device lists
 */

import {
  fetchDevices,
  type DeviceInfo,
} from "../../config/capabilities/api/browserstack-devices-api";
import {
  readDevicesCache,
  writeDevicesCache,
  CACHE_PATHS,
} from "../../config/capabilities/api/cache";
import {
  smartSelectDevices,
  DEFAULT_MIN_ANDROID_VERSION,
  DEFAULT_MIN_IOS_VERSION,
  DEFAULT_CACHE_SIZE,
} from "./device-selection";

export type DevicePlatform = "android" | "ios";

/**
 * Validate platform string
 */
function isValidPlatform(platform: string): platform is DevicePlatform {
  return platform === "android" || platform === "ios";
}

/**
 * Filter devices by OS version range
 */
function filterDevicesByVersion(
  devices: DeviceInfo[],
  minVersion?: string,
  maxVersion?: string
): DeviceInfo[] {
  let filtered = devices;

  if (minVersion) {
    const min = parseFloat(minVersion);
    filtered = filtered.filter((device) => parseFloat(device.version) >= min);
  }

  if (maxVersion) {
    const max = parseFloat(maxVersion);
    filtered = filtered.filter((device) => parseFloat(device.version) <= max);
  }

  return filtered;
}

/**
 * Group devices by OS version for display
 */
function groupDevicesByVersion(devices: DeviceInfo[]): Record<string, DeviceInfo[]> {
  return devices.reduce((acc, device) => {
    if (!acc[device.version]) {
      acc[device.version] = [];
    }
    acc[device.version].push(device);
    return acc;
  }, {} as Record<string, DeviceInfo[]>);
}

/**
 * Get sorted version keys (ascending by version number)
 */
function getSortedVersions(versions: string[]): string[] {
  return versions.sort((a, b) => parseFloat(a) - parseFloat(b));
}

/**
 * Build filter description string
 */
function buildFilterDescription(minVersion?: string, maxVersion?: string): string {
  if (minVersion && maxVersion) {
    return `${minVersion} <= OS <= ${maxVersion}`;
  }
  if (minVersion) {
    return `OS >= ${minVersion}`;
  }
  if (maxVersion) {
    return `OS <= ${maxVersion}`;
  }
  return "";
}

/**
 * Show available devices for specified platforms
 */
export async function showDevices(
  platforms: string[],
  minVersion?: string,
  maxVersion?: string
): Promise<void> {
  for (const platform of platforms) {
    if (!isValidPlatform(platform)) {
      console.error(`Invalid platform: ${platform}. Must be 'android' or 'ios'.`);
      continue;
    }

    try {
      console.log(`🔄 Fetching available ${platform} devices...`);
      let devices = await fetchDevices(platform);
      const beforeFilterCount = devices.length;

      // Filter by OS version if specified
      if (minVersion || maxVersion) {
        devices = filterDevicesByVersion(devices, minVersion, maxVersion);
        const filterDesc = buildFilterDescription(minVersion, maxVersion);
        console.log(
          `📱 ${platform.toUpperCase()} Devices (${devices.length}/${beforeFilterCount} matching ${filterDesc}):`
        );
      } else {
        console.log(`📱 ${platform.toUpperCase()} Devices (${devices.length} total):`);
      }

      if (devices.length === 0) {
        console.log("   No devices found matching criteria");
      } else {
        // Group by OS version for better readability
        const devicesByVersion = groupDevicesByVersion(devices);
        const sortedVersions = getSortedVersions(Object.keys(devicesByVersion));

        for (const version of sortedVersions) {
          console.log(`\n  📱 ${version}:`);
          for (const device of devicesByVersion[version]) {
            console.log(`     • ${device.name}`);
          }
        }
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
export async function updateDevices(
  platforms: string[] = ["android", "ios"],
  minVersion?: string,
  maxVersion?: string
): Promise<void> {
  const cache = readDevicesCache();

  for (const platform of platforms) {
    if (!isValidPlatform(platform)) {
      console.error(`Invalid platform: ${platform}. Must be 'android' or 'ios'.`);
      continue;
    }

    try {
      console.log(`🔄 Fetching available ${platform} devices...`);
      let devices = await fetchDevices(platform);
      const beforeFilterCount = devices.length;

      // Apply default minimum version if no filter specified
      let effectiveMinVersion = minVersion;
      const effectiveMaxVersion = maxVersion;

      if (!minVersion && !maxVersion) {
        effectiveMinVersion =
          platform === "android" ? DEFAULT_MIN_ANDROID_VERSION : DEFAULT_MIN_IOS_VERSION;
      }

      // Filter by OS version
      let hasFilter = false;

      if (effectiveMinVersion || effectiveMaxVersion) {
        devices = filterDevicesByVersion(devices, effectiveMinVersion, effectiveMaxVersion);
        hasFilter = true;
      }

      const afterFilterCount = devices.length;

      // Apply smart selection to get balanced device distribution
      devices = smartSelectDevices(devices, DEFAULT_CACHE_SIZE, platform);

      // Display appropriate message
      if (hasFilter) {
        if (minVersion || maxVersion) {
          // User-specified filter
          const filterDesc = buildFilterDescription(effectiveMinVersion, effectiveMaxVersion);
          console.log(`📦 Filtered ${afterFilterCount}/${beforeFilterCount} ${platform} devices (${filterDesc})`);
        } else {
          // Default filter
          console.log(
            `📦 Filtered ${afterFilterCount}/${beforeFilterCount} ${platform} devices (default filter: OS >= ${effectiveMinVersion})`
          );
        }
      }

      console.log(`🎯 Smart selection: ${devices.length} devices (balanced OS distribution, max 2 tablets)`);

      if (devices.length === 0) {
        console.log(`⚠️  No ${platform} devices found matching criteria - skipping cache update`);
        continue;
      }

      // Update device cache
      const deviceCacheKey = `${platform}Devices` as "androidDevices" | "iosDevices";
      cache[deviceCacheKey] = {
        devices,
        timestamp: Date.now(),
      };

      console.log(`✅ ${platform}: Cached ${devices.length} devices`);

      // Show summary of cached devices by version
      const devicesByVersion = devices.reduce((acc, device) => {
        acc[device.version] = (acc[device.version] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sortedVersions = getSortedVersions(Object.keys(devicesByVersion));
      for (const version of sortedVersions) {
        console.log(`     • ${version}: ${devicesByVersion[version]} devices`);
      }
    } catch (error) {
      console.error(`❌ Failed to update ${platform} devices:`, error);
    }
  }

  writeDevicesCache(cache);
  console.log(`📁 Device cache updated: ${CACHE_PATHS.DEVICES}`);
}
