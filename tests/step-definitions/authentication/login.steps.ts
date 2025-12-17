import { Then, When } from "@wdio/cucumber-framework";
import { LoginPage } from "../../page-objects/authentication/LoginPage";

const loginPage = new LoginPage();

Then("The login page is displayed", async function () {
  await loginPage.waitForLoginPage();
});

When("I click on the login button", async function () {
  await loginPage.goToLoginForm();
});

When(
  "I attempt to login with email {string} and password {string}",
  async function (email: string, password: string) {
    console.log(`[STEP] Attempting login with email: ${email}`);
    await loginPage.attemptLogin(email, password);
  }
);
