import { Given, When, Before, Then } from '@wdio/cucumber-framework';
import { TestFlightPage } from '../page-objects/testflight/TestFlightPage';

Before({ tags: '@testflight' }, function () {
  // TestFlight-specific setup
});

const testFlightPage = new TestFlightPage();

Given('I tap on Accor ALL sandbox app', async function () {
  await testFlightPage.tapOnAccorAllSandboxApp();
});

Given('I tap on Accor ALL store app', async function () {
  await testFlightPage.tapOnAccorAllStoreApp();
});

Given('I tap on versions and builds group', async function () {
  await testFlightPage.tapOnVersionsAndBuildsGroup();
});

Given('I select version', async function (this: { pickle?: { tags?: { name: string }[] } }) {
  const scenarioTags = this.pickle?.tags?.map((tag: { name: string }) => tag.name) || [];
  let buildVersion: string;
  if (scenarioTags.includes('@ios_sandbox')) {
    buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION!;
  } else {
    buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_VERSION!;
  }
  await testFlightPage.selectVersion(buildVersion);
});

When('I download build', { timeout: 300000 }, async function (this: { pickle?: { tags?: { name: string }[] } }) {
  // Determine which build version and number to use based on current scenario tags
  const scenarioTags = this.pickle?.tags?.map((tag: { name: string }) => tag.name) || [];

  let buildVersion: string;
  let buildNumber: string;

  if (scenarioTags.includes('@ios_store')) {
    buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_VERSION!;
    buildNumber = process.env.IOS_TESTFLIGHT_LOCAL_STORE_BUILD_NUMBER!;
    console.log(`Using store build from environment: ${buildVersion} (${buildNumber})`);
  } else {
    buildVersion = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION!;
    buildNumber = process.env.IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER!;
    console.log(`Using sandbox build from environment: ${buildVersion} (${buildNumber})`);
  }
  await testFlightPage.downloadBuild(buildVersion, buildNumber);
});

Then('the installation should be completed', async function () {
    await testFlightPage.waitForInstallationComplete();
});

When('I click on Open to launch the app', async function () {
  await testFlightPage.openInstalledApp();
});

When('I dismiss TestFlight onboarding dialogs', async function () {
  await testFlightPage.dismissOnboardingDialogs();
});