#!/usr/bin/env ts-node

/**
 * Cache Manager CLI
 * Command-line interface for managing BrowserStack app and device caches
 */

import "dotenv/config";
import {
  updateApps,
  showDevices,
  updateDevices,
  showApps,
  showCache,
  clearCache,
  DEFAULT_MIN_ANDROID_VERSION,
  DEFAULT_MIN_IOS_VERSION,
} from "./cache";

/**
 * Parse version filter arguments from CLI
 */
function parseVersionFilters(args: string[]): { minVersion?: string; maxVersion?: string } {
  let minVersion: string | undefined;
  let maxVersion: string | undefined;

  for (let i = 1; i < args.length; i += 2) {
    const keyword = args[i];
    const value = args[i + 1];

    if (keyword === "min" && value) {
      minVersion = value;
    } else if (keyword === "max" && value) {
      maxVersion = value;
    } else if (keyword && keyword !== "min" && keyword !== "max") {
      console.error(`❌ Invalid filter syntax: "${keyword}"`);
      console.error(`   Only "min <version>" and "max <version>" are supported for filtering.`);
      console.error(`   Examples:`);
      console.error(`     npm run update-devices:android -- min 15`);
      console.error(`     npm run update-devices:android -- max 18`);
      console.error(`     npm run update-devices:android -- min 15 max 18`);
      console.error(`     npm run show-devices:ios -- min 18 max 26`);
      console.error(``);
      console.error(`   Without arguments, default filters are applied:`);
      console.error(`     Android: >= ${DEFAULT_MIN_ANDROID_VERSION}`);
      console.error(`     iOS: >= ${DEFAULT_MIN_IOS_VERSION}`);
      process.exit(1);
    }
  }

  return { minVersion, maxVersion };
}

/**
 * Display CLI usage help
 */
function showUsage(): void {
  console.log("Usage:");
  console.log("  npm run update-apps:android-inhouse                # Update Android inhouse apps only");
  console.log("  npm run update-apps:android-store                  # Update Android store apps only");
  console.log("  npm run update-apps:ios-sandbox                    # Update iOS sandbox apps only");
  console.log("  npm run update-apps:ios-store                      # Update iOS store apps only");
  console.log("  npm run show-cache                                 # Show cached apps and devices");
  console.log("  npm run show-apps:android-inhouse                  # Show live Android inhouse apps on BrowserStack");
  console.log("  npm run show-apps:android-store                    # Show live Android store apps on BrowserStack");
  console.log("  npm run show-apps:ios-sandbox                      # Show live iOS sandbox apps on BrowserStack");
  console.log("  npm run show-apps:ios-store                        # Show live iOS store apps on BrowserStack");
  console.log("  npm run show-devices:android                       # Show live Android devices");
  console.log("  npm run show-devices:ios                           # Show live iOS devices");
  console.log("  npm run update-devices:android                     # Cache Android devices only");
  console.log("  npm run update-devices:ios                         # Cache iOS devices only");
  console.log("  npm run clear-cache                                # Clear cache");
}

/**
 * Route CLI command to appropriate handler
 */
async function handleCommand(command: string, minVersion?: string, maxVersion?: string): Promise<boolean> {
  switch (command) {
    case "show":
      showCache();
      return true;

    case "show-apps:android":
    case "show-apps:android-inhouse":
      await showApps(["android-inhouse"]);
      return true;

    case "show-apps:android-store":
      await showApps(["android-store"]);
      return true;

    case "show-apps:ios":
    case "show-apps:ios-sandbox":
      await showApps(["ios-sandbox"]);
      return true;

    case "show-apps:ios-store":
      await showApps(["ios-store"]);
      return true;

    case "clear":
      clearCache();
      return true;

    case "android-inhouse":
      await updateApps(["android-inhouse"]);
      return true;

    case "ios-sandbox":
      await updateApps(["ios-sandbox"]);
      return true;

    case "ios-store":
      await updateApps(["ios-store"]);
      return true;

    case "android-store":
      await updateApps(["android-store"]);
      return true;

    case "show-devices:android":
      await showDevices(["android"], minVersion, maxVersion);
      return true;

    case "show-devices:ios":
      await showDevices(["ios"], minVersion, maxVersion);
      return true;

    case "update-devices:android":
      await updateDevices(["android"], minVersion, maxVersion);
      return true;

    case "update-devices:ios":
      await updateDevices(["ios"], minVersion, maxVersion);
      return true;

    default:
      return false;
  }
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse version filters
  const { minVersion, maxVersion } = parseVersionFilters(args);

  // Handle command
  const handled = await handleCommand(command, minVersion, maxVersion);

  if (!handled) {
    showUsage();
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

// Export for programmatic use
export { updateApps, showDevices, updateDevices, showCache, clearCache };
