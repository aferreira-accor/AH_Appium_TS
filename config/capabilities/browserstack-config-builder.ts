import 'dotenv/config';
import { config as baseConfig } from "../base.conf";
import { globSync } from 'glob';
import type { Options } from "@wdio/types";
import { findMatchingFeatureFile, countMatchingScenariosInFile } from "./utils/cucumber-tag-parser";
import { type LocaleConfig } from "./locale-configs";

// Centralized BrowserStack project name used across all configurations
// Used in both bstack:options (cloud dashboard) and testObservabilityOptions (analytics)
export const BROWSERSTACK_PROJECT_NAME = "AH_Appium_TS";

/**
 * Configuration options for creating a BrowserStack test configuration
 */
export interface BrowserStackConfigOptions {
  /** Platform type (android or ios) */
  platform: 'android' | 'ios';

  /** Build type (inhouse, store, or sandbox) */
  buildType: 'inhouse' | 'store' | 'sandbox';

  /** Environment variable prefix (e.g., 'ANDROID_INHOUSE_BS', 'IOS_SANDBOX_BS') */
  envPrefix: string;

  /** Function that generates capabilities for the specified session count */
  capabilityGenerator: (sessionCount: number) => any[];

  /** Optional function that generates capabilities with specific locales */
  capabilityGeneratorWithLocales?: (localeConfigs: LocaleConfig[]) => { capabilities: any[]; deviceSelection: any[] };

  /** Optional overrides for BrowserStack service configuration */
  serviceOverrides?: Record<string, any>;

  /** Optional overrides for WebdriverIO configuration */
  configOverrides?: Partial<Options.Testrunner>;
}

/**
 * Creates a standardized BrowserStack configuration for WebdriverIO
 *
 * This helper centralizes the common logic shared across all BrowserStack platform configs:
 * - Session count optimization (min of requested sessions and actual spec files)
 * - Tag filtering from environment variables
 * - BrowserStack service configuration
 * - Credentials management
 *
 * @param options - Configuration options
 * @returns Complete WebdriverIO configuration object
 *
 * @example
 * ```typescript
 * export const config = createBrowserStackConfig({
 *   platform: 'android',
 *   buildType: 'inhouse',
 *   envPrefix: 'ANDROID_INHOUSE_BS',
 *   capabilityGenerator: generateAndroidInhouseCapabilities,
 * });
 * ```
 */
