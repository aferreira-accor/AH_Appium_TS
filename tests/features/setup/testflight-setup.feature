Feature: TestFlight App Installation

  @testflight @ios_sandbox
  Scenario: Install TestFlight app and launch
    Given I tap on Accor ALL sandbox app
    When I tap on versions and builds group
    And I select version
    And I download build
    Then the installation should be completed
    And I click on Open to launch the app
    And I dismiss TestFlight onboarding dialogs
  # @testflight @ios_store
  # Scenario: Install Store app and launch
  #   Given I click on Accor ALL store app
  #   And I scroll to versions and builds button
  #   And I click on versions and builds button
  #   And I select version
  #   And I download build
  #   And I accept cellular data alert if present
  #   Then the installation should be completed
  #   And I click on Open to launch the app
  #   And I dismiss TestFlight onboarding dialogs
