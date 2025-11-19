#!/usr/bin/env ts-node
/**
 * Wrapper script for running WebdriverIO tests with scenario splitting
 *
 * This script:
 * 1. Splits feature files into individual scenarios (1 scenario per file)
 * 2. Runs WebdriverIO with parallel execution
 * 3. Cleans up temporary files
 *
 * Usage: ts-node tools/run-parallel-tests.ts <config-file>
 * Example: ts-node tools/run-parallel-tests.ts config/platforms/android-store.browserstack.conf.ts
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { splitScenarios } from './split-scenarios';

// Get config file from command line
const configFile = process.argv[2];
if (!configFile) {
  console.error('❌ Error: Config file path required');
  console.error('Usage: ts-node tools/run-parallel-tests.ts <config-file>');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const sourceSpecDirectory = path.join(projectRoot, 'tests/features');
const tmpSpecDirectory = path.join(projectRoot, '.tmp/parallel-specs');

// Detect platform and buildType from config file name
// Examples:
//   android-store.browserstack.conf.ts → { platform: 'android', buildType: 'store' }
//   ios-sandbox.browserstack.conf.ts → { platform: 'ios', buildType: 'sandbox' }
function detectConfigInfo(configPath: string): { platform: string; buildType: string; envPrefix: string } | null {
  const fileName = path.basename(configPath);
  const match = fileName.match(/^(android|ios)-(store|inhouse|sandbox)\.browserstack\.conf\.ts$/);

  if (!match) {
    return null;
  }

  const platform = match[1];                // android or ios
  const buildType = match[2];               // store, inhouse, or sandbox
  const envPrefix = `${platform.toUpperCase()}_${buildType.toUpperCase()}_BS`;

  return { platform, buildType, envPrefix };
}

const configInfo = detectConfigInfo(configFile);
const envPrefix = configInfo?.envPrefix || null;

// Create config-specific counter file (one per platform-buildType combination)
// This ensures independent device rotation when running multiple configs in parallel
// Examples:
//   android-store → device-counter-android-store.json
//   ios-sandbox → device-counter-ios-sandbox.json
const counterFileName = configInfo
  ? `device-counter-${configInfo.platform}-${configInfo.buildType}.json`
  : 'device-counter.json';
const counterFile = path.join(projectRoot, '.tmp', counterFileName);

// Get tag filter from environment (optional) - use detected envPrefix
const tagFilter = envPrefix ? process.env[`${envPrefix}_TAGS`] : undefined;

console.log('\n🔀 Setting up parallel execution...');
console.log(`   Source: ${sourceSpecDirectory}`);
console.log(`   Temp: ${tmpSpecDirectory}`);
if (tagFilter) {
  console.log(`   Tag filter: ${tagFilter}`);
}

// Initialize device counter file for rotation (create .tmp directory if needed)
const tmpDir = path.dirname(counterFile);
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Initialize counter with JSON structure
const initialCounterData = {
  counter: 0,
  lastUpdated: new Date().toISOString(),
  totalRotations: 0,
  recentRotations: []
};
fs.writeFileSync(counterFile, JSON.stringify(initialCounterData, null, 2), 'utf-8');
console.log('   Initialized device counter for rotation (JSON format)');

// Split scenarios into separate files
try {
  const scenarioCount = splitScenarios(sourceSpecDirectory, tmpSpecDirectory, tagFilter);

  if (scenarioCount === 0) {
    console.error('\n❌ No scenarios found to run!');
    process.exit(1);
  }

  console.log('✅ Parallel setup complete\n');
} catch (error) {
  console.error('❌ Error during parallel setup:', error);
  process.exit(1);
}

// Run WebdriverIO with the config file
console.log(`🏃 Running tests with config: ${configFile}\n`);

const wdioProcess = spawn('npx', ['wdio', 'run', configFile], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: {
    ...process.env,
    WDIO_PARALLEL_EXECUTION: 'true',
    WDIO_TMP_SPEC_DIR: tmpSpecDirectory,
    WDIO_COUNTER_FILE: counterFile,  // Pass counter file path to workers
  },
});

wdioProcess.on('exit', (code) => {
  console.log(`\n✅ Tests completed with exit code: ${code}`);
  process.exit(code || 0);
});

wdioProcess.on('error', (error) => {
  console.error('\n❌ Error running tests:', error);
  process.exit(1);
});
