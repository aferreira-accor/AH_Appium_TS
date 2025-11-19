import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import parse from "@cucumber/tag-expressions";

/**
 * Parse Cucumber feature files to extract @locale:XX_YY tags
 * This runs BEFORE WebdriverIO generates capabilities
 */

/**
 * Find the first feature file that contains a scenario matching the given tags
 * @param specs - Spec pattern(s) to search
 * @param tags - Cucumber tag expression to filter (e.g., "@American")
 * @returns Path to the first matching feature file, or null
 */
export function findMatchingFeatureFile(
  specs: string | string[],
  tags?: string
): string | null {
  const specPatterns = Array.isArray(specs) ? specs : [specs];
  const featureFiles: string[] = [];

  for (const pattern of specPatterns) {
    const files = globSync(pattern);
    featureFiles.push(...files);
  }

  for (const featureFile of featureFiles) {
    const content = fs.readFileSync(featureFile, "utf-8");
    const lines = content.split("\n");

    const featureTags: string[] = []; // Tags at Feature level (persistent)
    let scenarioTags: string[] = []; // Tags at Scenario level (reset after each scenario)
    let inFeature = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Collect tags
      if (trimmed.startsWith("@")) {
        const lineTags = trimmed.split(/\s+/).filter((t) => t.startsWith("@"));
        if (!inFeature) {
          // Tags before Feature: these are Feature-level tags
          featureTags.push(...lineTags);
        } else {
          // Tags after Feature: these are Scenario-level tags
          scenarioTags.push(...lineTags);
        }
        continue;
      }

      // Mark that we've entered the Feature
      if (trimmed.startsWith("Feature:")) {
        inFeature = true;
        continue;
      }

      if (trimmed.startsWith("Scenario:") || trimmed.startsWith("Scenario Outline:")) {
        // Combine Feature tags + Scenario tags
        const allTags = [...featureTags, ...scenarioTags];

        if (tags) {
          const matchesFilter = matchesTagExpression(allTags, tags);
          if (matchesFilter) {
            return featureFile;
          }
        }
        scenarioTags = []; // Reset only scenario tags
      }

      if (trimmed.startsWith("Examples:")) {
        // Check tags on Examples blocks
        const allTags = [...featureTags, ...scenarioTags];
        const matchesFilter = matchesTagExpression(allTags, tags || "");
        if (matchesFilter) {
          return featureFile;
        }
      }
    }
  }

  return null;
}

/**
 * Information about a scenario and its locale configuration
 */
export interface ScenarioLocaleInfo {
  scenarioName: string;
  localeId: string | null;
  languageId: string | null;
  tags: string[];
}

/**
 * Extract all scenarios with their locale tags from a feature file
 * @param featureFile - Path to the feature file
 * @param tags - Cucumber tag expression to filter (e.g., "@American or @Japanese")
 * @returns Array of scenario info with locale IDs
 */
export function extractAllScenariosWithLocales(
  featureFile: string,
  tags?: string
): ScenarioLocaleInfo[] {
  const content = fs.readFileSync(featureFile, "utf-8");
  const lines = content.split("\n");
  const scenarios: ScenarioLocaleInfo[] = [];
  const featureTags: string[] = []; // Tags at Feature level (persistent)
  let scenarioTags: string[] = []; // Tags at Scenario level (reset after each scenario)
  let inFeature = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Collect tags
    if (trimmed.startsWith("@")) {
      const lineTags = trimmed.split(/\s+/).filter((t) => t.startsWith("@"));
      if (!inFeature) {
        // Tags before Feature: these are Feature-level tags
        featureTags.push(...lineTags);
      } else {
        // Tags after Feature: these are Scenario-level tags
        scenarioTags.push(...lineTags);
      }
      continue;
    }

    // Mark that we've entered the Feature
    if (trimmed.startsWith("Feature:")) {
      inFeature = true;
      continue;
    }

    if (trimmed.startsWith("Scenario:") || trimmed.startsWith("Scenario Outline:")) {
      // Combine Feature tags + Scenario tags
      const allTags = [...featureTags, ...scenarioTags];

      // Check if scenario matches the tag filter
      if (tags) {
        const matchesFilter = matchesTagExpression(allTags, tags);

        // DEBUG: Log matching result
        if (process.env.DEBUG_TAG_PARSER === 'true') {
          console.log(`[TAG PARSER DEBUG] Scenario: ${trimmed.substring(0, 50)}`);
          console.log(`[TAG PARSER DEBUG]   Tags: ${allTags.join(', ')}`);
          console.log(`[TAG PARSER DEBUG]   Expression: ${tags}`);
          console.log(`[TAG PARSER DEBUG]   Match: ${matchesFilter}`);
        }

        if (!matchesFilter) {
          scenarioTags = []; // Reset only scenario tags
          continue;
        }
      }

      // Extract locale and language tags if present
      const localeTag = allTags.find((t) => t.startsWith("@locale:"));
      const localeId = localeTag ? localeTag.replace("@locale:", "") : null;

      const languageTag = allTags.find((t) => t.startsWith("@language:"));
      const languageId = languageTag ? languageTag.replace("@language:", "") : null;

      scenarios.push({
        scenarioName: trimmed,
        localeId,
        languageId,
        tags: allTags,
      });

      scenarioTags = []; // Reset only scenario tags (Feature tags persist)
    }
  }

  return scenarios;
}

