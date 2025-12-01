# Différences de Reset App entre Android et iOS

## Contexte

Lors des tests automatisés, il est crucial que l'app démarre dans un état "propre" (non connecté, pas de cache) entre chaque scénario. Android et iOS ont des comportements très différents à ce niveau.

---

## Android : Reset fonctionnel ✅

### Qui fait le reset des données ?

**C'est Appium qui fait le travail via `pm clear`, PAS l'app Android !**

Quand on utilise `noReset: false` + `browser.reloadSession()`, Appium exécute automatiquement :

```bash
pm clear com.accor.appli.hybrid
```

Cette commande Android OS **efface toutes les données de l'app** :
- SharedPreferences
- Bases de données SQLite
- Cache
- Tokens d'authentification

→ L'app redémarre comme si elle venait d'être installée

### Android Store vs Android Inhouse

| Build | Méthode de reset | Qui fait le travail |
|-------|------------------|---------------------|
| **Android Store** | `noReset: false` + `reloadSession()` | **Appium** via `pm clear` |
| **Android Inhouse** | `noReset: false` + `reloadSession()` + bouton | **Appium** via `pm clear` (le bouton ne clear pas les données) |

### Le bouton "Validate and Relaunch" - Clarification importante

**Le bouton NE clear PAS les données !** Il sert uniquement à :

1. **Sauvegarder les configurations de debug** (environnement, feature flags, mock server, etc.)
2. **Tuer le process et relancer l'app** avec une stack d'activités propre

#### Ce que fait `relaunchApp()` dans `AppConfigurationViewModel.kt`

```kotlin
fun relaunchApp() {
    viewModelScope.launch {
        // 1. Sauvegarde des configurations
        devToolsRepository.setEnvironment(...)
        devToolsRepository.setOverrideTestGroupEnabled(...)
        devToolsRepository.setMockServerEnable(...)
        // ... autres configurations

        // 2. Déclenche le redémarrage
        delay(200.milliseconds)
        Navigation.RelaunchApp(appPackageName = appPackageName)
    }
}
```

#### Ce que fait `RestartApplicationService.kt`

```kotlin
override fun onHandleIntent(intent: Intent?) {
    Process.killProcess(this)        // Tue le process appelant
    restartApplication(applicationPackageName)
    Process.killProcess(Process.myPid())
    exitProcess(Process.SIGNAL_KILL)
}

private fun restartApplication(applicationPackageName: String?) {
    intent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TASK or       // Nettoie la stack d'ACTIVITÉS (UI)
        Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    )
    applicationContext.startActivity(intent)
}
```

**Important** : `FLAG_ACTIVITY_CLEAR_TASK` nettoie la **stack d'activités (UI)**, PAS les **données persistantes** (SharedPreferences, DB, etc.)

### Résumé Android

