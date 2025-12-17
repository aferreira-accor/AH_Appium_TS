/**
 * App cache management for BrowserStack
 * Handles fetching and caching of app builds (DAILY/RELEASE)
 */

import {
  fetchLatestApp,
  fetchAllApps,
  type BrowserStackApp,
} from "../../config/capabilities/api/browserstack-apps-api";
import {
  readAppsCache,
  writeAppsCache,
  CACHE_PATHS,
} from "../../config/capabilities/api/cache";

export type AppPlatform = "android-inhouse" | "android-store" | "ios-sandbox" | "ios-store";

/**
 * Helper function to display all BrowserStackApp fields consistently
 */
export function displayAppDetails(app: BrowserStackApp, prefix: string = "     "): void {
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
 * Update iOS Store app cache
 */
async function updateIosStore(cache: ReturnType<typeof readAppsCache>): Promise<void> {
  console.log(`🔄 Fetching latest iOS store app...`);
  const app = await fetchLatestApp("ios", "store");

  cache.iosStore = {
    app,
    timestamp: Date.now(),
  };

  console.log(`✅ ios-store: ${app.app_url} (v${app.app_version})`);
}

/**
 * Update Android Store app cache
 */
async function updateAndroidStore(cache: ReturnType<typeof readAppsCache>): Promise<void> {
  console.log(`🔄 Fetching Android store apps (will select Google prod pipeline)...`);
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

  console.log(`✅ android-store: ${preferred.app_url} (v${preferred.app_version})`);
}

/**
 * Update iOS Sandbox app cache (DAILY + RELEASE builds)
 */
async function updateIosSandbox(cache: ReturnType<typeof readAppsCache>): Promise<void> {
  console.log(`🔄 Fetching iOS sandbox apps (DAILY + RELEASE)...`);

  // Save current env var
  const originalBuildType = process.env.IOS_SANDBOX_BS_BUILD_TYPE;

  let dailyApp: BrowserStackApp | null = null;
  let releaseApp: BrowserStackApp | null = null;

  // Fetch DAILY build
  try {
    process.env.IOS_SANDBOX_BS_BUILD_TYPE = "DAILY";
    dailyApp = await fetchLatestApp("ios", "sandbox");
    console.log(`   ✅ DAILY: ${dailyApp.app_url} (v${dailyApp.app_version})`);
  } catch {
    console.log(`   ⚠️  DAILY: Not found in recent 100 apps (too old or not uploaded yet)`);
  }

  // Fetch RELEASE build
  try {
    process.env.IOS_SANDBOX_BS_BUILD_TYPE = "RELEASE";
    releaseApp = await fetchLatestApp("ios", "sandbox");
    console.log(`   ✅ RELEASE: ${releaseApp.app_url} (v${releaseApp.app_version})`);
  } catch {
    console.log(`   ⚠️  RELEASE: Not found in recent 100 apps (too old or not uploaded yet)`);
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
    daily: dailyApp ? { app: dailyApp, timestamp: Date.now() } : undefined,
    release: releaseApp ? { app: releaseApp, timestamp: Date.now() } : undefined,
  };

  if (dailyApp && releaseApp) {
    console.log(`✅ ios-sandbox: Cached both DAILY and RELEASE builds`);
  } else if (dailyApp) {
    console.log(`✅ ios-sandbox: Cached DAILY build only`);
  } else {
    console.log(`✅ ios-sandbox: Cached RELEASE build only`);
  }
}

/**
 * Update Android Inhouse app cache (DAILY + RELEASE builds)
 */
async function updateAndroidInhouse(cache: ReturnType<typeof readAppsCache>): Promise<void> {
  console.log(`🔄 Fetching Android inhouse apps (DAILY + RELEASE)...`);

  // Save current env var
  const originalBuildType = process.env.ANDROID_INHOUSE_BS_BUILD_TYPE;

  let dailyApp: BrowserStackApp | null = null;
  let releaseApp: BrowserStackApp | null = null;

  // Fetch DAILY build
  try {
    process.env.ANDROID_INHOUSE_BS_BUILD_TYPE = "DAILY";
    dailyApp = await fetchLatestApp("android", "inhouse");
    console.log(`   ✅ DAILY: ${dailyApp.app_url} (v${dailyApp.app_version})`);
  } catch {
    console.log(`   ⚠️  DAILY: Not found in recent 100 apps (too old or not uploaded yet)`);
  }

  // Fetch RELEASE build
  try {
    process.env.ANDROID_INHOUSE_BS_BUILD_TYPE = "RELEASE";
    releaseApp = await fetchLatestApp("android", "inhouse");
    console.log(`   ✅ RELEASE: ${releaseApp.app_url} (v${releaseApp.app_version})`);
  } catch {
    console.log(`   ⚠️  RELEASE: Not found in recent 100 apps (too old or not uploaded yet)`);
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
    daily: dailyApp ? { app: dailyApp, timestamp: Date.now() } : undefined,
    release: releaseApp ? { app: releaseApp, timestamp: Date.now() } : undefined,
  };

  if (dailyApp && releaseApp) {
    console.log(`✅ android-inhouse: Cached both DAILY and RELEASE builds`);
  } else if (dailyApp) {
    console.log(`✅ android-inhouse: Cached DAILY build only`);
  } else {
    console.log(`✅ android-inhouse: Cached RELEASE build only`);
  }
}

/**
 * Validate platform string
 */
function isValidPlatform(platform: string): platform is AppPlatform {
  return ["android-inhouse", "android-store", "ios-sandbox", "ios-store"].includes(platform);
}

/**
 * Update apps cache for specified platforms
 */
export async function updateApps(
  platforms: string[] = ["android-inhouse", "ios-sandbox"]
): Promise<void> {
  const cache = readAppsCache();

  for (const platform of platforms) {
    if (!isValidPlatform(platform)) {
      console.error(
        `Invalid platform: ${platform}. Must be 'android-inhouse', 'android-store', 'ios-sandbox', or 'ios-store'.`
      );
      continue;
    }

    try {
      switch (platform) {
        case "ios-store":
          await updateIosStore(cache);
          break;
        case "android-store":
          await updateAndroidStore(cache);
          break;
        case "ios-sandbox":
          await updateIosSandbox(cache);
          break;
        case "android-inhouse":
          await updateAndroidInhouse(cache);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to update ${platform}:`, error);
    }
  }

  writeAppsCache(cache);
  console.log(`📁 Apps cache updated: ${CACHE_PATHS.APPS}`);
}
