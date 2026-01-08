import { BasePage } from "../base/BasePage";
import { isLocalMode } from "../../step-definitions/hooks/session-management.shared";

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
    // Dismiss Apple Account alert on BrowserStack iOS
    if (driver.isIOS && !isLocalMode()) {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const alertText = await driver.getAlertText();
          if (alertText) {
            await driver.dismissAlert();
            console.log(
              `[LOGIN] ✅ Alert dismissed: "${alertText.substring(0, 50)}..."`
            );
            break;
          }
        } catch {
          // No alert present
        }
        await driver.pause(1000);
      }
    }

    const loginButton = driver.isIOS
      ? this.selectors.ios.loginButton
      : this.selectors.android.loginButton;
    await this.waitForElement(loginButton);
    console.log(`[LOGIN] ✅ Login button found`);
  }

  async goToLoginForm(): Promise<void> {
    const loginButton = driver.isIOS
      ? this.selectors.ios.loginButton
      : this.selectors.android.loginButton;
    await this.waitAndTap(loginButton);
    console.log(`[LOGIN] ✅ Clicked on Sign In button`);

    const emailField = driver.isIOS
      ? this.selectors.ios.emailField
      : this.selectors.android.emailField;
    await this.waitForElement(emailField);
    console.log(`[LOGIN] ✅ Email field found - login form displayed`);
  }

  async attemptLogin(email: string, password: string): Promise<void> {
    console.log(`[LOGIN] 🔐 Attempting login with email: ${email}`);
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

    await driver.pause(10000);
    console.log(`[LOGIN] ⏳ Waiting for login result...`);
  }
}
