import { BasePage } from '../base/BasePage';

/**
 * Firebase App Distribution (App Tester) Page Object
 *
 * Handles installation of apps from Firebase App Distribution for Android.
 *
 * Flow: Home → App Detail → (Consent if first time) → Versions List → Download → Install → Open
 */
export class FirebaseAppDistributionPage extends BasePage {
  // App identifiers
  private static readonly INHOUSE_APP_NAME = 'ALL Accor';
  private static readonly INHOUSE_PACKAGE = 'com.accor.appli.hybrid.inhouse';
  private static readonly STORE_APP_NAME = 'ALL Accor - Hotel booking';
  private static readonly STORE_PACKAGE = 'com.accor.appli.hybrid';

  // Firebase App Distribution package
  private static readonly FIREBASE_PACKAGE = 'dev.firebase.appdistribution';

  // Selectors using resource IDs (stable across languages)
  private static readonly SELECTORS = {
    // Home screen - app list
    appRow: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/row")`,
    appName: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/app_name")`,
    bundleId: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/bundle_id")`,

    // Consent screen (first time only)
    consentCheckbox: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/consent_checkbox")`,
    consentButton: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/consent_button")`,

    // App detail / Versions list
    backButton: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/backToAppListButton")`,
    searchBar: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/search_releases_bar")`,
    releaseRow: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/release_row")`,
    versionInfo: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/version_info")`,
    installedVersionInfo: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/installed_version_info")`,

    // Download/Install buttons
    downloadButton: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/download_button")`,
    downloadLabel: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/download_label")`,
    openButton: `android=new UiSelector().text("Ouvrir")`,
    openButtonEn: `android=new UiSelector().text("Open")`,
    installButton: `android=new UiSelector().text("Installer")`,
    installButtonEn: `android=new UiSelector().text("Install")`,

    // Labels
    latestReleaseLabel: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/labels_latest_release")`,
    installedLabel: `android=new UiSelector().text("Installée")`,
    installedLabelEn: `android=new UiSelector().text("Installed")`,

    // Search - no results
    noResults: `android=new UiSelector().text("Aucun résultat")`,
    noResultsEn: `android=new UiSelector().text("No results")`,
    clearSearchButton: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/search_close_button")`,
    searchIcon: `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/search_icon")`,
  };

  // ============================================
  // APP SELECTION (Home Screen)
  // ============================================

  /**
   * Tap on Inhouse app from Firebase App Distribution home
   */
  async tapOnInhouseApp(): Promise<void> {
    console.log(`[Firebase] Tapping on "${FirebaseAppDistributionPage.INHOUSE_APP_NAME}"...`);
    const selector = `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/app_name").text("${FirebaseAppDistributionPage.INHOUSE_APP_NAME}")`;
    await this.waitAndTap(selector);
  }

  /**
   * Tap on Store app from Firebase App Distribution home
   */
  async tapOnStoreApp(): Promise<void> {
    console.log(`[Firebase] Tapping on "${FirebaseAppDistributionPage.STORE_APP_NAME}"...`);
    const selector = `android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/app_name").text("${FirebaseAppDistributionPage.STORE_APP_NAME}")`;
    await this.waitAndTap(selector);
  }

  // ============================================
  // CONSENT HANDLING (First Time Only)
  // ============================================

