import "dotenv/config";
import axios from "axios";

// Constants
const API_TIMEOUT = 10000;
const APP_LIMIT = 100;

/**
 * Build patterns for filtering apps by custom_id
 * These patterns are used to identify different types of builds uploaded to BrowserStack
 */
const BUILD_PATTERNS = {
  android: {
    inhouse: {
      daily: /^stable-build_googleInHouseRelease_/,
      release: /^PipelineGoogleInHouseRelease_googleInHouseRelease_/,
    },
    store: {
      valid: /^PipelineGoogleProdRelease_googleProdRelease/,
      exclude: [
        /^wildcardbot_prod_googleProdRelease/,
        /^PipelineHuaweiProdRelease_HuaweiProdRelease/,
      ],
    },
  },
  ios: {
    sandbox: {
      daily: /^stable_AccorHotelsApp-SandboxDevelopmentRelease-/,
      release: /^Pipeline_AccorHotelsApp-SandboxDevelopmentRelease-/,
    },
    store: /^Pipeline_AccorHotelsApp-Store-/,
  },
} as const;

// Types
export interface BrowserStackApp {
  app_name: string;
  app_version: string;
  app_url: string;
  app_id: string;
  uploaded_at: string;
  custom_id?: string;
  shareable_id?: string;
}

/**
 * Create authenticated BrowserStack API client
 */
function createBrowserStackClient() {
  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;

  if (!username || !accessKey) {
    throw new Error(
      `BrowserStack credentials not found in environment variables. Username: ${!!username}, AccessKey: ${!!accessKey}`
    );
  }

  return axios.create({
    baseURL: "https://api-cloud.browserstack.com",
    auth: {
      username,
      password: accessKey,
    },
    timeout: API_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "AH_Appium_TS/1.0.0",
    },
  });
}

/**
 * Fetch apps from BrowserStack API with error handling
 */
async function fetchAppsFromAPI(limit: number): Promise<BrowserStackApp[]> {
  const client = createBrowserStackClient();

  try {
    console.log(`Making API request to BrowserStack for apps...`);
    const { data: apps } = await client.get<BrowserStackApp[]>(
      "/app-automate/recent_group_apps",
      {
        params: { limit: Math.min(limit, APP_LIMIT) },
      }
    );

    if (!apps || apps.length === 0) {
      throw new Error("No apps found on BrowserStack");
    }

    console.log(`Found ${apps.length} total apps from BrowserStack`);
    return apps;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const statusText = error.response?.statusText || "Unknown";
      const message = error.response?.data?.message || error.message;

      console.error(
        `BrowserStack API error: ${status} ${statusText} - ${message}`
      );

      if (status === 401) {
        throw new Error(
          "BrowserStack authentication failed. Please check your BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY."
        );
      } else if (status === 429) {
        throw new Error(
          "BrowserStack API rate limit exceeded. Please try again later."
        );
      } else if (status >= 500) {
        throw new Error(
          "BrowserStack API server error. Please try again later."
        );
      } else {
        throw new Error(`BrowserStack API error: ${status} - ${message}`);
      }
    }

    console.error(`Failed to fetch apps from BrowserStack:`, error);
    throw error;
  }
}

/**
 * Filter apps by platform (Android/iOS) and build type
 */
