import 'dotenv/config';
import { config as baseConfig } from "../base.conf";
import type { Options } from "@wdio/types";
import { generateLocalIOSCapabilities } from "../capabilities/local-capability-builder";
import { resolveSpecsByTags, LOCAL_APPIUM_SERVICE, LOCAL_CONNECTION } from "../local-config-helper";

process.env.EXECUTION_TYPE = 'local';

const tags = process.env.IOS_TESTFLIGHT_LOCAL_TAGS;

export const config = {
  ...baseConfig,

  specs: resolveSpecsByTags(tags),
  cucumberOpts: { ...baseConfig.cucumberOpts, tags },
  maxInstances: 1,
  capabilities: generateLocalIOSCapabilities({ forceTestFlight: true }),
  services: [LOCAL_APPIUM_SERVICE],
  ...LOCAL_CONNECTION,
} as Options.Testrunner;
