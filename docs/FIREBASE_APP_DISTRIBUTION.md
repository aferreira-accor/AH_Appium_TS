# Firebase App Distribution (App Tester) - Android

## Contexte

Automatisation de l'installation d'apps Android via Firebase App Distribution (App Tester).
Permet d'installer des builds Inhouse et Store directement depuis l'app App Tester sur un device Android connecté.

- **Package App Tester** : `dev.firebase.appdistribution`
- **Package Inhouse** : `com.accor.appli.hybrid.inhouse`
- **Package Store** : `com.accor.appli.hybrid`

---

## Configuration `.env`

```bash
# Firebase App Distribution Local Configuration (Android)
# Search priority: JIRA_KEY > BUILD_NUMBER > BUILD_VERSION > latest
ANDROID_FIREBASE_LOCAL_DEVICE_NAME=Google Pixel 8
ANDROID_FIREBASE_LOCAL_TAGS=@android_inhouse and @fresh

ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION=10.79.0
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_NUMBER=
ANDROID_FIREBASE_LOCAL_INHOUSE_JIRA_KEY=

ANDROID_FIREBASE_LOCAL_STORE_BUILD_VERSION=10.79.0
ANDROID_FIREBASE_LOCAL_STORE_BUILD_NUMBER=
ANDROID_FIREBASE_LOCAL_STORE_JIRA_KEY=
```

### Priorite de recherche

Remplir **UN seul** des trois champs selon le besoin. Le flow applique cette priorite :

| Priorite | Champ `.env` | Exemple | Comportement |
|----------|-------------|---------|--------------|
| 1 | `JIRA_KEY` | `DAPP-49862` | Cherche la cle Jira dans les release notes, prend le 1er resultat |
| 2 | `BUILD_NUMBER` | `41630` | Cherche le build number, prend le 1er resultat |
| 3 | `BUILD_VERSION` | `10.79.0` | Cherche "release", scroll jusqu'a la version specifique |
| 4 | Tout vide | | Prend le dernier build de la liste |

### Exemples d'utilisation

**Installer une release specifique :**
```bash
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION=10.79.0
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_NUMBER=
ANDROID_FIREBASE_LOCAL_INHOUSE_JIRA_KEY=
```

**Installer un build par numero :**
```bash
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION=10.79.0
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_NUMBER=41630
ANDROID_FIREBASE_LOCAL_INHOUSE_JIRA_KEY=
```

**Installer un build de branche Jira :**
```bash
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_VERSION=10.79.0
ANDROID_FIREBASE_LOCAL_INHOUSE_BUILD_NUMBER=
ANDROID_FIREBASE_LOCAL_INHOUSE_JIRA_KEY=DAPP-49862
```

---

## Commandes

```bash
# Lancer les tests Firebase
npm run test:android-firebase:local
```

### Tags disponibles

| Tag | Description |
|-----|-------------|
| `@android_inhouse` | Scenarios Inhouse |
| `@android_store` | Scenarios Store |
| `@fresh` | Fresh install (desinstalle puis reinstalle) |
| `@uninstall` | Desinstallation uniquement |
| `@granular` | Steps detaillees (debug) |

Configurer le tag dans `.env` :
```bash
ANDROID_FIREBASE_LOCAL_TAGS=@android_inhouse and @fresh
```

---

## Scenarios disponibles

### High-level (recommande)

```gherkin
# Install simple
Given I install the Inhouse app from Firebase
Then the Inhouse app should be launched

# Fresh install (desinstalle + reinstalle)
Given I fresh install the Inhouse app from Firebase
Then the Inhouse app should be launched

# Desinstallation
Given I uninstall the Inhouse app
Given I uninstall all Android Accor apps
```

### Granular (debug)

```gherkin
Given I tap on Inhouse app in Firebase
When I handle Firebase consent if needed
And I search for "release" builds
And I tap on Inhouse version from environment
And I tap Download
And I wait for download to complete
And I tap Install
And I tap Open
Then the Inhouse app should be launched
```

---

## Architecture technique

### Fichiers

| Fichier | Role |
|---------|------|
| `tests/page-objects/firebase/FirebaseAppDistributionPage.ts` | Page Object principal |
| `tests/step-definitions/firebase-setup.steps.ts` | Step definitions Cucumber |
| `tests/features/setup/firebase-setup.feature` | Scenarios Cucumber |
| `config/platforms/android-firebase.local.conf.ts` | Configuration WDIO |
| `config/capabilities/local-capability-builder.ts` | Capabilities Appium |

### Capabilities Appium

```typescript
{
  "appium:appPackage": "dev.firebase.appdistribution",
  "appium:appActivity": "dev.firebase.appdistribution.debug.FirebaseAppDistributionDevActivity",
  "appium:noReset": true,         // Garder les donnees de App Tester (login Google)
  "appium:forceAppLaunch": true,  // Forcer le lancement
  "appium:shouldTerminateApp": true
}
```

`noReset: true` est essentiel pour conserver l'authentification Google dans App Tester.

### Flow d'installation

```
App Tester Home
     |
     v
Tap sur l'app (Inhouse/Store)
     |
     v
Consent (1ere fois uniquement)
     |
     v
Recherche: JIRA_KEY > BUILD_NUMBER > "release" > aucune
     |
     v
Scroll jusqu'a la version (si BUILD_VERSION)
     |
     v
Clic sur "Telecharger"
     |
     v
Attente du telechargement (max 2 min)
     |
     v
Clic sur "Installer"
     |
     v
Dialog systeme "Install" (si present)
     |
     v
Clic sur "Ouvrir"
     |
     v
Verification : l'app est lancee
```

### Details techniques

- **Recherche** : Utilise `mobile: pressKey` avec keycode 66 pour soumettre la recherche (Enter, sans relaxed-security)
- **Scroll** : Utilise `UiScrollable.scrollIntoView()` pour trouver une version specifique
- **Bouton Telecharger** : Les rows sont deja expandees dans les resultats de recherche, le bouton est identifie par sa position relative a la version
- **Deprecation fixes** : Utilise `mobile: scrollGesture`, `mobile: getCurrentPackage`, `mobile: pressKey` (APIs modernes)

---

## Historique

| Date | Action |
|------|--------|
| 2026-01-22 | Creation de l'automatisation Firebase App Distribution |
| 2026-01-22 | Fix: `noReset: true` pour garder les donnees App Tester |
| 2026-01-22 | Fix: `mobile: shell` pour soumettre la recherche (Enter) |
| 2026-01-22 | Fix: `UiScrollable.scrollIntoView()` pour scroll fiable |
| 2026-01-22 | Fix: Ne pas cliquer sur la version (rows deja expandees, clic = collapse) |
| 2026-01-26 | Ajout support recherche par cle Jira (`JIRA_KEY`) |
| 2026-01-26 | Refactoring: priorite de recherche JIRA_KEY > BUILD_NUMBER > BUILD_VERSION > latest |
| 2026-01-27 | Fix: dialog systeme "Installer" (FR) via `resourceId("android:id/button1")` |
| 2026-01-27 | Gestion 3 etats bouton: Ouvrir (installe) / Installer (telecharge) / Telecharger (rien) |
| 2026-01-27 | Fix: `mobile: pressKey` au lieu de `mobile: shell` (pas besoin de relaxed-security) |
