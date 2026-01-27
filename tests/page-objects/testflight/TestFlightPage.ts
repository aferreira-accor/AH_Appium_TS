import { BasePage } from '../base/BasePage';

/**
 * TestFlight Page Object
 *
 * Handles installation of apps from TestFlight for both Sandbox and Store builds.
 *
 * Flow Sandbox: Home → App Detail → Versions → Build List (select "Build ISO Prod") → Install → Alerts → What to Test → Share Feedback → App
 * Flow Store:   Home → App Detail → Versions → Build List (direct) → Install → Alerts → App
 */
export class TestFlightPage extends BasePage {
  // App identifiers (stable across languages)
  private static readonly SANDBOX_APP_NAME = 'Accor ALL - sandbox';
  private static readonly STORE_APP_NAME = 'ALL Accor - Hotel booking';
  private static readonly BUILD_ISO_PROD_LABEL = 'Build ISO Prod';

  // Bundle IDs for activating apps
  private static readonly SANDBOX_BUNDLE_ID = 'fr.accor.push.sandbox';
  private static readonly STORE_BUNDLE_ID = 'fr.accor.push';

  // Stable selectors (using accessibility identifiers when available)
  private static readonly SELECTORS = {
    // App selection on TestFlight home
    sandboxApp: `-ios class chain:**/XCUIElementTypeStaticText[\`name == "${TestFlightPage.SANDBOX_APP_NAME}"\`]`,
    storeApp: `-ios class chain:**/XCUIElementTypeStaticText[\`name == "${TestFlightPage.STORE_APP_NAME}"\`]`,

    // Navigation
    versionsAndBuildGroupsButton: '-ios class chain:**/XCUIElementTypeButton[`name == "TestFlight.appDetails.versionsAndBuildGroupsButton"`]',

    // Build list
    installButton: '-ios class chain:**/XCUIElementTypeButton[`name == "Install"`]',
    buildISOProdLabel: `-ios class chain:**/XCUIElementTypeStaticText[\`name == "${TestFlightPage.BUILD_ISO_PROD_LABEL}"\`]`,

    // TestFlight onboarding screens (after install - Sandbox only)
    continueButton: '-ios class chain:**/XCUIElementTypeButton[`name == "Continue" OR name == "Continuer"`]',

    // Open button (on home screen after installation)
    openButton: '-ios class chain:**/XCUIElementTypeButton[`name == "Open" OR name == "Ouvrir"`]',
  };

  // ============================================
  // APP SELECTION (Step 1)
  // ============================================

  /**
   * Tap on Accor ALL Sandbox app from TestFlight home
   */
  async tapOnSandboxApp(): Promise<void> {
    console.log(`[TestFlight] Tapping on "${TestFlightPage.SANDBOX_APP_NAME}"...`);
    await this.waitAndTap(TestFlightPage.SELECTORS.sandboxApp);
  }

  /**
   * Tap on Accor ALL Store app from TestFlight home
   */
  async tapOnStoreApp(): Promise<void> {
    console.log(`[TestFlight] Tapping on "${TestFlightPage.STORE_APP_NAME}"...`);
    await this.waitAndTap(TestFlightPage.SELECTORS.storeApp);
  }

  // ============================================
  // NAVIGATION (Steps 2-3)
  // ============================================

  /**
   * Tap on "Versions & Build Groups" button (requires scroll)
   */
  async tapOnVersionsAndBuildGroups(): Promise<void> {
    console.log('[TestFlight] Scrolling to "Versions & Build Groups" button...');
    await this.scrollToElement(TestFlightPage.SELECTORS.versionsAndBuildGroupsButton);
    await this.waitAndTap(TestFlightPage.SELECTORS.versionsAndBuildGroupsButton);
    // Wait for versions list to load
    await driver.pause(5000);
  }

  /**
   * Select a specific version from the versions list
   * Note: Use Button (accessible=true) with BEGINSWITH since name is "13.79.0, 76 Builds"
   */
  async selectVersion(buildVersion: string): Promise<void> {
    console.log(`[TestFlight] Selecting version ${buildVersion}...`);
    const selector = `-ios class chain:**/XCUIElementTypeButton[\`name BEGINSWITH "${buildVersion}"\`]`;
    await this.scrollToElementLazy(selector);
    // Let UI stabilize after scroll
    await driver.pause(300);
    await this.waitAndTap(selector);
    // Wait for builds list to load
    await driver.pause(5000);
  }

  // ============================================
  // BUILD SELECTION & INSTALL (Step 4)
  // ============================================

  /**
   * Find and install a specific build by build number
   */
  async installBuildByNumber(buildVersion: string, buildNumber: string): Promise<void> {
    console.log(`[TestFlight] Looking for build ${buildVersion} (${buildNumber})...`);

    const buildSelector = `-ios class chain:**/XCUIElementTypeStaticText[\`name CONTAINS "${buildNumber}"\`]`;
    await this.scrollToElementLazy(buildSelector);

    // Find the Install button that precedes this build number in the DOM
    const installButtonSelector = `//XCUIElementTypeStaticText[contains(@name, "${buildNumber}")]/preceding-sibling::XCUIElementTypeButton[@name="Install"][1]`;

    console.log(`[TestFlight] Clicking Install for build ${buildNumber}...`);
    await this.waitAndTap(installButtonSelector);
    await this.waitForInstallationToComplete();
  }

