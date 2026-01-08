import type { Options } from "@wdio/types";
import path from "path";
import { setDevicePool, getDevicePool, getDeviceByIndex, storeOriginalCapabilities } from '../tests/support/capability-store';

const projectRoot = path.resolve(__dirname, '..');

export const config = {
  runner: "local",
  
  specs: [path.join(projectRoot, "tests/features/**/*.feature")],
  exclude: [],
  capabilities: [],

  // Enable TypeScript support for step definitions
  autoCompileOpts: {
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(projectRoot, 'tsconfig.json'),
    },
  },

  logLevel: "error",
  bail: 0,
  outputDir: "./logs",
  waitforTimeout: 30000,
  connectionRetryTimeout: 300000, // 5 minutes - increased for BrowserStack queue when many tests run in parallel
  connectionRetryCount: 3,

  framework: "cucumber",
  cucumberOpts: {
    require: [
      path.join(projectRoot, "tests/step-definitions/**/*.ts")
    ],
    backtrace: false,
    requireModule: [
      'ts-node/register/transpile-only'
    ],
    dryRun: false,
    failFast: false,
    format: ["progress", "summary"],
    snippets: true,
    source: true,
    strict: true,
    timeout: 90000, // 90 seconds - gives Android Inhouse enough time (config app + env selection + main app launch)
    ignoreUndefinedDefinitions: false,
  },

  reporters: [
    [
      "spec",
      {
        showPreface: true,
      },
    ],
  ],

  // Services and credentials are provided by environment-specific configs

  onPrepare: function () {
    // Suppress Node.js deprecation warnings
    (process as NodeJS.Process & { noDeprecation?: boolean }).noDeprecation = true;
  },

  beforeSession: async function (config, capabilities) {
    try {
      const capsObj = capabilities as Record<string, unknown>;

      // In parallel split mode, rotate devices BEFORE session creation
      // This ensures each new worker/session gets the next device from the pool
      const isParallelSplitMode = process.env.WDIO_PARALLEL_EXECUTION === 'true';
      const isLocal = process.env.EXECUTION_TYPE === 'local' || !process.env.BROWSERSTACK_USERNAME;

      if (isParallelSplitMode && !isLocal) {
        // Initialize device pool ONCE from capability metadata (first session only)
        const appiumOptions = capsObj['appium:options'] as Record<string, unknown> | undefined;
        const devicePoolData = appiumOptions?.wdioDevicePool as Array<{ name: string; version: string }> | undefined;

        if (devicePoolData && devicePoolData.length > 0) {
          const currentPool = getDevicePool();

          // Only initialize if pool is empty (first session)
          if (currentPool.length === 0) {
            setDevicePool(devicePoolData);
            console.log(`[DEVICE POOL] 🎲 Initialized pool with ${devicePoolData.length} device(s) for rotation`);
          }
        }

        // Get next device from the pool for this session
        const nextDevice = await getDeviceByIndex();

        if (nextDevice) {
          capsObj['appium:deviceName'] = nextDevice.name;
          capsObj['appium:platformVersion'] = nextDevice.version;
          console.log(`[DEVICE ROTATION] 🎯 Assigning device to new session: ${nextDevice.name} (v${nextDevice.version})`);
        }
      }

      // Store original capabilities for session reload (BrowserStack per-scenario sessions)
      storeOriginalCapabilities(capsObj);

      const get = (obj: Record<string, unknown>, key: string): string => (typeof obj[key] === 'string' ? obj[key] as string : '');
      const platformName = get(capsObj, 'platformName') || get(capsObj, 'platform');
      const platformVersion = get(capsObj, 'appium:platformVersion') || get(capsObj, 'platformVersion');
      const deviceName = get(capsObj, 'appium:deviceName') || get(capsObj, 'deviceName');
      if (deviceName || platformName || platformVersion) {
        console.log(`Session device: ${deviceName} (${platformName} ${platformVersion})`);
      }

      // Multi-locale support: Each capability has predefined locale settings
      const appiumOptions = capsObj['appium:options'] as Record<string, unknown> | undefined;

      if (appiumOptions?.wdioLocale) {
        const locale = appiumOptions.wdioLocale as string;
        const language = appiumOptions.wdioLanguage as string;
        const timezone = appiumOptions.wdioTimezone as string;
        console.log(`[LOCALE] ${locale}, ${language}, ${timezone}`);
      }
    } catch (error) {
      console.warn('[beforeSession] Error:', error);
    }
  },

  afterScenario: async function (_world: unknown, result: { result?: { status: string } }, _context: unknown) {
    // Take screenshot on failure
    if (result.result && result.result.status === "FAILED") {
      try {
        if (driver && typeof driver.saveScreenshot === 'function') {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          await driver.saveScreenshot(`./screenshots/failed_${timestamp}.png`);
        }
      } catch (error) {
        console.warn("Failed to take screenshot:", error);
      }
    }
  },

  // Force session closure after each spec file (feature file)
  // This ensures each scenario gets a NEW BrowserStack session with potentially different device
  // Critical for achieving: 50 scenarios = 50 BrowserStack sessions (not 2 long sessions)
  afterTest: async function (_test: unknown, _context: unknown, result: { passed: boolean; error?: Error }) {
    const isParallelSplitMode = process.env.WDIO_PARALLEL_EXECUTION === 'true';
    const isLocal = process.env.EXECUTION_TYPE === 'local' || !process.env.BROWSERSTACK_USERNAME;

    // Only force session closure in BrowserStack parallel mode
    if (isParallelSplitMode && !isLocal) {
      try {
        const sessionId = driver.sessionId;
        console.log(`\n[SESSION] 🔄 Closing session after spec file (force new session for next file)`);
        console.log(`[SESSION]    Session ID: ${sessionId}`);
        console.log(`[SESSION]    Test result: ${result.passed ? 'PASSED' : 'FAILED'}`);

        // Delete session - WDIO will be forced to create a new one for the next spec file
        await driver.deleteSession();

        console.log(`[SESSION] ✅ Session closed successfully`);
      } catch (error) {
        console.warn('[SESSION] ⚠️  Error closing session:', error);
      }
    }
  },

  // Log failing step with error and capture a screenshot at step failure
  afterStep: async function (
    step: { keyword?: string; text?: string },
    _scenario: unknown,
    result: { passed: boolean; error?: { message?: string; stack?: string } },
    _context: unknown
  ) {
    try {
      if (!result.passed) {
        const stepName = `${step.keyword || ''}${step.text || ''}`.trim();
        const errorMsg = result.error?.stack || result.error?.message || 'Unknown error';
        console.error(`Step failed: ${stepName}`);
        console.error(errorMsg);
        if (driver && typeof driver.saveScreenshot === 'function') {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = `./screenshots/failed_step_${timestamp}.png`;
          await driver.saveScreenshot(file);
          console.error(`Saved step failure screenshot: ${file}`);
        }
      }
    } catch {}
  },
} as Options.Testrunner;
