import 'dotenv/config';
import { config as baseConfig } from "../base.conf";
import type { Options } from "@wdio/types";
import { generateLocalIosSandboxCapabilities } from "../capabilities/local-capability-builder";
import { findMatchingFeatureFile } from "../capabilities/utils/cucumber-tag-parser";

// Set environment variable to enable session-per-scenario mode in hooks
process.env.EXECUTION_TYPE = 'local';

// Determine which specs to run based on tags
const tags = process.env.IOS_SANDBOX_LOCAL_TAGS;
let specsToRun: typeof baseConfig.specs = baseConfig.specs;

if (tags) {
  const specsForSearch = Array.isArray(baseConfig.specs)
    ? (baseConfig.specs.flat() as string[])
    : baseConfig.specs ? [baseConfig.specs as string] : [];
  const matchingFile = findMatchingFeatureFile(specsForSearch, tags);
  if (matchingFile) {
    specsToRun = [matchingFile];
    console.log(`[CONFIG] Found matching scenarios in: ${matchingFile.replace(process.cwd(), '')}`);
    console.log(`[CONFIG] Filtering by tags: ${tags}`);
  } else {
    console.log(`[CONFIG] Complex tag expression - will scan all feature files`);
    console.log(`[CONFIG] Filtering by tags: ${tags}`);
  }
} else {
  console.log(`[CONFIG] Using default specs (no tag filter)`);
}

export const config = {
  ...baseConfig,

  runner: 'local',
  exclude: [],
  specs: specsToRun,
  maxInstances: 1,
  logLevel: baseConfig.logLevel,
  bail: baseConfig.bail,
  outputDir: baseConfig.outputDir,
  waitforTimeout: baseConfig.waitforTimeout,
  connectionRetryTimeout: baseConfig.connectionRetryTimeout,
  connectionRetryCount: baseConfig.connectionRetryCount,

  framework: baseConfig.framework,
  cucumberOpts: {
    ...baseConfig.cucumberOpts,
    tags: process.env.IOS_SANDBOX_LOCAL_TAGS,
  },

  reporters: baseConfig.reporters,

  capabilities: generateLocalIosSandboxCapabilities(),

  services: [
    ['appium', {
      command: 'appium',
      args: { port: 4723, 'relaxed-security': true, 'log-level': 'info' }
    }]
  ],

  protocol: 'http',
  hostname: 'localhost',
  port: 4723,
  path: '/wd/hub',

  onPrepare: baseConfig.onPrepare,
  afterScenario: baseConfig.afterScenario,
} as Options.Testrunner;


