@SessionTest
Feature: Test session management per scenario

  Scenario: First scenario
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed

  Scenario: Second scenario
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed

  Scenario: Third scenario
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
