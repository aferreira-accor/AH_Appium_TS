#!/usr/bin/env ts-node
/**
 * Split Cucumber scenarios into individual feature files
 *
 * This allows WebdriverIO to distribute scenarios (not feature files) across workers,
 * preventing duplication and enabling true parallel execution.
 *
 * Each scenario keeps its original tags (including locale tags), ensuring flexibility.
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import parseTagExpression from '@cucumber/tag-expressions';
import { extractLocaleFromTags, buildLocaleDirectoryName } from '../config/capabilities/locale-configs';

interface ScenarioInfo {
  name: string;
  tags: string[];
  steps: string[];
  featureName: string;
  featureDescription: string;
  featureTags: string[];
}

/**
 * Parse a Gherkin feature file and extract all scenarios
 */
function parseFeatureFile(filePath: string): ScenarioInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const scenarios: ScenarioInfo[] = [];
  let featureName = '';
  let featureDescription = '';
  let featureTags: string[] = [];
  let currentScenario: ScenarioInfo | null = null;
  let inScenario = false;
  let pendingTags: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Feature tags (before Feature:)
    if (line.startsWith('@') && !featureName) {
      featureTags = line.split(/\s+/).filter(tag => tag.startsWith('@'));
      continue;
    }

    // Feature declaration
    if (line.startsWith('Feature:')) {
      featureName = line.replace('Feature:', '').trim();
      // Read feature description (lines after Feature: until first scenario/tag)
      let j = i + 1;
      const descLines: string[] = [];
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (!nextLine || nextLine.startsWith('@') || nextLine.startsWith('Scenario')) {
          break;
        }
        descLines.push(nextLine);
        j++;
      }
      featureDescription = descLines.join('\n  ');
      continue;
    }

    // Scenario tags
    if (line.startsWith('@')) {
      pendingTags = line.split(/\s+/).filter(tag => tag.startsWith('@'));
      continue;
    }

    // Scenario declaration
    if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      // Save previous scenario if exists
      if (currentScenario) {
        scenarios.push(currentScenario);
      }

      const scenarioName = line.replace(/^Scenario:/, '').replace(/^Scenario Outline:/, '').trim();
      currentScenario = {
        name: scenarioName,
        tags: [...pendingTags],
        steps: [],
        featureName,
        featureDescription,
        featureTags,
      };
      pendingTags = [];
      inScenario = true;
      continue;
    }

    // Scenario steps (Given, When, Then, And, But, *)
    if (inScenario && currentScenario && (
      line.startsWith('Given ') ||
      line.startsWith('When ') ||
      line.startsWith('Then ') ||
      line.startsWith('And ') ||
      line.startsWith('But ') ||
      line.startsWith('* ')
    )) {
      currentScenario.steps.push(`    ${line}`);
    }
  }

  // Don't forget the last scenario
  if (currentScenario) {
    scenarios.push(currentScenario);
  }

  return scenarios;
}

/**
 * Create a feature file for a single scenario
 */
function createScenarioFile(scenario: ScenarioInfo, outputPath: string): void {
  const allTags = [...scenario.featureTags, ...scenario.tags].join(' ');

  const content = `${allTags ? allTags + '\n' : ''}Feature: ${scenario.featureName}
  ${scenario.featureDescription}

${scenario.tags.length > 0 ? '  ' + scenario.tags.join(' ') + '\n' : ''}  Scenario: ${scenario.name}
${scenario.steps.join('\n')}
`;

  fs.writeFileSync(outputPath, content, 'utf-8');
}

/**
 * Main function: split all scenarios from source directory into tmp directory
 * Scenarios are organized in subdirectories by locale (locale__language__timezone)
 */
export function splitScenarios(sourceDir: string, tmpDir: string, tagFilter?: string): number {
  // Clean and create tmp directory
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  // Find all feature files
  const featureFiles = globSync(`${sourceDir}/**/*.feature`);
  console.log(`   Found ${featureFiles.length} feature file(s)`);

  let totalScenarios = 0;
  let filteredScenarios = 0;

  // Map to track scenarios per locale (for statistics only)
  const localeStats = new Map<string, number>();

  for (const featureFile of featureFiles) {
    const scenarios = parseFeatureFile(featureFile);
    totalScenarios += scenarios.length;

    // Filter scenarios by tags if specified using Cucumber's native tag expression parser
    // This supports all Cucumber tag expressions:
    //   - Simple: @Test
    //   - AND: @Test and @locale:en_US
    //   - OR: @smoke or @regression
    //   - NOT: not @skip
    //   - Complex: (@smoke or @regression) and not @wip
    const scenariosToWrite = tagFilter
      ? scenarios.filter(s => {
          try {
            const allTags = [...s.featureTags, ...s.tags];
            const expression = parseTagExpression(tagFilter);
            return expression.evaluate(allTags);
          } catch (error) {
            console.warn(`[TAG FILTER] Invalid tag expression "${tagFilter}":`, error);
            return false;
          }
        })
      : scenarios;

    filteredScenarios += scenariosToWrite.length;

    // Create subdirectories per locale for proper locale configuration
    // Each locale gets its own directory, scenarios are indexed per-locale
    const localeGroups = new Map<string, typeof scenariosToWrite>();

    scenariosToWrite.forEach((scenario) => {
      const allTags = [...scenario.featureTags, ...scenario.tags];
      const localeConfig = extractLocaleFromTags(allTags);
      const directoryName = buildLocaleDirectoryName(localeConfig);

      if (!localeGroups.has(directoryName)) {
        localeGroups.set(directoryName, []);
      }
      localeGroups.get(directoryName)!.push(scenario);
    });

    // Process each locale group
    for (const [localeDir, localeScenarios] of localeGroups.entries()) {
      // Track locale statistics (accumulate across all feature files)
      localeStats.set(localeDir, (localeStats.get(localeDir) || 0) + localeScenarios.length);

      // Create locale subdirectory
      const localeSubDir = path.join(tmpDir, localeDir);
      if (!fs.existsSync(localeSubDir)) {
        fs.mkdirSync(localeSubDir, { recursive: true });
      }

      // Create scenario files with per-locale index
      localeScenarios.forEach((scenario, index) => {
        const baseFileName = path.basename(featureFile, '.feature');
        const paddedIndex = (index + 1).toString().padStart(4, '0');
        const scenarioFileName = `${paddedIndex}_${baseFileName}_${scenario.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.feature`;
        const outputPath = path.join(localeSubDir, scenarioFileName);

        createScenarioFile(scenario, outputPath);
      });
    }
  }

  console.log(`   Total scenarios: ${totalScenarios}`);
  console.log(`   Scenarios to run: ${filteredScenarios}`);
  console.log(`   Locale distribution:`);

  // Display locale statistics
  for (const [localeDir, count] of localeStats.entries()) {
    console.log(`      ${localeDir}: ${count} scenario(s)`);
  }

  return filteredScenarios;
}

// CLI usage
if (require.main === module) {
  const sourceDir = process.argv[2] || 'tests/features';
  const tmpDir = process.argv[3] || '.tmp/parallel-specs';
  const tagFilter = process.argv[4];

  console.log('\n🔀 Splitting scenarios...');
  console.log(`   Source: ${sourceDir}`);
  console.log(`   Temp: ${tmpDir}`);
  if (tagFilter) {
    console.log(`   Tag filter: ${tagFilter}`);
  }

  const count = splitScenarios(sourceDir, tmpDir, tagFilter);
  console.log(`\n✅ Split complete: ${count} scenario(s) ready\n`);
}
