/**
 * Cache module - exports all cache management functions
 */

// Device selection
export {
  smartSelectDevices,
  DEFAULT_MIN_ANDROID_VERSION,
  DEFAULT_MIN_IOS_VERSION,
  DEFAULT_CACHE_SIZE,
  MAX_TABLETS_ANDROID,
  MAX_TABLETS_IOS,
} from "./device-selection";

// App cache
export { updateApps, displayAppDetails, type AppPlatform } from "./app-cache";

// Device cache
export { showDevices, updateDevices, type DevicePlatform } from "./device-cache";

// Cache display
export { showApps, showCache, clearCache } from "./cache-display";
