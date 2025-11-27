import { Given, When } from "@wdio/cucumber-framework";
import { AppStartupPage } from "../../page-objects/navigation/AppStartupPage";
import { LoginPage } from "../../page-objects/authentication/LoginPage";

const appStartupPage = new AppStartupPage();
const loginPage = new LoginPage();

Given("The app is launched", async function () {
  console.log(`[APP STARTUP] 🚀 "Given The app is launched" step started`);

  // Only execute for android-inhouse app (both local and BrowserStack)
  if (driver.isAndroid) {
    const caps = driver.capabilities as Record<string, unknown>;
    const appPackage = (caps['appium:appPackage'] || caps.appPackage) as string;
    console.log(`[APP STARTUP] 📱 Android detected, appPackage: ${appPackage}`);

    // Only android-inhouse requires environment selection
    if (appPackage === 'com.accor.appli.hybrid.inhouse') {
      console.log(`[APP STARTUP] 🔧 Android Inhouse detected - selecting environment`);
      await appStartupPage.selectEnvironment();
      console.log(`[APP STARTUP] ✅ Environment selected`);
      await appStartupPage.clickValidateButton();
      console.log(`[APP STARTUP] ✅ Validate button clicked - app should launch`);
    } else {
      console.log(`[APP STARTUP] ℹ️  Not Android Inhouse - no environment selection needed`);
    }
  } else {
    console.log(`[APP STARTUP] 📱 iOS detected - no environment selection needed`);
  }

  console.log(`[APP STARTUP] ✅ "Given The app is launched" step completed`);
});

When("I accept the cookies", async function () {
  await appStartupPage.acceptCookies();
});

When("I attempt to login with REC credentials", async function () {
  console.log(`[STEP] Attempting login with REC account to verify environment`);
  await loginPage.attemptLogin("classic_auto@yopmail.com", "Password1");
});