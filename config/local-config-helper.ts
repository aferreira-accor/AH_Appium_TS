import { config as baseConfig } from "./base.conf";
import { findMatchingFeatureFile } from "./capabilities/utils/cucumber-tag-parser";

/**
 * Resolve which spec files to run based on cucumber tag expression.
 * Tries to find a single matching feature file for simple tags,
 * falls back to scanning all feature files for complex expressions.
 */
export function resolveSpecsByTags(tags: string | undefined): typeof baseConfig.specs {
  if (!tags) {
    console.log('[CONFIG] Using default specs (no tag filter)');
    return baseConfig.specs;
  }

  const specsForSearch = Array.isArray(baseConfig.specs)
    ? (baseConfig.specs.flat() as string[])
    : baseConfig.specs ? [baseConfig.specs as string] : [];

  const matchingFile = findMatchingFeatureFile(specsForSearch, tags);

  if (matchingFile) {
    console.log(`[CONFIG] Found matching scenarios in: ${matchingFile.replace(process.cwd(), '')}`);
    console.log(`[CONFIG] Filtering by tags: ${tags}`);
    return [matchingFile];
  }

  console.log('[CONFIG] Complex tag expression - will scan all feature files');
  console.log(`[CONFIG] Filtering by tags: ${tags}`);
  return baseConfig.specs;
}

/** Appium service config shared by all local configs. */
export const LOCAL_APPIUM_SERVICE = [
  'appium', {
    command: './scripts/appium-launcher.sh',
    args: { port: 4723, 'relaxed-security': true, 'log-level': 'info' }
  }
] as const;

/** Connection settings for local Appium server. */
export const LOCAL_CONNECTION = {
  protocol: 'http' as const,
  hostname: 'localhost',
  port: 4723,
  path: '/',
};
