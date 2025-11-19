import { readDevicesCache } from '../api/cache';
import type { DeviceInfo } from '../api/browserstack-devices-api';

export interface DeviceCacheResolutionOptions {
  platform: 'android' | 'ios';
}

export interface DeviceCacheResolutionResult {
  devices: DeviceInfo[];
  count: number;
}

/**
 * Resolve devices from cache for the specified platform
 */
export function resolveDevicesFromCache(options: DeviceCacheResolutionOptions): DeviceCacheResolutionResult {
  const { platform } = options;
  
  try {
    const devicesCache = readDevicesCache();
    const cacheKey = platform === 'android' ? 'androidDevices' : 'iosDevices';
    const cachedDevices = devicesCache[cacheKey];
    
    if (cachedDevices && cachedDevices.devices && cachedDevices.devices.length > 0) {
      const devices = cachedDevices.devices;
      
      return {
        devices,
        count: devices.length
      };
    } else {
      throw new Error(`No cached ${platform} devices found. Please run npm run update-devices:${platform} first.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to resolve ${platform} devices from cache: ${String(error)}`);
  }
}

/**
 * Check if device cache exists for the specified platform
 */
export function hasDeviceCache(platform: 'android' | 'ios'): boolean {
  try {
    const devicesCache = readDevicesCache();
    const cacheKey = platform === 'android' ? 'androidDevices' : 'iosDevices';
    const cachedDevices = devicesCache[cacheKey];
    
    return !!(cachedDevices && cachedDevices.devices && cachedDevices.devices.length > 0);
  } catch {
    return false;
  }
}