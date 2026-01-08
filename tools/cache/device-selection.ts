/**
 * Smart device selection algorithm for BrowserStack cache
 * Ensures balanced distribution of tablets, OS versions, and brands
 */

import type { DeviceInfo } from "../../config/capabilities/api/browserstack-devices-api";

// Default minimum OS versions for device caching
export const DEFAULT_MIN_ANDROID_VERSION = "14.0"; // Android 14+ (Google Play support)
export const DEFAULT_MIN_IOS_VERSION = "18"; // iOS 18+ (App minimum requirement)

// Default cache size (matches typical thread count)
export const DEFAULT_CACHE_SIZE = 10;

// Maximum tablets per platform
export const MAX_TABLETS_ANDROID = 2;
export const MAX_TABLETS_IOS = 2;

/**
 * Detect if a device is a tablet based on its name
 */
function isTablet(name: string, platform: "android" | "ios"): boolean {
  if (platform === "android") {
    return /\bTab\b/i.test(name);
  }
  return /\biPad\b/i.test(name);
}

/**
 * Extract brand from device name for diversity selection
 */
function getBrand(name: string, platform: "android" | "ios"): string {
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
  }
  // iOS: all Apple
  return "Apple";
}

/**
 * Select tablets with diverse OS versions
 */
function selectTablets(
  tablets: DeviceInfo[],
  maxCount: number
): DeviceInfo[] {
  if (tablets.length === 0) return [];

  const tabletsToSelect = Math.min(maxCount, tablets.length);
  const selected: DeviceInfo[] = [];

  // Group tablets by OS version
  const tabletsByVersion = tablets.reduce((acc, tablet) => {
    const version = tablet.version;
    if (!acc[version]) acc[version] = [];
    acc[version].push(tablet);
    return acc;
  }, {} as Record<string, DeviceInfo[]>);

  const tabletVersions = Object.keys(tabletsByVersion).sort(
    (a, b) => parseFloat(b) - parseFloat(a)
  );

  // Select tablets from different OS versions (one per version if possible)
  for (const version of tabletVersions) {
    if (selected.length >= tabletsToSelect) break;
    selected.push(tabletsByVersion[version][0]);
  }

  return selected;
}

/**
 * Select phones with balanced OS and brand distribution
 */
function selectPhones(
  phones: DeviceInfo[],
  targetCount: number,
  platform: "android" | "ios"
): DeviceInfo[] {
  if (phones.length === 0 || targetCount <= 0) return [];

  const selected: DeviceInfo[] = [];
  const brandCounts: Record<string, number> = {};

  // Group phones by OS version
  const phonesByVersion = phones.reduce((acc, device) => {
    const version = device.version;
    if (!acc[version]) acc[version] = [];
    acc[version].push(device);
    return acc;
  }, {} as Record<string, DeviceInfo[]>);

  const versions = Object.keys(phonesByVersion).sort(
    (a, b) => parseFloat(b) - parseFloat(a)
  );

  // Calculate phones per version for balanced distribution
  const phonesPerVersion = Math.ceil(targetCount / versions.length);

  // Select phones from each version
  for (const version of versions) {
    if (selected.length >= targetCount) break;

    const versionPhones = phonesByVersion[version];
    const maxForThisVersion = Math.min(
      phonesPerVersion,
      targetCount - selected.length
    );

    // Sort phones by brand diversity (prefer brands we haven't used much)
    versionPhones.sort((a, b) => {
      const brandA = getBrand(a.name, platform);
      const brandB = getBrand(b.name, platform);
      const countA = brandCounts[brandA] || 0;
      const countB = brandCounts[brandB] || 0;
      return countA - countB;
    });

    // Add phones from this version
    let versionCount = 0;
    for (const device of versionPhones) {
      if (versionCount >= maxForThisVersion || selected.length >= targetCount)
        break;

      const brand = getBrand(device.name, platform);
      selected.push(device);
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      versionCount++;
    }
  }

  // If we still need more devices, fill from remaining phones
  if (selected.length < targetCount) {
    const remaining = phones.filter((d) => !selected.includes(d));
    const needed = targetCount - selected.length;
    selected.push(...remaining.slice(0, needed));
  }

  return selected;
}

/**
 * Smart device selection that ensures balanced distribution
 * - Guarantees exactly 2 tablets per platform
 * - Balanced OS version distribution
 * - Brand diversity for remaining phones
 */
export function smartSelectDevices(
  devices: DeviceInfo[],
  targetCount: number,
  platform: "android" | "ios"
): DeviceInfo[] {
  if (devices.length <= targetCount) {
    return devices;
  }

  // Separate phones and tablets
  const allPhones = devices.filter((d) => !isTablet(d.name, platform));
  const allTablets = devices.filter((d) => isTablet(d.name, platform));

  const maxTablets = platform === "android" ? MAX_TABLETS_ANDROID : MAX_TABLETS_IOS;

  // Step 1: Select tablets
  const selectedTablets = selectTablets(allTablets, maxTablets);

  // Step 2: Select phones to fill remaining slots
  const remainingSlots = targetCount - selectedTablets.length;
  const selectedPhones = selectPhones(allPhones, remainingSlots, platform);

  // Combine and return
  return [...selectedTablets, ...selectedPhones].slice(0, targetCount);
}