/**
 * Count how many scenarios in a feature file match the given tag expression
 * @param featureFile - Path to the feature file
 * @param tags - Cucumber tag expression to filter (e.g., "@American or @Japanese")
 * @returns Number of matching scenarios
 */
export function countMatchingScenariosInFile(
  featureFile: string,
  tags?: string
): number {
  return extractAllScenariosWithLocales(featureFile, tags).length;
}

/**
 * Extract @locale:XX_YY tags from feature files matching the current config
 * @param specs - Spec pattern(s) to search
 * @param tags - Cucumber tag expression to filter (e.g., "@American")
 * @returns First detected locale ID, or null
 */
export function extractLocaleFromSpecs(
  specs: string | string[],
  tags?: string
): string | null {
  const specPatterns = Array.isArray(specs) ? specs : [specs];
  const featureFiles: string[] = [];

  // Resolve all feature files from specs
  for (const pattern of specPatterns) {
    const files = globSync(pattern);
    featureFiles.push(...files);
  }

  console.log(`[TAG PARSER] Scanning ${featureFiles.length} feature files for @locale tags...`);

  // Parse each feature file
  for (const featureFile of featureFiles) {
    const content = fs.readFileSync(featureFile, "utf-8");
    const lines = content.split("\n");

    let currentTags: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Collect tags
      if (line.startsWith("@")) {
        const lineTags = line.split(/\s+/).filter((t) => t.startsWith("@"));
        currentTags.push(...lineTags);
        continue;
      }

      // Detect scenario start
      if (line.startsWith("Scenario:") || line.startsWith("Scenario Outline:")) {
        // Check if scenario matches the tag filter
        if (tags) {
          const matchesFilter = matchesTagExpression(currentTags, tags);

          if (!matchesFilter) {
            currentTags = [];
            continue;
          }
        }

        // Extract @locale:XX_YY tag
        const localeTag = currentTags.find((t) => t.startsWith("@locale:"));
        if (localeTag) {
          const localeId = localeTag.replace("@locale:", "");
          console.log(`[TAG PARSER] ✓ Found locale: ${localeId} in ${path.basename(featureFile)}`);
          console.log(`[TAG PARSER]   Scenario: ${line}`);
          return localeId;
        }

        currentTags = [];
      }

      // Detect Examples block (for Scenario Outline)
      if (line.startsWith("Examples:")) {
        // Look ahead for tags on Examples
        if (i > 0) {
          const prevLines = lines.slice(Math.max(0, i - 5), i);
          const exampleTags = prevLines
            .filter((l) => l.trim().startsWith("@"))
            .flatMap((l) => l.trim().split(/\s+/).filter((t) => t.startsWith("@")));

          const localeTag = exampleTags.find((t) => t.startsWith("@locale:"));
          if (localeTag) {
            const localeId = localeTag.replace("@locale:", "");
            console.log(`[TAG PARSER] ✓ Found locale: ${localeId} in ${path.basename(featureFile)} (Examples)`);
            return localeId;
          }
        }
      }
    }
  }

  console.log("[TAG PARSER] No @locale:XX_YY tag found, using default (fr_FR)");
  return null;
}

/**
 * Match tags against a Cucumber tag expression using the official @cucumber/tag-expressions library
 * Supports all Cucumber tag expression syntax:
 * - Simple: @tag
 * - OR: @tag1 or @tag2
 * - AND: @tag1 and @tag2
 * - NOT: not @tag
 * - Parentheses: (@tag1 or @tag2) and @tag3
 *
 * @param scenarioTags - Array of tags on the scenario (e.g., ["@locale:fr_FR", "@French"])
 * @param expression - Cucumber tag expression (e.g., "@French or @American")
 * @returns true if the scenario matches the expression
 */
function matchesTagExpression(scenarioTags: string[], expression: string): boolean {
  try {
    // The library expects tags WITHOUT the @ prefix
    // Remove @ from both the expression and the scenario tags
    const expressionWithoutAt = expression.replace(/@/g, '');
    const tagsWithoutAt = scenarioTags.map(tag => tag.replace(/^@/, ''));

    // Parse the tag expression using Cucumber's official parser
    const tagExpression = parse(expressionWithoutAt);

    // Evaluate the expression against the scenario's tags
    return tagExpression.evaluate(tagsWithoutAt);
  } catch (error) {
    // If parsing fails, fall back to simple string matching for backward compatibility
    console.warn(`[TAG PARSER] Failed to parse tag expression "${expression}":`, error);
    return scenarioTags.some(tag => tag === expression);
  }
}
