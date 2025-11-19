import { BasePage } from '../base/BasePage';

export class TestFlightPage extends BasePage {  
  async tapOnAccorAllSandboxApp(): Promise<void> {
    const selector = '-ios class chain:**/XCUIElementTypeStaticText[`name == "Accor ALL - sandbox"`]';
    await this.waitAndTap(selector);  
  }

  async tapOnAccorAllStoreApp(): Promise<void> {
    const selector = '-ios predicate string: type == "XCUIElementTypeOther" AND value CONTAINS "ALL Accor"';
    await this.waitAndTap(selector);
  }

  async tapOnVersionsAndBuildsGroup(): Promise<void> {
    const selector = '-ios class chain:**/XCUIElementTypeButton[`name == "TestFlight.appDetails.versionsAndBuildGroupsButton"`]';
    await this.scrollToElement(selector);
    await this.waitAndTap(selector);
  }

  async selectVersion(buildVersion: string): Promise<void> {
    const selector = `-ios class chain:**/XCUIElementTypeStaticText[\`name == "${buildVersion}"\`]`;
    await this.scrollToElementLazy(selector);
    await this.waitAndTap(selector);
  }

  async downloadBuild(buildVersion: string, buildNumber: string): Promise<void> {
    for (let i = 0; i < 5; i++) {
      console.log(`  Scroll ${i + 1}/10...`);
      await driver.execute('mobile: scroll', { direction: 'down' });
      await driver.pause(1000);
    }
    
    const selector = '-ios class chain:**/XCUIElementTypeOther[`name == "Build : 13.68.0 (250811.35828), Expire dans 31 jours"`]';
    const el = $(selector);
    
    if (await el.isDisplayed()) {
      console.log(`✅ SUCCESS! Build ${buildVersion} (${buildNumber}) found in DOM!`);
    } else {
      throw new Error(`Build ${buildVersion} (${buildNumber}) not found in DOM`);
    }
  }



  async waitForInstallationComplete(): Promise<void> {
    console.log('Waiting for installation to complete...');
    try {
      await this.waitForElement('-ios class chain:**/XCUIElementTypeButton[`name == "Ouvrir" OR name == "Open"`]');
      console.log('Installation completed successfully - Open button is now available');
    } catch {
      console.log('Installation may still be in progress or failed');
      throw new Error('Installation did not complete within the configured timeout');
    }
  }

  async openInstalledApp(): Promise<void> {
    console.log('Clicking on Ouvrir (Open) button to launch the app...');
    await this.waitAndTap('-ios class chain:**/XCUIElementTypeButton[`name == "Ouvrir" OR name == "Open"`]');
    console.log('App launched successfully from TestFlight');
  }

  async dismissOnboardingDialogs(): Promise<void> {
    console.log('Dismissing TestFlight onboarding dialogs by going to home screen...');
    try {
      console.log('Going to home screen to dismiss onboarding dialogs...');
      await driver.pause(5000);
      await driver.execute('mobile: pressButton', { name: 'home' });
      await driver.pause(5000);
      console.log('Reopening Accor app...');
      await driver.activateApp('fr.accor.push.sandbox');    
      console.log('✅ TestFlight onboarding dialogs dismissed by home screen navigation');
    } catch (error) {
      console.log(`⚠️ Could not dismiss onboarding dialogs: ${error}`);
    }
  }

  async dismissStoreOnboardingDialogs(): Promise<void> {
    console.log('Dismissing Store onboarding dialogs by going to home screen...');
    try {
      console.log('Going to home screen to dismiss onboarding dialogs...');
      await driver.pause(5000);
      await driver.execute('mobile: pressButton', { name: 'home' });
      await driver.pause(5000);
      console.log('Reopening Accor store app...');
      await driver.activateApp('fr.accor.push');    
      console.log('✅ Store onboarding dialogs dismissed by home screen navigation');
    } catch (error) {
      console.log(`⚠️ Could not dismiss onboarding dialogs: ${error}`);
    }
  }
}