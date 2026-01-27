@testflight
Feature: TestFlight App Installation

  Install apps from TestFlight for local testing.
  Uses build version/number from .env configuration.

  # ============================================
  # HIGH-LEVEL SCENARIOS (Recommended)
  # ============================================

  @ios_sandbox
  Scenario: Install Sandbox app from TestFlight
    Given I install the Sandbox app from TestFlight
    Then the Sandbox app should be launched

  @ios_store
  Scenario: Install Store app from TestFlight
    Given I install the Store app from TestFlight
    Then the Store app should be launched

  # ============================================
  # UNINSTALL SCENARIOS
  # ============================================

  @ios_sandbox @uninstall
  Scenario: Uninstall Sandbox app
    Given I uninstall the Sandbox app

  @ios_store @uninstall
  Scenario: Uninstall Store app
    Given I uninstall the Store app

  @uninstall @all
  Scenario: Uninstall all Accor apps
    Given I uninstall all Accor apps

  # ============================================
  # FRESH INSTALL SCENARIOS (Uninstall + Install)
  # ============================================

  @ios_sandbox @fresh
  Scenario: Fresh install Sandbox app from TestFlight
    Given I fresh install the Sandbox app from TestFlight
    Then the Sandbox app should be launched

  @ios_store @fresh
  Scenario: Fresh install Store app from TestFlight
    Given I fresh install the Store app from TestFlight
    Then the Store app should be launched

  # ============================================
  # GRANULAR SCENARIOS (For debugging)
  # ============================================

  @ios_sandbox @granular
  Scenario: Install Sandbox app step by step
    Given I tap on Sandbox app in TestFlight
    When I tap on Versions and Build Groups
    And I select version from environment
    And I install the Build ISO Prod
    And I handle TestFlight onboarding screens
    Then the Sandbox app should be launched

  @ios_store @granular
  Scenario: Install Store app step by step
    Given I tap on Store app in TestFlight
    When I tap on Versions and Build Groups
    And I select version from environment
    And I install the first available build
    Then the Store app should be launched
