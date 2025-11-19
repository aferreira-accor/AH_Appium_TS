#!/usr/bin/env ts-node
/**
 * Multi-Locale Test Runner
 *
 * This script runs internationalization tests sequentially, creating a separate
 * WebdriverIO session for each locale configuration.
 *
 * Similar to TestNG's @DataProvider approach, this ensures each scenario runs
 * in its own session with proper locale/language configuration.
 *
 * Usage:
 *   npm run test:multi-locale -- --platform ios --tags "@Internationalization"
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface ScenarioInfo {
  name: string;
  locale: string;
  language: string;
  timezone: string;
  tags: string[];
}

function extractScenariosFromFeature(featureFile: string, tagFilter?: string): ScenarioInfo[] {
  const content = fs.readFileSync(featureFile, 'utf-8');
  const lines = content.split('\n');
  const scenarios: ScenarioInfo[] = [];

  const featureTags: string[] = [];
  let scenarioTags: string[] = [];
  let inFeature = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Collect tags
    if (trimmed.startsWith('@')) {
      const lineTags = trimmed.split(/\s+/).filter(t => t.startsWith('@'));
      if (!inFeature) {
        featureTags.push(...lineTags);
      } else {
        scenarioTags.push(...lineTags);
      }
      continue;
    }

    if (trimmed.startsWith('Feature:')) {
      inFeature = true;
      continue;
    }

    if (trimmed.startsWith('Scenario:')) {
      const allTags = [...featureTags, ...scenarioTags];

      // Check if matches tag filter
      if (tagFilter && !matchesTagExpression(allTags, tagFilter)) {
        scenarioTags = [];
        continue;
      }

      const localeTag = allTags.find(t => t.startsWith('@locale:'));
      const languageTag = allTags.find(t => t.startsWith('@language:'));
      const timezoneTag = allTags.find(t => t.startsWith('@timezone:'));

      if (localeTag && languageTag && timezoneTag) {
        scenarios.push({
          name: trimmed.replace('Scenario:', '').trim(),
          locale: localeTag.replace('@locale:', ''),
          language: languageTag.replace('@language:', ''),
          timezone: timezoneTag.replace('@timezone:', ''),
          tags: allTags
        });
      }

      scenarioTags = [];
    }
  }

  return scenarios;
}

function matchesTagExpression(tags: string[], expression: string): boolean {
  // Simple tag matching - for complex expressions, use @cucumber/tag-expressions
  return tags.some(tag => tag === expression);
}

async function runScenario(scenario: ScenarioInfo, platform: string, config: string): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Running: ${scenario.name}`);
  console.log(`   Locale: ${scenario.locale}, Language: ${scenario.language}, Timezone: ${scenario.timezone}`);
  console.log(`${'='.repeat(80)}\n`);

  const tagFilter = `@locale:${scenario.locale} and @language:${scenario.language} and @timezone:${scenario.timezone}`;

  try {
    execSync(
      `npx wdio run ${config} --cucumberOpts.tagExpression="${tagFilter}"`,
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          WDIO_SINGLE_SCENARIO: 'true',
        }
      }
    );
    console.log(`✅ PASSED: ${scenario.name}\n`);
    return true;
  } catch {
    console.error(`❌ FAILED: ${scenario.name}\n`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(a => a.startsWith('--platform='));
  const tagsArg = args.find(a => a.startsWith('--tags='));

  const platform = platformArg ? platformArg.split('=')[1] : 'ios';
  const tags = tagsArg ? tagsArg.split('=')[1] : '@Internationalization';

  // Determine config file based on platform
  const configMap: Record<string, string> = {
    'ios': './config/platforms/ios-sandbox.local.conf.ts',
    'android': './config/platforms/android-inhouse.local.conf.ts',
  };

  const configFile = configMap[platform];
  if (!configFile) {
    console.error(`❌ Unknown platform: ${platform}`);
    console.error(`   Available: ${Object.keys(configMap).join(', ')}`);
    process.exit(1);
  }

  // Find feature file
  const featureFile = path.join(process.cwd(), 'tests/features/internationalization/locale-testing.feature');
  if (!fs.existsSync(featureFile)) {
    console.error(`❌ Feature file not found: ${featureFile}`);
    process.exit(1);
  }

  // Extract scenarios
  const scenarios = extractScenariosFromFeature(featureFile, tags);

  if (scenarios.length === 0) {
    console.error(`❌ No scenarios found with tags: ${tags}`);
    process.exit(1);
  }

  console.log(`\n📋 Found ${scenarios.length} scenarios to run sequentially:\n`);
  scenarios.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} (${s.locale}/${s.language})`);
  });
  console.log('');

  // Run each scenario in its own session
  const results: Array<{ scenario: ScenarioInfo; passed: boolean }> = [];

  for (const scenario of scenarios) {
    const passed = await runScenario(scenario, platform, configFile);
    results.push({ scenario, passed });
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASSED' : 'FAILED';
    console.log(`${icon} ${status}: ${result.scenario.name}`);
  });

  console.log(`\n📈 Total: ${scenarios.length} scenarios`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Success rate: ${Math.round((passed / scenarios.length) * 100)}%\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
