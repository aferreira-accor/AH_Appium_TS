import { BasePage } from "../base/BasePage";

export class LoginPage extends BasePage {
  // Selectors
  private readonly selectors = {
    android: {
      loginButton:
        'android=new UiSelector().resourceId("engage_loginOnboarding_signIn_button")',
      emailField:
        'android=new UiSelector().resourceId("engage_login_engage_login_login_input_input").childSelector(new UiSelector().className("android.widget.EditText"))',
      passwordField:
        'android=new UiSelector().resourceId("engage_login_engage_login_password_input_input").childSelector(new UiSelector().className("android.widget.EditText"))',
      submitButton:
        'android=new UiSelector().resourceId("engage_login_logInWithEmailOrCardNumber_button")',
    },
    ios: {
      loginButton: "accessibility id:loginAccessSignInButton",
      emailField: "accessibility id:loginFieldTitleLabel",
      passwordField: "accessibility id:passwordField",
      submitButton:
        '-ios class chain:**/XCUIElementTypeCell[`name == "confirmationButtonField"`]/**/XCUIElementTypeButton',
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

  async attemptLogin(email: string, password: string): Promise<void> {
    console.log(`[LOGIN] 🔐 Attempting login with email: ${email}`);

    // Click on "Sign In" button to go to login form
    const signInButton = driver.isIOS
      ? this.selectors.ios.loginButton
      : this.selectors.android.loginButton;
    await this.waitAndTap(signInButton);
    console.log(`[LOGIN] ✅ Clicked on Sign In button`);

    // Wait for login form to appear
    await driver.pause(2000);

    // Fill email field
    const emailSelector = driver.isIOS
      ? this.selectors.ios.emailField
      : this.selectors.android.emailField;
    const emailField = await driver.$(emailSelector);
    await emailField.addValue(email);
    console.log(`[LOGIN] ✅ Email entered`);

    // Fill password field
    const passwordSelector = driver.isIOS
      ? this.selectors.ios.passwordField
      : this.selectors.android.passwordField;
    const passwordField = await driver.$(passwordSelector);
    await passwordField.addValue(password);
    console.log(`[LOGIN] ✅ Password entered`);

    // Click on "Connexion" button
    const submitSelector = driver.isIOS
      ? this.selectors.ios.submitButton
      : this.selectors.android.submitButton;
    const connexionButton = await driver.$(submitSelector);
    await connexionButton.click();
    console.log(`[LOGIN] ✅ Clicked on Connexion button`);

    // Wait to see the result
    await driver.pause(3000);
    console.log(`[LOGIN] ⏳ Waiting for login result...`);
  }
}
