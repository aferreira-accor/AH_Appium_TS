# TestFlight - iOS

## Contexte

Automatisation de l'installation d'apps iOS via TestFlight.
Permet d'installer des builds Sandbox et Store directement depuis TestFlight sur un iPhone connecte.

- **Bundle TestFlight** : `com.apple.TestFlight`
- **Bundle Sandbox** : `fr.accor.push.sandbox`
- **Bundle Store** : `fr.accor.push`

---

## Configuration `.env`

```bash
# TestFlight Local Configuration
# Search priority: JIRA_KEY > BUILD_NUMBER > BUILD_VERSION (Build ISO Prod / first build)
IOS_TESTFLIGHT_LOCAL_DEVICE_NAME=iPhone 13 mini
IOS_TESTFLIGHT_LOCAL_TAGS=@ios_sandbox and @fresh

IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION=13.80.0
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER=
IOS_TESTFLIGHT_LOCAL_SANDBOX_JIRA_KEY=

IOS_TESTFLIGHT_LOCAL_STORE_BUILD_VERSION=13.79.0
IOS_TESTFLIGHT_LOCAL_STORE_BUILD_NUMBER=
IOS_TESTFLIGHT_LOCAL_STORE_JIRA_KEY=
```

### Priorite de recherche

Remplir **UN seul** des trois champs selon le besoin. Le flow applique cette priorite :

| Priorite | Champ `.env` | Exemple | Comportement |
|----------|-------------|---------|--------------|
| 1 | `JIRA_KEY` | `DAPP-49901` | Scroll dans la liste des builds, match la description JIRA |
| 2 | `BUILD_NUMBER` | `40389` | Scroll dans la liste des builds, match le build number |
| 3 | _(vide)_ | | Sandbox: installe "Build ISO Prod" / Store: installe le premier build |

### Exemples d'utilisation

**Installer un build de branche Jira :**
```bash
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION=13.80.0
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER=
IOS_TESTFLIGHT_LOCAL_SANDBOX_JIRA_KEY=DAPP-49901
```

**Installer un build par numero :**
```bash
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION=13.80.0
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER=260126.40389
IOS_TESTFLIGHT_LOCAL_SANDBOX_JIRA_KEY=
```

**Installer le build par defaut (Build ISO Prod) :**
```bash
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_VERSION=13.80.0
IOS_TESTFLIGHT_LOCAL_SANDBOX_BUILD_NUMBER=
IOS_TESTFLIGHT_LOCAL_SANDBOX_JIRA_KEY=
```

---

## Commandes

```bash
# Lancer les tests TestFlight
npm run test:testflight:local
```

### Tags disponibles

| Tag | Description |
|-----|-------------|
| `@ios_sandbox` | Scenarios Sandbox |
| `@ios_store` | Scenarios Store |
| `@fresh` | Fresh install (desinstalle puis reinstalle) |
| `@uninstall` | Desinstallation uniquement |
| `@granular` | Steps detaillees (debug) |

Configurer le tag dans `.env` :
```bash
IOS_TESTFLIGHT_LOCAL_TAGS=@ios_sandbox and @fresh
```

---

## Scenarios disponibles

### High-level (recommande)

```gherkin
# Install simple
Given I install the Sandbox app from TestFlight
Then the Sandbox app should be launched

# Fresh install (desinstalle + reinstalle)
Given I fresh install the Sandbox app from TestFlight
Then the Sandbox app should be launched

# Desinstallation
Given I uninstall the Sandbox app
Given I uninstall all Accor apps
```

### Granular (debug)

```gherkin
Given I tap on Sandbox app in TestFlight
When I tap on Versions and Build Groups
And I select version from environment
And I install the Build ISO Prod
And I handle TestFlight onboarding screens
Then the Sandbox app should be launched
```

---

## Architecture technique

### Fichiers

| Fichier | Role |
|---------|------|
| `tests/page-objects/testflight/TestFlightPage.ts` | Page Object principal |
| `tests/step-definitions/testflight-setup.steps.ts` | Step definitions Cucumber |
| `tests/features/setup/testflight-setup.feature` | Scenarios Cucumber |
| `config/platforms/ios-testflight.local.conf.ts` | Configuration WDIO |
| `config/capabilities/local-capability-builder.ts` | Capabilities Appium |

### Capabilities Appium

```typescript
{
  "appium:bundleId": "com.apple.TestFlight",
  "appium:noReset": true,            // Garder les donnees TestFlight (compte Apple)
  "appium:forceAppLaunch": true,     // Forcer le lancement (kill + restart)
  "appium:shouldTerminateApp": true, // Terminer l'app avant relaunch
  "appium:autoAcceptAlerts": true    // Accepter les alertes systeme (notifications, etc.)
}
```

`noReset: true` est essentiel pour conserver l'authentification Apple dans TestFlight.
`forceAppLaunch + shouldTerminateApp` garantissent que TestFlight repart du home screen a chaque test.

### Flow d'installation (Sandbox)

```
TestFlight Home
     |
     v
Tap sur l'app (Sandbox/Store)
     |
     v
Tap "Versions & Build Groups"
     |
     v
Select version (ex: 13.80.0)
     |
     v
Recherche build: JIRA_KEY > BUILD_NUMBER > "Build ISO Prod" / premier build
     |
     v
Clic sur "Install"
     |
     v
Attente installation (max 2 min) + gestion alertes
     |
     v
Clic sur "Open"
     |
     v
Onboarding TestFlight (Sandbox uniquement: What to Test + Share Feedback)
     |
     v
Verification: l'app est lancee
```

### Details techniques

- **Selecteurs** : iOS class chain (`-ios class chain`) pour la stabilite cross-langues
- **Scroll** : `scrollToElementLazy()` pour les listes lazy-loaded de TestFlight
- **Install button** : XPath `preceding-sibling` pour trouver le bouton "Install" associe au bon build
- **JIRA key** : Match le texte de description du build (ex: "DAPP-49901: ...")
- **Alertes** : `mobile: alert` avec `accept` pour gerer les popups systeme pendant l'installation
- **Onboarding** : "What to Test" + "Share Feedback" (Sandbox uniquement, apres 1ere install)

### Differences avec Firebase

| | Firebase (Android) | TestFlight (iOS) |
|--|--|--|
| Recherche | Barre de recherche integree | Pas de recherche, scroll dans la liste |
| JIRA key | Recherche dans les release notes | Match dans la description visible |
| Bouton Install | Position relative a la version | XPath `preceding-sibling` |
| Dialog systeme | Package installer Android (FR/EN) | Alertes iOS auto-acceptees |
| Onboarding | Consent (1ere fois) | What to Test + Share Feedback |

---

## Historique

| Date | Action |
|------|--------|
| 2026-01-20 | Creation de l'automatisation TestFlight |
| 2026-01-20 | Support Sandbox et Store flows |
| 2026-01-21 | Ajout scroll lazy pour listes TestFlight |
| 2026-01-27 | Ajout `forceAppLaunch` + `shouldTerminateApp` (kill + relaunch) |
| 2026-01-27 | Ajout support recherche par cle Jira (`JIRA_KEY`) |
