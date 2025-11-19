import { Then } from "@wdio/cucumber-framework";
import { LoginPage } from "../../page-objects/authentication/LoginPage";

const loginPage = new LoginPage();

Then("The login page is displayed", async function () {
  await loginPage.waitForLoginPage();
});
