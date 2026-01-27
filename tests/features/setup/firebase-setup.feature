@firebase
Feature: Firebase App Distribution Installation
  Install apps from Firebase App Distribution (App Tester) for local Android testing.
  Uses .env configuration with search priority: JIRA_KEY > BUILD_NUMBER > BUILD_VERSION > latest.
  # ============================================
  # HIGH-LEVEL SCENARIOS (Recommended)
  # ============================================

  @android_inhouse
  Scenario: Install Inhouse app from Firebase
    Given I install the Inhouse app from Firebase
    Then the Inhouse app should be launched

  @android_store
  Scenario: Install Store app from Firebase
    Given I install the Store app from Firebase
    Then the Android Store app should be launched
  # ============================================
  # UNINSTALL SCENARIOS
  # ============================================

  @android_inhouse @uninstall
  Scenario: Uninstall Inhouse app
    Given I uninstall the Inhouse app

  @android_store @uninstall
  Scenario: Uninstall Android Store app
    Given I uninstall the Android Store app

  @uninstall @all
  Scenario: Uninstall all Android Accor apps
    Given I uninstall all Android Accor apps
  # ============================================
  # FRESH INSTALL SCENARIOS (Uninstall + Install)
  # ============================================

  @android_inhouse @fresh
  Scenario: Fresh install Inhouse app from Firebase
    Given I fresh install the Inhouse app from Firebase
    Then the Inhouse app should be launched

  @android_store @fresh
  Scenario: Fresh install Store app from Firebase
    Given I fresh install the Store app from Firebase
    Then the Android Store app should be launched
  # ============================================
  # GRANULAR SCENARIOS (For debugging)
  # ============================================

  @android_inhouse @granular
  Scenario: Install Inhouse app step by step
    Given I tap on Inhouse app in Firebase
    When I handle Firebase consent if needed
    And I search for "release" builds
    And I tap on Inhouse version from environment
    And I tap Download
    And I wait for download to complete
    And I tap Install
    And I tap Open
    Then the Inhouse app should be launched

  @android_store @granular
  Scenario: Install Store app step by step
    Given I tap on Store app in Firebase
    When I handle Firebase consent if needed
    And I search for "release" builds
    And I tap on Store version from environment
    And I tap Download
    And I wait for download to complete
    And I tap Install
    And I tap Open
    Then the Android Store app should be launched
