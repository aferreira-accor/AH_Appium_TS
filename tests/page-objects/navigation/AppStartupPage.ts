import { BasePage } from "../base/BasePage";

export class AppStartupPage extends BasePage {
  // Dynamic selectors based on app package
  private get selectors() {
    const caps = driver.capabilities as Record<string, unknown>;
    const appPackage = (caps["appium:appPackage"] || caps.appPackage) as string;
    const resourceId =
      appPackage === "com.accor.appli.hybrid"
        ? "com.accor.appli.hybrid:id/btn_accept_cookies"
        : "com.accor.appli.hybrid.inhouse:id/btn_accept_cookies";

    return {
      android: {
        validateButton:
          'android=new UiSelector().resourceId("debug_relaunchApp_button").instance(0)',
        cookieButton: `android=new UiSelector().resourceId("${resourceId}")`,
      },
      ios: {
        cookieButton:
          '-ios class chain:**/XCUIElementTypeButton[`name == "bannerButtonStackFirstItem"`]',
      },
    };
  }

  async selectEnvironment(): Promise<void> {
    const testEnvironment =
      process.env.ANDROID_INHOUSE_LOCAL_TEST_ENVIRONMENT ||
      process.env.ANDROID_INHOUSE_BS_TEST_ENVIRONMENT;
    try {
      const environmentElement = `android=new UiSelector().text("${testEnvironment}")`;
      await this.waitAndTap(environmentElement);
    } catch {
      throw new Error(
        `Environment option "${testEnvironment}" not found - cannot proceed`
      );
    }
  }

  async clickValidateButton(): Promise<void> {
    try {
      const validateButton = this.selectors.android.validateButton;
      await this.waitAndTap(validateButton);
    } catch {
      throw new Error("Validate button not found - cannot proceed");
    }
  }

  async acceptCookies(): Promise<void> {
    const cookieSelector = driver.isAndroid
      ? this.selectors.android.cookieButton
      : this.selectors.ios.cookieButton;
    try {
      console.log("🔍 Looking for OneTrust cookies banner...");
      await this.waitAndTap(cookieSelector, 10000);
      console.log("✅ OneTrust cookies banner accepted");
    } catch {
      console.log("❌ OneTrust cookies banner not found");
    }
  }
}