```
┌─────────────────────────────────────────────────────────────────┐
│                     ANDROID RESET FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  browser.reloadSession(caps)                                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────┐                                        │
│  │  Appium exécute     │  ◄── C'est ICI que les données        │
│  │  pm clear <package> │      sont effacées !                   │
│  └─────────────────────┘                                        │
│         │                                                       │
│         ▼                                                       │
│  App redémarre FRESH (données effacées)                         │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │ [Android Inhouse uniquement]            │                    │
│  │ Écran de configuration s'affiche        │                    │
│  │         │                               │                    │
│  │         ▼                               │                    │
│  │ Click "Validate and Relaunch"           │                    │
│  │         │                               │                    │
│  │         ▼                               │                    │
│  │ Sauvegarde config + Restart UI          │  ◄── Ne clear     │
│  │ (RestartApplicationService)             │      PAS les      │
│  └─────────────────────────────────────────┘      données !    │
│         │                                                       │
│         ▼                                                       │
│  App prête pour le test                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## iOS : Reset non fonctionnel ❌

### Pourquoi ça ne marche pas

**iOS n'a pas d'équivalent à `pm clear` au niveau OS.**

Appium ne peut tout simplement pas effacer les données d'une app iOS sur un vrai device. C'est une limitation Apple, pas Appium.

| Commande | Android | iOS |
|----------|---------|-----|
| `pm clear <package>` | ✅ Existe et efface tout | ❌ N'existe pas |
| `noReset: false` | ✅ Déclenche `pm clear` | ❌ Ne fait rien |

### Ce qui a été essayé (sans succès)

| Tentative | Résultat |
|-----------|----------|
| `noReset: false` capability | ❌ Ne clear pas les données sur iOS réel |
| `fullReset: false` capability | ❌ Idem |
| `driver.terminateApp()` + `driver.activateApp()` | ❌ Restart l'app mais garde les données |
| `browser.reloadSession()` | ❌ Même comportement |
| `driver.deleteSession()` + `browser.newSession()` | ❌ Même comportement |
| `mobile: clearApp` (Appium) | ❌ Fonctionne uniquement sur **simulateurs**, pas vrais devices |

### Limitation Appium documentée

> "iOS does not have a clear local data API, so it requires uninstalling the app to fully clear data. There are no Appium commands to remove the data stored in the keystore or in the app itself on real devices."
>
> — [Appium GitHub Issue #19203](https://github.com/appium/appium/issues/19203)

---

## Tableau comparatif

| Fonctionnalité | Android | iOS |
|----------------|---------|-----|
| Commande OS pour clear données | ✅ `pm clear` | ❌ N'existe pas |
| `noReset: false` efficace | ✅ Fonctionne (via `pm clear`) | ❌ Ne fonctionne pas |
| `mobile: clearApp` | ✅ Fonctionne | ⚠️ Simulateurs uniquement |
| API pour tuer le process | ✅ `Process.killProcess()` | ❌ Interdit par Apple |

---

## Solution implémentée : `-debug_flushAuthToken` ✅

### Découverte

En analysant l'ancien projet `App_Automation`, nous avons découvert que **l'app iOS a déjà un mécanisme de reset intégré** !

Le flag `-debug_flushAuthToken` existe dans l'app iOS et appelle `userSessionLogoutRepository.logout()` au démarrage.

### Code iOS existant

**Fichier** : `AccorHotelsApp/AppCoreModule/AppCoreModule.swift` (ligne 686-689)

```swift
private func flushAuthTokenIfNeeded() async {
    guard UserDefaults.standard.bool(forKey: LocalStorageKeys.DebugSettings.debugFlushAuthToken) else { return }
    await userSessionLogoutRepository.logout()  // ← FAIT LE LOGOUT COMPLET !
}
```

Cette fonction est appelée dans `optionallyDisplayEnvironmentChoice()` (ligne 574).

### Implémentation côté Appium

**Fichier** : `config/capabilities/local-capability-builder.ts`

```typescript
iosSandbox: {
  bundleId: "fr.accor.push.sandbox",
  getArguments: () => [
    "-debug_flushAuthToken",
    "true",  // Clear auth tokens on app launch (enables fresh start between scenarios)
    "-debug_environment",
    getEnv("IOS_SANDBOX_LOCAL_TEST_ENVIRONMENT") || "rec2",
    "-debug_qa_enable_ids",
    "true",
  ],
},
iosStore: {
  bundleId: "fr.accor.push",
  getArguments: () => [
    "-debug_flushAuthToken",
    "true",  // Clear auth tokens on app launch (enables fresh start between scenarios)
    "-debug_qa_enable_ids",
    "true",
  ],
},
```

### Résultat

- ✅ L'app iOS se reset maintenant entre chaque scénario
- ✅ Aucune modification de l'app iOS nécessaire (le flag existait déjà)
- ✅ Même comportement que l'ancien projet `App_Automation`
- ✅ Rapide et fiable

---

## Autres options (non utilisées)

### Option 2 : Automatiser le logout via UI (Appium)

Avant chaque scénario iOS, naviguer dans l'app pour se déconnecter :

```typescript
// Dans session-management.local.hooks.ts
if (!isAndroid) {
  // Vérifier si connecté
  const isLoggedIn = await checkIfLoggedIn();
  if (isLoggedIn) {
    await navigateToSettings();
    await clickLogoutButton();
    await confirmLogout();
  }
}
```

**Avantages** :
- ✅ Aucune modification iOS requise
- ✅ Fonctionne immédiatement

**Inconvénients** :
- ❌ Plus lent (navigation UI)
- ❌ Fragile si l'UI change
- ❌ Plus complexe à maintenir

---

### Option 3 : `fullReset: true` (Lent)

Forcer la réinstallation de l'app à chaque scénario :

```typescript
// Dans local-capability-builder.ts pour iOS
"appium:fullReset": true,
"appium:noReset": false,
```

**Avantages** :
- ✅ Garantit un état propre
- ✅ Aucune modification iOS requise

**Inconvénients** :
- ❌ Très lent (désinstalle/réinstalle l'app)
- ❌ Peut nécessiter re-signature de l'app
- ❌ Augmente significativement le temps des tests

---

## Recommandation

**Option 1 (modification iOS)** est la meilleure solution à long terme :
- C'est cohérent avec l'existant (`-debug_environment`, `-debug_qa_enable_ids`)
- C'est rapide et fiable
- Les modifications requises sont minimes (~20 lignes de code Swift)

---

## Références

- [Appium GitHub Issue #19203 - iOS app data not clearing](https://github.com/appium/appium/issues/19203)
- [Appium XCUITest Driver - Troubleshooting](https://appium.github.io/appium-xcuitest-driver/latest/guides/troubleshooting/)
- [WebDriverIO - reloadSession](https://webdriver.io/docs/api/browser/reloadSession/)

---

## Historique

| Date | Action |
|------|--------|
| 2025-12-01 | Documentation créée après investigation du problème de reset iOS |
| 2025-12-01 | Clarification : c'est `pm clear` d'Appium qui reset Android, pas le bouton "Validate and Relaunch" |
| 2025-12-01 | Solution trouvée : `-debug_flushAuthToken` existait déjà dans l'app iOS (découvert via App_Automation) |
