@EnvironmentCheck
Feature: Environment Verification

  Scenario: Verify app is running in PROD environment
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I attempt to login with REC credentials