  /**
   * Find and install a specific build by Jira key (e.g. DAPP-49862)
   * The Jira key appears in the build description text visible in the list
   */
  async installBuildByJiraKey(jiraKey: string): Promise<void> {
    console.log(`[TestFlight] Looking for build with Jira key "${jiraKey}"...`);

    const jiraSelector = `-ios class chain:**/XCUIElementTypeStaticText[\`name CONTAINS "${jiraKey}"\`]`;
    await this.scrollToElementLazy(jiraSelector);

    // Find the Install button that precedes this Jira description in the DOM
    const installButtonSelector = `//XCUIElementTypeStaticText[contains(@name, "${jiraKey}")]/preceding-sibling::XCUIElementTypeButton[@name="Install"][1]`;

    console.log(`[TestFlight] Clicking Install for Jira key "${jiraKey}"...`);
    await this.waitAndTap(installButtonSelector);
    await this.waitForInstallationToComplete();
  }

  /**
   * Find and install the build labeled "Build ISO Prod" (for Sandbox)
   * This is used when no specific build number is provided
   */
  async installBuildISOProd(): Promise<void> {
    console.log(`[TestFlight] Looking for "${TestFlightPage.BUILD_ISO_PROD_LABEL}" build...`);

    await this.scrollToElementLazy(TestFlightPage.SELECTORS.buildISOProdLabel);

    // Find the Install button that precedes the "Build ISO Prod" label
    // All elements are flat siblings, so we use preceding-sibling to get the closest Install button
    const installButtonSelector = `//XCUIElementTypeStaticText[@name="${TestFlightPage.BUILD_ISO_PROD_LABEL}"]/preceding-sibling::XCUIElementTypeButton[@name="Install"][1]`;

    console.log(`[TestFlight] Clicking Install for "${TestFlightPage.BUILD_ISO_PROD_LABEL}"...`);
    await this.waitAndTap(installButtonSelector);
    await this.waitForInstallationToComplete();
  }

  /**
   * Wait for the installation to complete by checking for "Open" button
   * Also handles any alerts that appear during installation
   * Then clicks Open to launch the app
   */
  private async waitForInstallationToComplete(): Promise<void> {
    console.log('[TestFlight] Waiting for installation to complete...');

    const maxWaitTime = 120000; // 2 minutes
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Try to handle any alerts that appear
      try {
        await driver.execute('mobile: alert', { action: 'accept' });
        console.log('[TestFlight] ✅ Alert accepted during installation');
      } catch {
        // No alert present, continue
      }

      // Check if Open button is visible
      const openButton = $(TestFlightPage.SELECTORS.openButton);
      const isDisplayed = await openButton.isDisplayed().catch(() => false);
      if (isDisplayed) {
        console.log('[TestFlight] ✅ Installation complete');
        // Wait a bit for button to be fully ready
        await driver.pause(500);
        // Click Open to launch the app
        console.log('[TestFlight] Clicking Open to launch app...');
        await this.waitAndTap(TestFlightPage.SELECTORS.openButton);
        return;
      }

      await driver.pause(checkInterval);
    }