function filterAppsByPlatform(
  apps: BrowserStackApp[],
  platform: "android" | "ios",
  buildType?: "inhouse" | "sandbox" | "store"
): BrowserStackApp[] {
  function getCustomId(app: BrowserStackApp): string {
    return (app.custom_id || "").toString();
  }

  const platformApps = apps.filter((app) => {
    if (platform === "android") {
      const isApk = app.app_name.endsWith(".apk");
      if (!isApk) return false;

      const customId = getCustomId(app);

      if (buildType === "store") {
        // Store builds: include only Google prod pipelines, exclude wildcard and Huawei
        if (!customId) return false;

        // Check exclusion patterns first
        const isExcluded = BUILD_PATTERNS.android.store.exclude.some(pattern =>
          pattern.test(customId)
        );
        if (isExcluded) return false;

        return BUILD_PATTERNS.android.store.valid.test(customId);
      } else if (buildType === "inhouse") {
        // Inhouse builds: filter by custom_id based on build type (RELEASE or DAILY)
        if (!customId) return false;

        const buildTypeEnv =
          process.env.ANDROID_INHOUSE_BS_BUILD_TYPE!.toUpperCase();

        if (buildTypeEnv === "RELEASE") {
          return BUILD_PATTERNS.android.inhouse.release.test(customId);
        } else {
          return BUILD_PATTERNS.android.inhouse.daily.test(customId);
        }
      } else {
        // No build type specified, accept Android APKs (let caller further narrow)
        return true;
      }
    } else {
      const isIpa = app.app_name.endsWith(".ipa");
      if (!isIpa) return false;

      if (buildType === "store") {
        // iOS Store builds: filter by custom_id (consistent with other platforms)
        const customId = getCustomId(app);
        if (!customId) return false;

        return BUILD_PATTERNS.ios.store.test(customId);
      } else if (buildType === "sandbox") {
        // iOS Sandbox builds: filter by custom_id based on build type (RELEASE or DAILY)
        const customId = getCustomId(app);
        if (!customId) return false;

        const buildTypeEnv =
          process.env.IOS_SANDBOX_BS_BUILD_TYPE!.toUpperCase();

        if (buildTypeEnv === "RELEASE") {
          return BUILD_PATTERNS.ios.sandbox.release.test(customId);
        } else {
          return BUILD_PATTERNS.ios.sandbox.daily.test(customId);
        }
      } else {
        // No build type specified, return all iOS apps
        return true;
      }
    }
  });

  if (platformApps.length === 0) {
    const buildTypeStr = buildType ? ` (${buildType})` : "";
    throw new Error(
      `No ${platform}${buildTypeStr} apps found on BrowserStack. Available apps: ${apps
        .map((app) => app.app_name)
        .join(", ")}`
    );
  }

  return platformApps;
}

/**
 * Sort apps by semantic version (newest first)
 */
function sortAppsByVersion(apps: BrowserStackApp[]): BrowserStackApp[] {
  return apps.sort((a, b) => {
    // Parse semantic versions (e.g., "13.69.0" -> [13, 69, 0])
    const parseVersion = (version: string): number[] => {
      return version
        .split(".")
        .map((part) => parseInt(part.replace(/[^\d]/g, ""), 10) || 0);
    };

    const versionA = parseVersion(a.app_version);
    const versionB = parseVersion(b.app_version);

    // Compare version parts (major.minor.patch)
    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
      const partA = versionA[i] || 0;
      const partB = versionB[i] || 0;

      if (partA !== partB) {
        return partB - partA; // Newer version first
      }
    }

    // If versions are identical, sort by upload time (newest first)
    const dateA = new Date(a.uploaded_at).getTime();
    const dateB = new Date(b.uploaded_at).getTime();
    return dateB - dateA;
  });
}

/**
 * Fetch latest app for a platform (returns single app)
 */
export async function fetchLatestApp(
  platform: "android" | "ios",
  buildType?: "inhouse" | "sandbox" | "store"
): Promise<BrowserStackApp> {
  const apps = await fetchAppsFromAPI(APP_LIMIT);
  const platformApps = filterAppsByPlatform(apps, platform, buildType);
  const sortedApps = sortAppsByVersion(platformApps);

  const buildTypeStr = buildType ? ` (${buildType})` : "";
  console.log(
    `Found ${platformApps.length} ${platform}${buildTypeStr} apps, using latest: ${sortedApps[0].app_name}`
  );

  return sortedApps[0];
}

/**
 * Fetch all apps for a platform
 */
export async function fetchAllApps(
  platform: "android" | "ios",
  buildType?: "inhouse" | "sandbox" | "store"
): Promise<BrowserStackApp[]> {
  const apps = await fetchAppsFromAPI(APP_LIMIT);
  const platformApps = filterAppsByPlatform(apps, platform, buildType);
  const sortedApps = sortAppsByVersion(platformApps);

  const buildTypeStr = buildType ? ` (${buildType})` : "";
  console.log(
    `Found ${platformApps.length} ${platform}${buildTypeStr} apps (sorted by version)`
  );

  return sortedApps;
}
