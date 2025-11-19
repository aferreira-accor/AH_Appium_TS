import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import type { BrowserStackApp } from './browserstack-apps-api';
import type { DeviceInfo } from './browserstack-devices-api';

// Constants
const CACHE_DIR = path.join(process.cwd(), '.cache');
const APPS_CACHE_FILE = path.join(CACHE_DIR, 'apps.json');
const DEVICES_CACHE_FILE = path.join(CACHE_DIR, 'devices.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Types
export interface CachedApp {
  app: BrowserStackApp;
  timestamp: number;
}

export interface CachedDevices {
  devices: DeviceInfo[];
  timestamp: number;
}

export interface DualBuildCache {
  daily?: CachedApp;
  release?: CachedApp;
}

export interface AppCache {
  androidInhouse?: DualBuildCache;
  androidStore?: CachedApp;
  iosSandbox?: DualBuildCache;
  iosStore?: CachedApp;
}

export interface DeviceCache {
  androidDevices?: CachedDevices;
  iosDevices?: CachedDevices;
}

/**
 * Read apps cache from file
 */
export function readAppsCache(): AppCache {
  try {
    if (!existsSync(APPS_CACHE_FILE)) {
      return {};
    }
    const data = readFileSync(APPS_CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to read apps cache:', error);
    return {};
  }
}

/**
 * Write apps cache to file
 */
export function writeAppsCache(cache: AppCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(APPS_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn('Failed to write apps cache:', error);
  }
}

/**
 * Read devices cache from file
 */
export function readDevicesCache(): DeviceCache {
  try {
    if (!existsSync(DEVICES_CACHE_FILE)) {
      return {};
    }
    const data = readFileSync(DEVICES_CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to read devices cache:', error);
    return {};
  }
}

/**
 * Write devices cache to file
 */
export function writeDevicesCache(cache: DeviceCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(DEVICES_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn('Failed to write devices cache:', error);
  }
}

/**
 * Check if cached app is still valid
 */
export function isCacheValid(cachedApp: CachedApp): boolean {
  return Date.now() - cachedApp.timestamp < CACHE_DURATION;
}

/**
 * Cache file paths (for external access)
 */
export const CACHE_PATHS = {
  APPS: APPS_CACHE_FILE,
  DEVICES: DEVICES_CACHE_FILE,
  DIR: CACHE_DIR
} as const;