    throw new Error('Installation timed out after 2 minutes');
  }

  /**
   * Install the first/only build available (for Store - usually only 1 build per version)
   */
  async installFirstBuild(): Promise<void> {
    console.log('[TestFlight] Installing first available build...');
    await this.waitAndTap(TestFlightPage.SELECTORS.installButton);
    await this.waitForInstallationToComplete();
  }

  // ============================================
  // TESTFLIGHT ONBOARDING (Sandbox only)
  // ============================================

  /**
   * Handle "What to Test" screen by clicking Continue
   */
  async handleWhatToTestScreen(): Promise<void> {
    console.log('[TestFlight] Handling "What to Test" screen...');
    try {
      await this.waitForElement(TestFlightPage.SELECTORS.continueButton, 10000);
      await this.waitAndTap(TestFlightPage.SELECTORS.continueButton);
      console.log('[TestFlight] ✅ "What to Test" screen dismissed');
    } catch {
      console.log('[TestFlight] "What to Test" screen not present, skipping...');
    }
  }

  /**
   * Handle "Share Feedback" screen by clicking Continue
   */
  async handleShareFeedbackScreen(): Promise<void> {
    console.log('[TestFlight] Handling "Share Feedback" screen...');
    try {
      await this.waitForElement(TestFlightPage.SELECTORS.continueButton, 10000);
      await this.waitAndTap(TestFlightPage.SELECTORS.continueButton);
      console.log('[TestFlight] ✅ "Share Feedback" screen dismissed');
    } catch {
      console.log('[TestFlight] "Share Feedback" screen not present, skipping...');
    }
  }

  /**
   * Handle all TestFlight onboarding screens (Sandbox only)
   * These appear after installing a new build
   */
  async handleTestFlightOnboarding(): Promise<void> {
    await this.handleWhatToTestScreen();
    await driver.pause(1000);
    await this.handleShareFeedbackScreen();
  }

  // ============================================
  // COMPLETION (Step 8)
  // ============================================

  /**
   * Wait for the app to be launched and ready
   * After TestFlight onboarding, the app should be visible
   */
  async waitForAppLaunched(bundleId: string): Promise<void> {
    console.log(`[TestFlight] Waiting for app ${bundleId} to launch...`);

    // Give the app time to launch
    await driver.pause(5000);

    // Verify the app is in foreground
    const state = await driver.execute('mobile: queryAppState', { bundleId }) as unknown as number;

    // State 4 = running in foreground
    if (state === 4) {
      console.log('[TestFlight] ✅ App is running in foreground');
    } else {
      console.log(`[TestFlight] App state: ${state}, activating app...`);
      await driver.activateApp(bundleId);
    }
  }

  /**
   * Click Open button to launch the installed app (from TestFlight home)
   */
  async tapOpenButton(): Promise<void> {
    console.log('[TestFlight] Tapping Open button...');
    await this.waitAndTap(TestFlightPage.SELECTORS.openButton);
  }

  // ============================================
  // UNINSTALL METHODS
  // ============================================

  /**
   * Uninstall Sandbox app from device
   */
  async uninstallSandboxApp(): Promise<void> {
    console.log(`[TestFlight] Uninstalling Sandbox app (${TestFlightPage.SANDBOX_BUNDLE_ID})...`);
    try {
      await driver.removeApp(TestFlightPage.SANDBOX_BUNDLE_ID);
      console.log('[TestFlight] ✅ Sandbox app uninstalled');
    } catch {
      console.log('[TestFlight] Sandbox app was not installed, skipping uninstall');
    }
  }

  /**
   * Uninstall Store app from device
   */
  async uninstallStoreApp(): Promise<void> {
    console.log(`[TestFlight] Uninstalling Store app (${TestFlightPage.STORE_BUNDLE_ID})...`);
    try {
      await driver.removeApp(TestFlightPage.STORE_BUNDLE_ID);
      console.log('[TestFlight] ✅ Store app uninstalled');
    } catch {
      console.log('[TestFlight] Store app was not installed, skipping uninstall');
    }
  }

  /**
   * Uninstall both Sandbox and Store apps from device
   */
  async uninstallAllApps(): Promise<void> {
    console.log('[TestFlight] Uninstalling all Accor apps...');
    await this.uninstallSandboxApp();
    await this.uninstallStoreApp();
    console.log('[TestFlight] ✅ All apps uninstalled');
  }

  // ============================================
  // HIGH-LEVEL FLOWS
  // ============================================

  /**
   * Complete Sandbox installation flow
   * Search priority: jiraKey > buildNumber > Build ISO Prod
   */
  async installSandboxApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    // Navigate to build list
    await this.tapOnSandboxApp();
    await this.tapOnVersionsAndBuildGroups();
    await this.selectVersion(buildVersion);

    // Install the build (alerts are handled during installation)
    if (jiraKey) {
      await this.installBuildByJiraKey(jiraKey);
    } else if (buildNumber) {
      await this.installBuildByNumber(buildVersion, buildNumber);
    } else {
      await this.installBuildISOProd();
    }

    // Handle TestFlight onboarding screens
    await this.handleTestFlightOnboarding();

    // Verify app is launched
    await this.waitForAppLaunched(TestFlightPage.SANDBOX_BUNDLE_ID);
  }

  /**
   * Complete Store installation flow
   * Search priority: jiraKey > buildNumber > first build
   */
  async installStoreApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    // Navigate to build list
    await this.tapOnStoreApp();
    await this.tapOnVersionsAndBuildGroups();
    await this.selectVersion(buildVersion);

    // Install the build (alerts are handled during installation)
    if (jiraKey) {
      await this.installBuildByJiraKey(jiraKey);
    } else if (buildNumber) {
      await this.installBuildByNumber(buildVersion, buildNumber);
    } else {
      await this.installFirstBuild();
    }

    // Store doesn't have TestFlight onboarding screens
    // App launches directly after clicking Open

    // Verify app is launched
    await this.waitForAppLaunched(TestFlightPage.STORE_BUNDLE_ID);
  }

  /**
   * Fresh install Sandbox app (uninstall first, then install)
   */
  async freshInstallSandboxApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    await this.uninstallSandboxApp();
    await this.installSandboxApp(buildVersion, buildNumber, jiraKey);
  }

  /**
   * Fresh install Store app (uninstall first, then install)
   */
  async freshInstallStoreApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    await this.uninstallStoreApp();
    await this.installStoreApp(buildVersion, buildNumber, jiraKey);
  }

}
