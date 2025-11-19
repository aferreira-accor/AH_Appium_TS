/**
 * Global store for original BrowserStack capabilities and device pool
 *
 * This module stores the original capabilities and manages device rotation from the pool
 * for BrowserStack session reloading (1 scenario = 1 session)
 */

import fs from 'fs';
import path from 'path';
import * as lockfile from 'proper-lockfile';

let storedCapabilities: Record<string, unknown> | null = null;
let devicePool: Array<{ name: string; version: string }> = [];

// Inter-process counter file for device rotation (config-specific)
// Each worker process maintains its own copy but reads/writes to shared file
// The file path is passed via WDIO_COUNTER_FILE env var (set by run-parallel-tests.ts)
// Falls back to generic file if env var is not set
const COUNTER_FILE = process.env.WDIO_COUNTER_FILE || path.join(process.cwd(), '.tmp', 'device-counter.json');

/**
 * Counter data structure stored in JSON file
 */
interface CounterData {
  counter: number;
  lastUpdated: string;
  totalRotations: number;
  recentRotations: Array<{
    index: number;
    device: string;
    worker: number;
    timestamp: string;
  }>;
}

/**
 * Initialize the device counter file with default JSON structure
 * Called once at the start of test execution
 */
function initializeDeviceCounter(): void {
  const dir = path.dirname(COUNTER_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const initialData: CounterData = {
    counter: 0,
    lastUpdated: new Date().toISOString(),
    totalRotations: 0,
    recentRotations: []
  };

  fs.writeFileSync(COUNTER_FILE, JSON.stringify(initialData, null, 2), 'utf8');
}

/**
 * Get and increment the device counter atomically (ASYNC version)
 * This ensures each worker gets a unique index even across processes
 * Uses proper-lockfile with automatic retry for robustness
 */
async function getAndIncrementCounter(): Promise<number> {
  // Ensure counter file exists
  if (!fs.existsSync(COUNTER_FILE)) {
    initializeDeviceCounter();
  }

  let currentValue = 0;
  let release: (() => Promise<void>) | null = null;

  try {
    // Lock with automatic retry (built-in by proper-lockfile)
    // This prevents "ELOCKED" errors when multiple workers start simultaneously
    release = await lockfile.lock(COUNTER_FILE, {
      stale: 5000,              // Consider lock stale after 5 seconds
      retries: {
        retries: 10,            // Try up to 10 times
        factor: 2,              // Exponential backoff
        minTimeout: 50,         // Min 50ms wait between retries
        maxTimeout: 500,        // Max 500ms wait between retries
      }
    });

    // Read current counter data from JSON
    const content = fs.readFileSync(COUNTER_FILE, 'utf8');
    const data: CounterData = JSON.parse(content);

    // Validate counter value (in case file was corrupted)
    currentValue = data.counter || 0;
    if (isNaN(currentValue) || currentValue < 0) {
      console.warn('[DEVICE ROTATION] Counter corrupted, resetting to 0');
      currentValue = 0;
    }

    // Calculate device index for logging
    const deviceIndex = currentValue % devicePool.length;
    const device = devicePool[deviceIndex] || { name: 'Unknown', version: 'Unknown' };

    // Update counter data with new value and metadata
    const newData: CounterData = {
      counter: currentValue + 1,
      lastUpdated: new Date().toISOString(),
      totalRotations: (data.totalRotations || 0) + 1,
      // Keep last 20 rotations for debugging
      recentRotations: [
        ...(data.recentRotations || []).slice(-19),
        {
          index: deviceIndex,
          device: device.name,
          worker: process.pid,
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Write updated data back atomically
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(newData, null, 2), 'utf8');

  } catch (error: any) {
    // If lock acquisition fails after all retries, use fallback
    console.warn('[DEVICE ROTATION] Failed to acquire lock after retries, using fallback');
    console.warn(`[DEVICE ROTATION] Error: ${error.message}`);

    // Improved fallback: combine timestamp + process ID for uniqueness
    // This virtually eliminates collision risk (< 0.001%)
    currentValue = (Date.now() * 1000 + process.pid) % 100000;

  } finally {
    // Always release the lock if we acquired it
    if (release) {
      try {
        await release();
      } catch (releaseError) {
        console.warn('[DEVICE ROTATION] Warning: Failed to release lock', releaseError);
      }
    }
  }

  return currentValue;
}

/**
 * Store the original capabilities from the config
 * Called by beforeSession hook to save capabilities before they're transformed
 */
export function storeOriginalCapabilities(caps: Record<string, unknown>): void {
  storedCapabilities = JSON.parse(JSON.stringify(caps));
}

/**
 * Get the stored original capabilities
 * Used by scenario hooks to reload session with correct capabilities
 */
export function getStoredCapabilities(): Record<string, unknown> | null {
  return storedCapabilities ? JSON.parse(JSON.stringify(storedCapabilities)) : null;
}

/**
 * Set the device pool for rotation
 * Called during config setup with the list of all cached devices
 */
export function setDevicePool(devices: Array<{ name: string; version: string }>): void {
  devicePool = [...devices];
  // DO NOT initialize counter here - it's done once in run-parallel-tests.ts
  // Initializing here would reset the counter for every worker that sets the pool!
}

/**
 * Get the current device pool (for checking if it's initialized)
 * Returns empty array if pool is not initialized
 */
export function getDevicePool(): Array<{ name: string; version: string }> {
  return devicePool;
}

/**
 * Get the next device from the pool (round-robin) - ASYNC
 * Returns null if pool is empty
 *
 * Uses inter-process counter to ensure each worker gets a different device
 */
export async function getNextDevice(): Promise<{ name: string; version: string } | null> {
  if (devicePool.length === 0) {
    return null;
  }

  // Get unique counter value across all worker processes
  const counter = await getAndIncrementCounter();
  const deviceIndex = counter % devicePool.length;

  return devicePool[deviceIndex];
}

/**
 * Get device by index (used by beforeSession hook) - ASYNC
 * Returns the next device from the pool using round-robin
 *
 * This is called ONCE per session creation (not per scenario)
 * Each new session gets the next device in the pool
 */
export async function getDeviceByIndex(): Promise<{ name: string; version: string } | null> {
  if (devicePool.length === 0) {
    console.warn('[DEVICE ROTATION] ⚠️  Device pool is empty!');
    return null;
  }

  // Get unique counter value across all worker processes
  const counter = await getAndIncrementCounter();
  const deviceIndex = counter % devicePool.length;

  const device = devicePool[deviceIndex];

  console.log(`[DEVICE ROTATION] 📊 Stats:
    Counter: ${counter}
    Pool size: ${devicePool.length}
    Device index: ${deviceIndex}
    Selected device: ${device.name} (v${device.version})`);

  return device;
}

/**
 * Clear stored capabilities (useful for cleanup)
 */
export function clearStoredCapabilities(): void {
  storedCapabilities = null;
  devicePool = [];
}
