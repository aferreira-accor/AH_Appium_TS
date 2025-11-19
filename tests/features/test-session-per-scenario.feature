@SessionTest
Feature: Test that each scenario runs in its own session

  Scenario: First test scenario
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed

  Scenario: Second test scenario
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed

  Scenario: Third test scenario
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