export function createBrowserStackConfig(
  options: BrowserStackConfigOptions
) {
  const { envPrefix, capabilityGenerator, capabilityGeneratorWithLocales, serviceOverrides, configOverrides } = options;

  // Read configuration from environment variables
  const sessionCount = parseInt(process.env[`${envPrefix}_PARALLEL_SESSIONS`]!);
  const tags = process.env[`${envPrefix}_TAGS`];

  // Check if parallel execution mode is enabled (scenarios split into separate files)
  const parallelMode = process.env.WDIO_PARALLEL_EXECUTION === 'true';
  const tmpSpecDir = process.env.WDIO_TMP_SPEC_DIR;

  // Determine which specs to run
  // When tags are specified, find the FIRST feature file that contains matching scenarios
  // This prevents WebdriverIO from creating workers for all feature files
  let specsToRun: typeof baseConfig.specs;

  // In parallel mode, use the tmp directory with split scenarios
  if (parallelMode && tmpSpecDir) {
    specsToRun = [`${tmpSpecDir}/**/*.feature`];

    // Only log in main process, not in each worker to reduce noise
    const isWorker = process.env._WDIO_WORKER_;
    if (!isWorker) {
      console.log(`[CONFIG] Parallel mode: ${sessionCount} concurrent worker(s)`);
    }

    // Import fs for directory scanning
    const fs = require('fs');
    const path = require('path');

    // Find locale subdirectories (format: locale__language__timezone)
    const allEntries = fs.readdirSync(tmpSpecDir);
    const subdirectories = allEntries.filter((entry: string) => {
      const fullPath = path.join(tmpSpecDir, entry);
      return fs.statSync(fullPath).isDirectory();
    });

    // Parse locale directories and build configurations
    const localeConfigs: Array<LocaleConfig & { specsPath: string }> = [];
    let capabilities: any[];

    if (subdirectories.length > 0) {

      // Sort subdirectories to put fr_FR first, then alphabetical
      subdirectories.sort((a: string, b: string) => {
        if (a.startsWith('fr_FR')) return -1;
        if (b.startsWith('fr_FR')) return 1;
        return a.localeCompare(b);
      });

      for (const localeDir of subdirectories) {
      // Parse directory name: format is "locale__language__timezone"
      const parts = localeDir.split('__');
      const locale = parts[0] || 'fr_FR';
      const language = parts[1] || locale.split('_')[0] || 'fr';
      const timezone = parts[2] || 'Paris';

      localeConfigs.push({
        locale,
        language,
        timezone,
        specsPath: `${tmpSpecDir}/${localeDir}/**/*.feature`
      });
      }

      if (localeConfigs.length > 0 && capabilityGeneratorWithLocales) {
      // Generate 1 capability per locale directory
      // Each capability will handle all scenarios for its specific locale
      const result = capabilityGeneratorWithLocales(localeConfigs);
      capabilities = result.capabilities;

      // Store device pool info in each capability's metadata
      const devicePoolData = result.deviceSelection.map((d: any) => ({ name: d.name, version: d.version }));

      // Only log device pool details in main process
      if (!isWorker) {
        console.log(`[CONFIG] ${localeConfigs.length} locale(s), ${devicePoolData.length} devices in pool`);
      }

      // Add spec filtering and device pool metadata to each capability
      capabilities.forEach((cap: any, index: number) => {
        // Filter specs for this specific locale
        cap.specs = [localeConfigs[index].specsPath];

        // Limit each capability to 1 concurrent worker
        // Global maxInstances controls total concurrency across all capabilities
        cap.maxInstances = 1;

        // Add device pool metadata for beforeSession hook
        if (cap['appium:options']) {
          (cap['appium:options'] as any).wdioDevicePool = devicePoolData;
        }
      });

      // CRITICAL: When using specs per capability, we must NOT set global specs
      // Otherwise WebdriverIO creates (num_capabilities × num_spec_files) workers
      // Return config with NO global specs (capabilities have their own specs)
      return {
        ...baseConfig,
        specs: [], // EMPTY - each capability has its own specs filter
        cucumberOpts: {
          ...baseConfig.cucumberOpts,
          tags,
        },
        maxInstances: sessionCount, // Global limit across all capabilities
        capabilities,
        services: [
          [
            "browserstack",
            {
              browserstackLocal: false,
              testObservability: true,
              testObservabilityOptions: {
                projectName: BROWSERSTACK_PROJECT_NAME,
              },
              preferScenarioName: true,
              ...serviceOverrides,
            },
          ],
        ],
        user: process.env.BROWSERSTACK_USERNAME,
        key: process.env.BROWSERSTACK_ACCESS_KEY,
        ...configOverrides,
      };
      }
    }
  }  // Close if(parallelMode && tmpSpecDir)
  else {
    // Non-parallel mode: standard WebdriverIO behavior

    if (tags) {
      // Tags specified: try to find matching feature file(s)
      // Convert baseConfig.specs to the right format
      const specsForSearch = Array.isArray(baseConfig.specs)
        ? (baseConfig.specs.flat() as string[])
        : baseConfig.specs
          ? [baseConfig.specs as string]
          : [];

      const matchingFile = findMatchingFeatureFile(specsForSearch, tags);

      if (matchingFile) {
        // Found a matching file → run only that file
        specsToRun = [matchingFile];
        console.log(`[CONFIG] Found matching scenarios in: ${matchingFile.replace(process.cwd(), '')}`);
        console.log(`[CONFIG] Filtering by tags: ${tags}`);
      } else {
        // No single matching file found
        // For complex expressions like "@Internationalization and not @Chinese",
        // we need to scan all files to find matching scenarios
        specsToRun = baseConfig.specs;
        console.log(`[CONFIG] Complex tag expression - will scan all feature files`);
        console.log(`[CONFIG] Filtering by tags: ${tags}`);
      }
    } else {
      // Default: run all specs
      specsToRun = baseConfig.specs;
      console.log(`[CONFIG] Using default specs (no tag filter)`);
    }

    // Count actual spec files to avoid creating more capabilities than needed
    const specPattern = Array.isArray(specsToRun) ? specsToRun[0] : specsToRun;
    const specFiles = specPattern ? globSync(specPattern) : [];
    const actualSpecCount = specFiles.length;

    // Determine effective session count and capability count
    let effectiveSessionCount: number;
    let capabilityCount: number;

    if (tags) {
      // When tags are used with a matching file, count scenarios to optimize workers
      const matchingFile = Array.isArray(specsToRun) && specsToRun.length === 1
        ? specsToRun[0]
        : null;

      // Check if matchingFile is a real file path (not a glob pattern)
      const isGlobPattern = matchingFile && (matchingFile.includes('*') || matchingFile.includes('?'));

      if (typeof matchingFile === 'string' && !isGlobPattern) {
        // We have a single matching file - count scenarios in it
        const scenarioCount = countMatchingScenariosInFile(matchingFile, tags);
        effectiveSessionCount = Math.min(sessionCount, scenarioCount);
        capabilityCount = effectiveSessionCount;
        console.log(`[CONFIG] Found ${scenarioCount} matching scenario(s), using ${effectiveSessionCount} worker(s)`);
      } else {
        // Multiple files, glob pattern, or no specific match - use sessionCount
        effectiveSessionCount = sessionCount;
        capabilityCount = sessionCount;
        console.log(`[CONFIG] Using ${sessionCount} parallel sessions (tags will filter scenarios)`);
      }
    } else {
      // No tags: optimize based on actual spec file count
      effectiveSessionCount = Math.min(sessionCount, actualSpecCount);
      capabilityCount = effectiveSessionCount;
      console.log(`[CONFIG] Using ${effectiveSessionCount} parallel sessions for ${actualSpecCount} spec file(s)`);
    }

    // ========================================
    // MULTI-LOCALE DETECTION FROM CUCUMBER TAGS
    // ========================================
    // Parse feature files to detect ALL unique locales in matching scenarios
    // LOCALE DETECTION TEMPORARILY DISABLED
    // TODO: Re-enable multi-locale mode when we need dedicated workers per locale
    // For now, using standard distribution mode for even scenario distribution across workers
    /*
    // This creates one capability per locale for true multi-locale testing
    console.log("\n[LOCALE DETECTION] Scanning feature files for locale tags...");

    let detectedLocales: Array<{ localeId: string; scenarioTags: string[] }> = [];

    // If we have tags, scan files to extract all scenarios and their locales
    if (tags && specsToRun) {
      // Resolve spec files from patterns
      const specPattern = Array.isArray(specsToRun) ? specsToRun[0] : specsToRun;
      const featureFiles = specPattern ? globSync(specPattern) : [];

      console.log(`[LOCALE DETECTION] Scanning ${featureFiles.length} feature file(s)...`);

      // Collect unique locale configurations from all matching scenarios across all files
      // Key is a stringified version of the locale config for deduplication
      const localeConfigMap = new Map<string, { config: LocaleConfig; tags: string[] }>();

      for (const featureFile of featureFiles) {
        // Extract all scenarios with their locale info from this file
        const scenarios = extractAllScenariosWithLocales(featureFile, tags);

        for (const scenario of scenarios) {
          // Check if scenario has any locale-related tags
          if (hasLocaleConfiguration(scenario.tags)) {
            // Build complete locale config from tags (with fallback to defaults)
            const localeConfig = buildLocaleConfigFromTags(scenario.tags);

            // Create unique key for this locale configuration
            const configKey = `${localeConfig.locale || 'default'}__${localeConfig.language || 'default'}__${localeConfig.timezone || 'default'}`;

            if (!localeConfigMap.has(configKey)) {
              localeConfigMap.set(configKey, {
                config: localeConfig,
                tags: scenario.tags,
              });
            }
          }
        }
      }

      // Convert to array - use locale as localeId for backwards compatibility
      detectedLocales = Array.from(localeConfigMap.values()).map(({ config, tags }) => ({
        localeId: config.locale || 'fr_FR',
        scenarioTags: tags,
      }));

      if (detectedLocales.length > 0) {
        console.log(`[LOCALE DETECTION] ✓ Found ${detectedLocales.length} unique locale configuration(s):`);
        for (const { scenarioTags } of detectedLocales) {
          const config = buildLocaleConfigFromTags(scenarioTags);
          console.log(`[LOCALE DETECTION]   - locale: ${config.locale}, language: ${config.language}, timezone: ${config.timezone}`);
        }
      } else {
        console.log("[LOCALE DETECTION] No locale tags found, using default (fr_FR)");
      }
    }

    // Generate capabilities based on session count
    // Note: Even if locale tags are detected, we use standard distribution mode
    // Locale info is stored in capabilities but scenarios are distributed normally by WebdriverIO
    let capabilities: any[];
    let finalMaxInstances: number;

    if (detectedLocales.length > 0) {
      console.log(`[CONFIG] Detected ${detectedLocales.length} locale(s) - locale info will be available in capabilities`);
    }

    // Always use standard mode: scenarios distributed evenly across workers
    capabilities = capabilityGenerator(capabilityCount);
    finalMaxInstances = effectiveSessionCount;

    console.log(`[CONFIG] Standard distribution mode: ${finalMaxInstances} parallel worker(s)`);
    console.log(`[CONFIG] Scenarios will be distributed evenly across workers`);
    */

    // Using standard distribution mode: scenarios distributed evenly across workers
    console.log("\n[CONFIG] Using standard distribution mode (locale detection disabled)");

    const capabilities = capabilityGenerator(capabilityCount);
    const finalMaxInstances = effectiveSessionCount;

    console.log(`[CONFIG] ${finalMaxInstances} parallel worker(s) will distribute scenarios evenly`);

    return {
      ...baseConfig,

      specs: specsToRun,

      // Use cucumber tags from environment variable
      cucumberOpts: {
        ...baseConfig.cucumberOpts,
        tags,
      },

      // Parallel execution controlled by effective session count or locale count
      maxInstances: finalMaxInstances,

      // Dynamic capabilities based on cached devices
      // Multi-locale mode: one capability per locale with beforeSession filtering
      // Standard mode: capabilities distributed across scenarios
      capabilities,

      // BrowserStack service configuration
      // The service automatically:
      // - Sets session status (passed/failed) on BrowserStack dashboard
      // - Sets session name based on test context
      // - Manages tunneling if browserstackLocal is enabled
      // - Enables Test Observability for advanced analytics and flaky test detection
      services: [
        [
          "browserstack",
          {
            browserstackLocal: false,
            testObservability: true,
            testObservabilityOptions: {
              projectName: BROWSERSTACK_PROJECT_NAME,
              // buildName is auto-generated from test context
            },
            // Use Scenario name as session name in BrowserStack dashboard
            // When each worker runs a single scenario, this shows the scenario name instead of feature name
            preferScenarioName: true,
            ...serviceOverrides,
          },
        ],
      ],

      // BrowserStack credentials from environment
      user: process.env.BROWSERSTACK_USERNAME,
      key: process.env.BROWSERSTACK_ACCESS_KEY,

      // Apply any additional configuration overrides
      ...configOverrides,
    };
  }
}
