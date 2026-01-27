import { Given, When, Then } from '@wdio/cucumber-framework';
import { FirebaseAppDistributionPage } from '../page-objects/firebase/FirebaseAppDistributionPage';

const firebasePage = new FirebaseAppDistributionPage();

// ============================================
// HIGH-LEVEL STEPS (Recommended)
// ============================================

/**
 * Install Inhouse app from Firebase App Distribution using .env configuration
 * Search priority: JIRA_KEY > BUILD_NUMBER > BUILD_VERSION > latest
 */
Given('I install the Inhouse app from Firebase', { timeout: 300000 }, async function () {
  const buildVersion = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION!;
  const buildNumber = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_NUMBER || undefined;
  const jiraKey = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : `Version: ${buildVersion}`;
  console.log(`[Firebase] Installing Inhouse app (${searchInfo})`);
  await firebasePage.installInhouseApp(buildVersion, buildNumber, jiraKey);
});

/**
 * Install Store app from Firebase App Distribution using .env configuration
 * Search priority: JIRA_KEY > BUILD_NUMBER > BUILD_VERSION > latest
 */
Given('I install the Store app from Firebase', { timeout: 300000 }, async function () {
  const buildVersion = process.env.ANDROID_FIREBASE_LOCAL_STORE_BUILD_VERSION!;
  const buildNumber = process.env.ANDROID_FIREBASE_LOCAL_STORE_BUILD_NUMBER || undefined;
  const jiraKey = process.env.ANDROID_FIREBASE_LOCAL_STORE_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : `Version: ${buildVersion}`;
  console.log(`[Firebase] Installing Store app (${searchInfo})`);
  await firebasePage.installStoreApp(buildVersion, buildNumber, jiraKey);
});

// ============================================
// UNINSTALL STEPS
// ============================================

/**
 * Uninstall Inhouse app from device
 */
Given('I uninstall the Inhouse app', async function () {
  await firebasePage.uninstallInhouseApp();
});

/**
 * Uninstall Store app from device (Android)
 */
Given('I uninstall the Android Store app', async function () {
  await firebasePage.uninstallStoreApp();
});

/**
 * Uninstall both Inhouse and Store apps from device
 */
Given('I uninstall all Android Accor apps', async function () {
  await firebasePage.uninstallAllApps();
});

// ============================================
// FRESH INSTALL STEPS (Uninstall + Install)
// ============================================

/**
 * Fresh install Inhouse app (uninstall first, then install from Firebase)
 */
Given('I fresh install the Inhouse app from Firebase', { timeout: 300000 }, async function () {
  const buildVersion = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION!;
  const buildNumber = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_NUMBER || undefined;
  const jiraKey = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : `Version: ${buildVersion}`;
  console.log(`[Firebase] Fresh installing Inhouse app (${searchInfo})`);
  await firebasePage.freshInstallInhouseApp(buildVersion, buildNumber, jiraKey);
});

/**
 * Fresh install Store app (uninstall first, then install from Firebase)
 */
Given('I fresh install the Store app from Firebase', { timeout: 300000 }, async function () {
  const buildVersion = process.env.ANDROID_FIREBASE_LOCAL_STORE_BUILD_VERSION!;
  const buildNumber = process.env.ANDROID_FIREBASE_LOCAL_STORE_BUILD_NUMBER || undefined;
  const jiraKey = process.env.ANDROID_FIREBASE_LOCAL_STORE_JIRA_KEY || undefined;

  const searchInfo = jiraKey ? `Jira: ${jiraKey}` : buildNumber ? `Build: ${buildNumber}` : `Version: ${buildVersion}`;
  console.log(`[Firebase] Fresh installing Store app (${searchInfo})`);
  await firebasePage.freshInstallStoreApp(buildVersion, buildNumber, jiraKey);
});

// ============================================
// GRANULAR STEPS (For custom flows)
// ============================================

// --- App Selection ---

Given('I tap on Inhouse app in Firebase', async function () {
  await firebasePage.tapOnInhouseApp();
});

Given('I tap on Store app in Firebase', async function () {
  await firebasePage.tapOnStoreApp();
});

// --- Consent ---

When('I handle Firebase consent if needed', async function () {
  await firebasePage.handleConsentIfNeeded();
});

When('I accept Firebase consent', async function () {
  await firebasePage.acceptConsent();
});

// --- Version Selection ---

When('I search for version {string}', async function (version: string) {
  await firebasePage.searchVersion(version);
});

When('I search for "release" builds', async function () {
  await firebasePage.searchVersion('release');
});

When('I tap on the latest version', async function () {
  await firebasePage.tapOnLatestVersion();
});

When('I tap on version {string}', async function (version: string) {
  await firebasePage.tapOnVersion(version);
});

When('I tap on Inhouse version from environment', async function () {
  const buildVersion = process.env.ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION!;
  console.log(`[Firebase] Tapping on Inhouse version ${buildVersion} from environment...`);
  await firebasePage.tapOnVersion(buildVersion);
});

When('I tap on Store version from environment', async function () {
  const buildVersion = process.env.ANDROID_FIREBASE_LOCAL_STORE_BUILD_VERSION!;
  console.log(`[Firebase] Tapping on Store version ${buildVersion} from environment...`);
  await firebasePage.tapOnVersion(buildVersion);
});

// --- Download & Install ---

When('I tap Download', async function () {
  await firebasePage.tapDownload();
});

When('I wait for download to complete', { timeout: 180000 }, async function () {
  await firebasePage.waitForDownloadComplete();
});

When('I tap Install', async function () {
  await firebasePage.tapInstall();
});

When('I tap Open', async function () {
  await firebasePage.tapOpen();
});

// --- Completion ---

Then('the Inhouse app should be launched', async function () {
  await firebasePage.waitForAppLaunched('com.accor.appli.hybrid.inhouse');
});

Then('the Android Store app should be launched', async function () {
  await firebasePage.waitForAppLaunched('com.accor.appli.hybrid');
});
