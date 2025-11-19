@Authentication
Feature: Login feature

  @login
  Scenario: Login
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
