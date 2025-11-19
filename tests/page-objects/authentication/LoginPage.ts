import { BasePage } from "../base/BasePage";

export class LoginPage extends BasePage {
  // Selectors
  private readonly selectors = {
    android: {
      loginButton:
        'android=new UiSelector().resourceId("engage_loginOnboarding_signIn_button")',
    },
    ios: {
      loginButton:
        '-ios class chain:**/XCUIElementTypeButton[`name == "loginAccessSignInButton"`]',
    },
  };

  async waitForLoginPage(): Promise<void> {
    if (driver.isIOS) {
      try {
        await driver.dismissAlert();
        console.log("[LOGIN] ✅ Apple Account alert dismissed");
      } catch {
        console.log("[LOGIN] No Apple Account alert detected");
      }
    }

    // Wait with countdown for app to stabilize
    const totalWaitMs = 10000;
    const intervalMs = 1000;
    const totalSeconds = totalWaitMs / 1000;

    console.log(`[LOGIN] ⏳ Waiting ${totalSeconds}s for app to stabilize...`);
    for (let i = 1; i <= totalSeconds; i++) {
      await driver.pause(intervalMs);
      console.log(`[LOGIN] ⏱️  ${i}s / ${totalSeconds}s`);
    }

    const loginButton = driver.isIOS
      ? this.selectors.ios.loginButton
      : this.selectors.android.loginButton;
    await this.waitForElement(loginButton);
    console.log(`[LOGIN] ✅ Login button found`);
  }
}
