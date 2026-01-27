@LoginTest-Inhouse
Feature: Test Login - Inhouse Builds

  @locale:fr_FR @language:fr @timezone:Paris
  Scenario: Test Login 1
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "testmaccor+3diss@gmail.com" and password "Password1"

  @locale:fr_FR @language:fr @timezone:Paris @Test
  Scenario: Test Login 1
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "diamond_auto@yopmail.com" and password "Password1"

  @locale:en_US @language:en @timezone:New_York
  Scenario: Test Login Sub
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "8796998B" and password "superMotDePass1234!"

  @locale:de_DE @language:de @timezone:Berlin
  Scenario: Test Login 2
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "classic_auto@yopmail.com" and password "Password1"

  @locale:en_GB @language:en @timezone:New_York
  Scenario: Test Login 3
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "classic_auto@yopmail.com" and password "Password1"

  @locale:es_ES @language:es @timezone:Madrid
  Scenario: Test Login 4
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "classic_auto@yopmail.com" and password "Password1"

  @locale:pt_BR @language:pt @timezone:Sao_Paulo
  Scenario: Test Login 5
    Given The app is launched
    When I accept the cookies
    Then The login page is displayed
    When I click on the login button
    When I attempt to login with email "classic_auto@yopmail.com" and password "Password1"