  /**
   * Check if consent screen is displayed
   */
  async isConsentScreenDisplayed(): Promise<boolean> {
    return this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.consentCheckbox, 3000);
  }

  /**
   * Accept consent by checking the checkbox and clicking the button
   */
  async acceptConsent(): Promise<void> {
    console.log('[Firebase] Accepting consent...');

    // Check the checkbox
    await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.consentCheckbox);
    await driver.pause(500);

    // Click the start testing button
    await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.consentButton);
    await driver.pause(2000);

    console.log('[Firebase] ✅ Consent accepted');
  }

  /**
   * Handle consent screen if displayed
   */
  async handleConsentIfNeeded(): Promise<void> {
    if (await this.isConsentScreenDisplayed()) {
      await this.acceptConsent();
    } else {
      console.log('[Firebase] Consent screen not displayed, skipping...');
    }
  }

  // ============================================
  // VERSION SELECTION
  // ============================================

  /**
   * Search for a specific version using the search bar
   * @returns true if results found, false if no results
   */
  async searchVersion(versionOrBuildNumber: string): Promise<boolean> {
    console.log(`[Firebase] Searching for version "${versionOrBuildNumber}"...`);

    // Click on search bar to open keyboard
    const searchBar = $(FirebaseAppDistributionPage.SELECTORS.searchBar);
    await searchBar.waitForDisplayed();
    await searchBar.click();
    await driver.pause(500);

    // Type the search term
    await searchBar.setValue(versionOrBuildNumber);
    await driver.pause(500);

    // Press Enter using UiAutomator2 pressKey (no relaxed-security needed)
    await driver.execute('mobile: pressKey', { keycode: 66 });
    console.log('[Firebase] Search submitted');
    await driver.pause(2000); // Wait for search results

    // Check if "No results" is displayed
    const noResultsVisible = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.noResults, 1000);
    if (noResultsVisible) {
      console.log(`[Firebase] ⚠️ Version "${versionOrBuildNumber}" not found`);
      return false;
    }
    return true;
  }

  /**
   * Clear the search bar
   */
  async clearSearch(): Promise<void> {
    console.log('[Firebase] Clearing search...');
    const clearButton = $(FirebaseAppDistributionPage.SELECTORS.clearSearchButton);
    const isVisible = await clearButton.isDisplayed().catch(() => false);
    if (isVisible) {
      await clearButton.click();
      await driver.pause(1000);
    }
  }

  // Store the version element position for download button targeting
  private versionBottomY: number | null = null;

  /**
   * Scroll to a specific version in the list (WITHOUT clicking)
   * The rows are already expanded in search results, so clicking would collapse them.
   * Stores the version position for tapDownload() to find the correct button.
   */
  async tapOnVersion(versionInfo: string): Promise<void> {
    console.log(`[Firebase] Looking for version "${versionInfo}"...`);

    // Use UiScrollable to scroll and find the version_info element (scroll only, no click)
    const scrollableSelector = `android=new UiScrollable(new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/appDetailRecyclerView")).scrollIntoView(new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/version_info").textContains("${versionInfo}"))`;

    try {
      const versionElement = $(scrollableSelector);
      await versionElement.waitForDisplayed({ timeout: 30000 });

      // Store the bottom position of the version text (DO NOT click - rows are already expanded)
      const location = await versionElement.getLocation();
      const size = await versionElement.getSize();
      this.versionBottomY = location.y + size.height;
      console.log(`[Firebase] ✅ Found version "${versionInfo}" at y=${location.y}, bottom=${this.versionBottomY} (not clicking - row already expanded)`);

      await driver.pause(500);
    } catch (error) {
      console.log(`[Firebase] ⚠️ Version "${versionInfo}" not found after scrolling`);
      throw error;
    }
  }

  /**
   * Tap on the first/latest version row
   */
  async tapOnLatestVersion(): Promise<void> {
    console.log('[Firebase] Tapping on latest version...');
    this.versionBottomY = null;
    await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.releaseRow);
    await driver.pause(500);
  }

  // ============================================
  // DOWNLOAD & INSTALL
  // ============================================

  /**
   * Check if app is already installed (Open button visible)
   */
  async isAppInstalled(): Promise<boolean> {
    const openVisible = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.openButton, 2000);
    const openVisibleEn = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.openButtonEn, 1000);
    return openVisible || openVisibleEn;
  }

  /**
   * Tap on Download button for the selected version
   * Uses the stored version position to find the download button below it
   */
  async tapDownload(): Promise<void> {
    console.log('[Firebase] Tapping Download...');

    if (this.versionBottomY !== null) {
      console.log(`[Firebase] Looking for download button below version (y=${this.versionBottomY})...`);

      // Find all download buttons
      const downloadButtons = await $$(`android=new UiSelector().resourceId("${FirebaseAppDistributionPage.FIREBASE_PACKAGE}:id/download_button")`);

      // Find the download button that is:
      // 1. Visible
      // 2. Below the version text position
      // 3. Closest to the version text (within the same expanded row)
      let bestButton = null;
      let bestDistance = Infinity;

      for (const btn of downloadButtons) {
        const isDisplayed = await btn.isDisplayed().catch(() => false);
        if (isDisplayed) {
          const btnLocation = await btn.getLocation();
          const distance = btnLocation.y - this.versionBottomY;

          console.log(`[Firebase] Download button at y=${btnLocation.y}, distance from version=${distance}px`);

          // Button must be BELOW the version text (positive distance)
          // and within 300px (within same expanded row content)
          if (distance > 0 && distance < 300 && distance < bestDistance) {
            bestDistance = distance;
            bestButton = btn;
          }
        }
      }

      if (bestButton) {
        console.log(`[Firebase] ✅ Found download button ${bestDistance}px below version`);
        await bestButton.click();
        console.log('[Firebase] ✅ Clicked download button');
        return;
      }

      console.log('[Firebase] ⚠️ No download button found below version position');
    }

    // Fallback: click first visible download button
    console.log('[Firebase] Using first visible download button as fallback');
    await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.downloadButton);
  }

  /**
   * Wait for download to complete and Install button to appear
   */
  async waitForDownloadComplete(): Promise<void> {
    console.log('[Firebase] Waiting for download to complete...');

    const maxWaitTime = 120000; // 2 minutes
    const checkInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Check if Install button is visible
      const installVisible = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.installButton, 1000);
      const installVisibleEn = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.installButtonEn, 500);

      if (installVisible || installVisibleEn) {
        console.log('[Firebase] ✅ Download complete, Install button visible');
        return;
      }

      // Check if Open button is visible (already installed)
      if (await this.isAppInstalled()) {
        console.log('[Firebase] ✅ App already installed');
        return;
      }

      await driver.pause(checkInterval);
    }

    throw new Error('Download timed out after 2 minutes');
  }

  /**
   * Tap Install button and handle system dialog
   */
  async tapInstall(): Promise<void> {
    console.log('[Firebase] Tapping Install...');

    // Try French first, then English
    const installVisible = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.installButton, 1000);
    if (installVisible) {
      await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.installButton);
    } else {
      await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.installButtonEn);
    }

    // Handle Android system install dialog
    await this.handleSystemInstallDialog();
  }

  /**
   * Handle Android system installation dialog (package installer)
   * Uses resource-id android:id/button1 to be language-independent
   */
  private async handleSystemInstallDialog(): Promise<void> {
    console.log('[Firebase] Handling system install dialog...');
    await driver.pause(2000);

    // Try to find and click the positive button in the system package installer dialog
    // Using resource-id is language-independent (works for "Install", "Installer", etc.)
    try {
      const systemInstallButton = $('android=new UiSelector().resourceId("android:id/button1").packageName("com.google.android.packageinstaller")');
      const isVisible = await systemInstallButton.isDisplayed().catch(() => false);
      if (isVisible) {
        await systemInstallButton.click();
        console.log('[Firebase] ✅ Clicked system Install button (package installer dialog)');
      } else {
        // Fallback: try text-based selectors
        const installFr = $('android=new UiSelector().packageName("com.google.android.packageinstaller").text("Installer")');
        const installEn = $('android=new UiSelector().packageName("com.google.android.packageinstaller").text("Install")');
        const isFrVisible = await installFr.isDisplayed().catch(() => false);
        const isEnVisible = await installEn.isDisplayed().catch(() => false);
        if (isFrVisible) {
          await installFr.click();
          console.log('[Firebase] ✅ Clicked system Install button (FR)');
        } else if (isEnVisible) {
          await installEn.click();
          console.log('[Firebase] ✅ Clicked system Install button (EN)');
        } else {
          console.log('[Firebase] No system install dialog found');
        }
      }
    } catch {
      console.log('[Firebase] No system install dialog found');
    }

    // Wait for installation to complete
    await this.waitForInstallationComplete();
  }

  /**
   * Wait for installation to complete (Open button appears)
   */
  async waitForInstallationComplete(): Promise<void> {
    console.log('[Firebase] Waiting for installation to complete...');

    const maxWaitTime = 60000; // 1 minute
    const checkInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      if (await this.isAppInstalled()) {
        console.log('[Firebase] ✅ Installation complete');
        return;
      }
      await driver.pause(checkInterval);
    }

    throw new Error('Installation timed out after 1 minute');
  }

  /**
   * Tap Open button to launch the installed app
   */
  async tapOpen(): Promise<void> {
    console.log('[Firebase] Tapping Open...');

    const openVisible = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.openButton, 2000);
    if (openVisible) {
      await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.openButton);
    } else {
      await this.waitAndTap(FirebaseAppDistributionPage.SELECTORS.openButtonEn);
    }
  }

  // ============================================
  // UNINSTALL METHODS
  // ============================================

  /**
   * Uninstall Inhouse app from device
   */
  async uninstallInhouseApp(): Promise<void> {
    console.log(`[Firebase] Uninstalling Inhouse app (${FirebaseAppDistributionPage.INHOUSE_PACKAGE})...`);
    try {
      await driver.removeApp(FirebaseAppDistributionPage.INHOUSE_PACKAGE);
      console.log('[Firebase] ✅ Inhouse app uninstalled');
    } catch {
      console.log('[Firebase] Inhouse app was not installed, skipping uninstall');
    }
  }

  /**
   * Uninstall Store app from device
   */
  async uninstallStoreApp(): Promise<void> {
    console.log(`[Firebase] Uninstalling Store app (${FirebaseAppDistributionPage.STORE_PACKAGE})...`);
    try {
      await driver.removeApp(FirebaseAppDistributionPage.STORE_PACKAGE);
      console.log('[Firebase] ✅ Store app uninstalled');
    } catch {
      console.log('[Firebase] Store app was not installed, skipping uninstall');
    }
  }

  /**
   * Uninstall both Inhouse and Store apps from device
   */
  async uninstallAllApps(): Promise<void> {
    console.log('[Firebase] Uninstalling all Accor apps...');
    await this.uninstallInhouseApp();
    await this.uninstallStoreApp();
    console.log('[Firebase] ✅ All apps uninstalled');
  }

  // ============================================
  // APP LAUNCH VERIFICATION
  // ============================================

  /**
   * Wait for the app to be launched and ready
   */
  async waitForAppLaunched(packageName: string): Promise<void> {
    console.log(`[Firebase] Waiting for app ${packageName} to launch...`);

    await driver.pause(5000);

    const currentPackage = await this.getCurrentPackage();
    if (currentPackage === packageName) {
      console.log('[Firebase] ✅ App is running in foreground');
    } else {
      console.log(`[Firebase] Current package: ${currentPackage}, activating ${packageName}...`);
      await driver.activateApp(packageName);
    }
  }

  // ============================================
  // HIGH-LEVEL FLOWS
  // ============================================

  /**
   * Select version based on search priority: jiraKey > buildNumber > buildVersion > latest
   * Handles searching and scrolling to the correct version
   */
  private async selectVersion(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    if (jiraKey) {
      // Priority 1: Search by Jira key (e.g. DAPP-49862)
      // Search results are already expanded with download button visible - DO NOT click on the row
      console.log(`[Firebase] Searching by Jira key "${jiraKey}"...`);
      const found = await this.searchVersion(jiraKey);
      if (!found) {
        throw new Error(`[Firebase] Jira key "${jiraKey}" not found in Firebase`);
      }
      this.versionBottomY = null; // Will use first visible download button
      console.log('[Firebase] Search results displayed, skipping row click (already expanded)');
    } else if (buildNumber) {
      // Priority 2: Search by build number (e.g. 41630)
      // Search results are already expanded with download button visible - DO NOT click on the row
      console.log(`[Firebase] Searching by build number "${buildNumber}"...`);
      const found = await this.searchVersion(buildNumber);
      if (!found) {
        console.log('[Firebase] Build number not found, using latest version instead...');
        await this.clearSearch();
      }
      this.versionBottomY = null; // Will use first visible download button
      console.log('[Firebase] Search results displayed, skipping row click (already expanded)');
    } else if (buildVersion) {
      // Priority 3: Search "release" builds and scroll to specific version
      // Rows are expanded but we need to scroll to the right one
      console.log(`[Firebase] Searching for release version "${buildVersion}"...`);
      await this.searchVersion('release');
      await this.tapOnVersion(buildVersion);
    } else {
      // Priority 4: No filter, use first visible download button
      console.log('[Firebase] No version specified, using first visible build...');
      this.versionBottomY = null;
    }
  }

  /**
   * Download and install the selected version, or open if already installed
   * Handles 3 states: Ouvrir (installed) / Installer (downloaded) / Télécharger (not downloaded)
   */
  private async downloadAndInstall(): Promise<void> {
    // State 1: Already installed → Open
    if (await this.isAppInstalled()) {
      console.log('[Firebase] App already installed, opening...');
      await this.tapOpen();
      return;
    }

    // State 2: Already downloaded, ready to install (button says "Installer")
    const installVisible = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.installButton, 1000);
    const installVisibleEn = await this.isElementVisible(FirebaseAppDistributionPage.SELECTORS.installButtonEn, 500);
    if (installVisible || installVisibleEn) {
      console.log('[Firebase] APK already downloaded, installing directly...');
      await this.tapInstall();
      await this.tapOpen();
      return;
    }

    // State 3: Not downloaded → Download, wait, install, open
    await this.tapDownload();
    await this.waitForDownloadComplete();
    await this.tapInstall();
    await this.tapOpen();
  }

  /**
   * Complete Inhouse installation flow
   */
  async installInhouseApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    await this.tapOnInhouseApp();
    await this.handleConsentIfNeeded();
    await driver.pause(2000);

    await this.selectVersion(buildVersion, buildNumber, jiraKey);
    await this.downloadAndInstall();
    await this.waitForAppLaunched(FirebaseAppDistributionPage.INHOUSE_PACKAGE);
  }

  /**
   * Complete Store installation flow
   */
  async installStoreApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    await this.tapOnStoreApp();
    await this.handleConsentIfNeeded();
    await driver.pause(2000);

    await this.selectVersion(buildVersion, buildNumber, jiraKey);
    await this.downloadAndInstall();
    await this.waitForAppLaunched(FirebaseAppDistributionPage.STORE_PACKAGE);
  }

  /**
   * Fresh install Inhouse app (uninstall first, then install)
   */
  async freshInstallInhouseApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    await this.uninstallInhouseApp();
    await this.installInhouseApp(buildVersion, buildNumber, jiraKey);
  }

  /**
   * Fresh install Store app (uninstall first, then install)
   */
  async freshInstallStoreApp(buildVersion: string, buildNumber?: string, jiraKey?: string): Promise<void> {
    await this.uninstallStoreApp();
    await this.installStoreApp(buildVersion, buildNumber, jiraKey);
  }
}
