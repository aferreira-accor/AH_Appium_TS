import type { BrowserStackApp } from "../api/browserstack-apps-api";
import {
  readAppsCache,
  isCacheValid,
  type CachedApp,
  type DualBuildCache,
} from "../api/cache";

export interface AppResolutionOptions {
  platform: "android" | "ios";
  buildType?: "inhouse" | "sandbox" | "store";
  forceCache?: boolean;
}

export interface AppResolutionResult {
  app: BrowserStackApp;
  source: "environment" | "cache";
}

/**
 * Resolve app information from environment variables or cache
 */
export function resolveAppInfo(
  options: AppResolutionOptions
): AppResolutionResult {
  const { platform, buildType, forceCache = false } = options;

  // If not forcing cache, check environment variable first
  if (!forceCache) {
    const envAppUrl = getAppUrlFromEnvironment(platform, buildType);
    if (envAppUrl) {
      return {
        app: {
          app_name: "",
          app_version: "",
          app_url: envAppUrl,
          app_id: "",
          uploaded_at: "",
          custom_id: "",
          shareable_id: "",
        },
        source: "environment",
      };
    }
  }

  // Fallback to cache
  const cachedApp = getAppFromCache(platform, buildType);
  if (cachedApp) {
    return {
      app: cachedApp,
      source: "cache",
    };
  }

  // No app found
  const buildTypeStr = buildType ? `-${buildType}` : "-inhouse";
  const commandSuffix =
    platform === "android"
      ? buildType === "store"
        ? "android-store"
        : "android-inhouse"
      : buildType === "store"
      ? "ios-store"
      : "ios-sandbox";

  throw new Error(
    `No valid ${platform}${buildTypeStr} app found. Please set ${getEnvironmentVariableName(
      platform,
      buildType
    )} or run npm run update-apps:${commandSuffix} first.`
  );
}

/**
 * Get app URL from environment variables
 */
function getAppUrlFromEnvironment(
  platform: "android" | "ios",
  buildType?: "inhouse" | "sandbox" | "store"
): string | null {
  const envVar = getEnvironmentVariableName(platform, buildType);
  const appUrl = process.env[envVar];

  if (appUrl && appUrl !== "your_app_url_here" && appUrl.startsWith("bs://")) {
    return appUrl;
  }

  return null;
}

/**
 * Get app from cache
 */
function getAppFromCache(
  platform: "android" | "ios",
  buildType?: "inhouse" | "sandbox" | "store"
): BrowserStackApp | null {
  try {
    const appsCache = readAppsCache();

    // Determine cache key based on platform and buildType
    let cacheKey: keyof typeof appsCache;
    if (platform === "android") {
      cacheKey = buildType === "store" ? "androidStore" : "androidInhouse";
    } else {
      cacheKey = buildType === "store" ? "iosStore" : "iosSandbox";
    }

    const cachedEntry = appsCache[cacheKey];

    if (!cachedEntry) {
      return null;
    }

    // Handle store apps (single CachedApp)
    if (cacheKey === "androidStore" || cacheKey === "iosStore") {
      const cachedApp = cachedEntry as CachedApp;
      if (cachedApp.app && isCacheValid(cachedApp)) {
        return cachedApp.app;
      }
    }
    // Handle inhouse/sandbox apps (DualBuildCache with daily and release)
    else {
      const dualCache = cachedEntry as DualBuildCache;

      // Get build type from environment variable
      const buildTypeEnv =
        platform === "android"
          ? process.env.ANDROID_INHOUSE_BS_BUILD_TYPE!.toLowerCase()
          : process.env.IOS_SANDBOX_BS_BUILD_TYPE!.toLowerCase();

      const selectedBuild =
        buildTypeEnv === "release" ? dualCache.release : dualCache.daily;

      if (selectedBuild && isCacheValid(selectedBuild)) {
        return selectedBuild.app;
      }
    }
  } catch {
    // Silently handle cache read errors
  }

  return null;
}

/**
 * Get the environment variable name for app URL
 */
function getEnvironmentVariableName(
  platform: "android" | "ios",
  buildType?: "inhouse" | "sandbox" | "store"
): string {
  if (!buildType) {
    // Fallback to legacy names for backward compatibility
    return `${platform.toUpperCase()}_BS_APP_URL`;
  }

  const buildTypeName =
    platform === "android"
      ? buildType === "store"
        ? "STORE"
        : "INHOUSE"
      : buildType === "store"
      ? "STORE"
      : "SANDBOX";

  return `${platform.toUpperCase()}_${buildTypeName}_BS_APP_URL`;
}

/**
 * Validate app URL format
 */
export function isValidAppUrl(appUrl: string): boolean {
  return appUrl.startsWith("bs://") && appUrl.length > 5;
}
