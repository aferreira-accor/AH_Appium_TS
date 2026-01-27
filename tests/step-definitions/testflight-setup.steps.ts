import { Given, When, Then } from '@wdio/cucumber-framework';
import { TestFlightPage } from '../page-objects/testflight/TestFlightPage';

const testFlightPage = new TestFlightPage();

// ============================================
// HIGH-LEVEL STEPS (Recommended)
// ============================================

/**
 * Install Sandbox app from TestFlight using .env configuration
 * This handles the complete flow: navigation → install → alerts → onboarding
 */
Given('I install the Sandbox app from TestFlight', { timeout: 300000 }, async function () {
  const buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION!;
  const buildNumber = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER || undefined;
  const jiraKey = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : 'Build ISO Prod';
  console.log(`[TestFlight] Installing Sandbox app: ${buildVersion} (${searchInfo})`);
  await testFlightPage.installSandboxApp(buildVersion, buildNumber, jiraKey);
});

/**
 * Install Store app from TestFlight using .env configuration
 * This handles the complete flow: navigation → install → alerts → app launch
 */
Given('I install the Store app from TestFlight', { timeout: 300000 }, async function () {
  const buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_VERSION!;
  const buildNumber = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_NUMBER || undefined;
  const jiraKey = process.env.IOS_TESTFLIGHT_LOCAL_STORE_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : 'first build';
  console.log(`[TestFlight] Installing Store app: ${buildVersion} (${searchInfo})`);
  await testFlightPage.installStoreApp(buildVersion, buildNumber, jiraKey);
});

// ============================================
// UNINSTALL STEPS
// ============================================

/**
 * Uninstall Sandbox app from device
 */
Given('I uninstall the Sandbox app', async function () {
  await testFlightPage.uninstallSandboxApp();
});

/**
 * Uninstall Store app from device
 */
Given('I uninstall the Store app', async function () {
  await testFlightPage.uninstallStoreApp();
});

/**
 * Uninstall both Sandbox and Store apps from device
 */
Given('I uninstall all Accor apps', async function () {
  await testFlightPage.uninstallAllApps();
});

// ============================================
// FRESH INSTALL STEPS (Uninstall + Install)
// ============================================

/**
 * Fresh install Sandbox app (uninstall first, then install from TestFlight)
 */
Given('I fresh install the Sandbox app from TestFlight', { timeout: 300000 }, async function () {
  const buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION!;
  const buildNumber = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER || undefined;
  const jiraKey = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : 'Build ISO Prod';
  console.log(`[TestFlight] Fresh installing Sandbox app: ${buildVersion} (${searchInfo})`);
  await testFlightPage.freshInstallSandboxApp(buildVersion, buildNumber, jiraKey);
});

/**
 * Fresh install Store app (uninstall first, then install from TestFlight)
 */
Given('I fresh install the Store app from TestFlight', { timeout: 300000 }, async function () {
  const buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_VERSION!;
  const buildNumber = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_NUMBER || undefined;
  const jiraKey = process.env.IOS_TESTFLIGHT_LOCAL_STORE_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : 'first build';
  console.log(`[TestFlight] Fresh installing Store app: ${buildVersion} (${searchInfo})`);
  await testFlightPage.freshInstallStoreApp(buildVersion, buildNumber, jiraKey);
});

// ============================================
// GRANULAR STEPS (For custom flows)
// ============================================

// --- App Selection ---

Given('I tap on Sandbox app in TestFlight', async function () {
  await testFlightPage.tapOnSandboxApp();
});

Given('I tap on Store app in TestFlight', async function () {
  await testFlightPage.tapOnStoreApp();
});

// --- Navigation ---

When('I tap on Versions and Build Groups', async function () {
  await testFlightPage.tapOnVersionsAndBuildGroups();
});

When('I select version {string}', async function (buildVersion: string) {
  await testFlightPage.selectVersion(buildVersion);
});

When('I select version from environment', async function (this: { pickle?: { tags?: { name: string }[] } }) {
  const scenarioTags = this.pickle?.tags?.map((tag: { name: string }) => tag.name) || [];
  let buildVersion: string;

  if (scenarioTags.includes('@ios_store')) {
    buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_VERSION!;
  } else {
    buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION!;
  }

  await testFlightPage.selectVersion(buildVersion);
});

// --- Build Installation ---

When('I install the Build ISO Prod', async function () {
  await testFlightPage.installBuildISOProd();
});

When('I install build {string}', async function (buildNumber: string) {
  const buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION!;
  await testFlightPage.installBuildByNumber(buildVersion, buildNumber);
});

When('I install the first available build', async function () {
  await testFlightPage.installFirstBuild();
});

// --- TestFlight Onboarding ---

When('I handle TestFlight onboarding screens', async function () {
  await testFlightPage.handleTestFlightOnboarding();
});

When('I tap Continue on What to Test screen', async function () {
  await testFlightPage.handleWhatToTestScreen();
});

When('I tap Continue on Share Feedback screen', async function () {
  await testFlightPage.handleShareFeedbackScreen();
});

// --- Completion ---

Then('the Sandbox app should be launched', async function () {
  await testFlightPage.waitForAppLaunched('fr.accor.push.sandbox');
});

Then('the Store app should be launched', async function () {
  await testFlightPage.waitForAppLaunched('fr.accor.push');
});

When('I tap Open to launch the app', async function () {
  await testFlightPage.tapOpenButton();
});
