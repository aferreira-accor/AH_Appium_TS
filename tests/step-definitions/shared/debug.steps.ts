import { When } from '@wdio/cucumber-framework';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEBUG_OUTPUT_DIR = join(process.cwd(), 'debug-output');

/**
 * Dump the current page source (XML) to a file.
 * Useful for debugging selectors on both Android and iOS.
 * Usage: When I dump the page source
 */
When('I dump the page source', async function () {
  mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const platform = driver.isAndroid ? 'android' : 'ios';
  const filename = `page-source-${platform}-${timestamp}.xml`;
  const filePath = join(DEBUG_OUTPUT_DIR, filename);

  const source = await driver.getPageSource();
  writeFileSync(filePath, source, 'utf-8');
  console.log(`[Debug] ✅ Page source saved to: ${filePath}`);
});

/**
 * Dump the page source with a custom label for easier identification.
 * Usage: When I dump the page source as "testflight-build-list"
 */
When('I dump the page source as {string}', async function (label: string) {
  mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const platform = driver.isAndroid ? 'android' : 'ios';
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `page-source-${platform}-${safeLabel}-${timestamp}.xml`;
  const filePath = join(DEBUG_OUTPUT_DIR, filename);

  const source = await driver.getPageSource();
  writeFileSync(filePath, source, 'utf-8');
  console.log(`[Debug] ✅ Page source "${label}" saved to: ${filePath}`);
});

/**
 * Take a screenshot and save to debug output.
 * Usage: When I take a debug screenshot
 */
When('I take a debug screenshot', async function () {
  mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const platform = driver.isAndroid ? 'android' : 'ios';
  const filename = `screenshot-${platform}-${timestamp}.png`;
  const filePath = join(DEBUG_OUTPUT_DIR, filename);

  const screenshot = await driver.takeScreenshot();
  writeFileSync(filePath, screenshot, 'base64');
  console.log(`[Debug] ✅ Screenshot saved to: ${filePath}`);
});

/**
 * Take a screenshot with a custom label.
 * Usage: When I take a debug screenshot as "after-install"
 */
When('I take a debug screenshot as {string}', async function (label: string) {
  mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const platform = driver.isAndroid ? 'android' : 'ios';
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `screenshot-${platform}-${safeLabel}-${timestamp}.png`;
  const filePath = join(DEBUG_OUTPUT_DIR, filename);

  const screenshot = await driver.takeScreenshot();
  writeFileSync(filePath, screenshot, 'base64');
  console.log(`[Debug] ✅ Screenshot "${label}" saved to: ${filePath}`);
});
