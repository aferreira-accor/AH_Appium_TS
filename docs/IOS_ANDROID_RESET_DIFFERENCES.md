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

## Solution implémentée : `-debug_flushAuthToken` ⚠️ (Sandbox uniquement)

### Découverte

En analysant l'ancien projet `App_Automation`, nous avons découvert que **l'app iOS a déjà un mécanisme de reset intégré** !

Le flag `-debug_flushAuthToken` existe dans l'app iOS et appelle `userSessionLogoutRepository.logout()` au démarrage.

### Code iOS existant

**Fichier** : `AccorHotelsApp/AppCoreModule/AppCoreModule.swift` (ligne 687-689)

```swift
private func flushAuthTokenIfNeeded() async {
    guard UserDefaults.standard.bool(forKey: LocalStorageKeys.DebugSettings.debugFlushAuthToken) else { return }
    await userSessionLogoutRepository.logout()  // ← Fait SEULEMENT le logout
}
```

### ⚠️ Ce que `-debug_flushAuthToken` fait vs ne fait PAS

| Action | `-debug_flushAuthToken` | `LogoutUseCase.performLogout()` |
|--------|-------------------------|--------------------------------|
| `logoutRepository.logout()` | ✅ | ✅ |
| `currentDeeplinkRepository.clear()` | ❌ | ✅ |
| `graphQLAdapterClear.clear()` | ❌ | ✅ |
| `tracker.resetBookingLifeCycle()` | ❌ | ✅ |
| `userTracker.resetUser()` | ❌ | ✅ |
| `momentOfLifeUseCase.reset()` | ❌ | ✅ |
| `localStorage.removeSessionValues()` | ❌ | ✅ |
| `databaseManager.deleteAllDatas()` | ❌ | ✅ |
| **OneTrust consent** | ❌ | ❌ |
| **UserDefaults complet** | ❌ | ❌ |

**Conséquences :**
- ✅ L'utilisateur est déconnecté
- ❌ La bannière OneTrust ne réapparaît PAS
- ❌ Les préférences utilisateur persistent (firstLaunch, welcomeDrink, etc.)
- ❌ Le cache GraphQL persiste

### ⚠️ LIMITATION MAJEURE : iOS Store ne supporte AUCUN process argument !

**Le build Store (`store.xcconfig`) n'a aucun flag de debug :**

```
# Sandbox (a tous les flags debug)
SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG DEVELOPMENT DEBUG_QA_ID_ENABLE DEBUG_QA_PERSIST_SETTINGS DEBUGFIREBASETRACKINGCONSOLE DEBUGENVCHOOSER ...

# Store (AUCUN flag debug)
SWIFT_ACTIVE_COMPILATION_CONDITIONS = PRODUCTION INSTABUGLIVE RELEASE
```

**Conséquence : TOUS les process arguments sont ignorés sur iOS Store :**

| Argument | Condition requise | Store ? |
|----------|-------------------|---------|
| `-debug_qa_enable_ids` | `#if DEBUG_QA_ID_ENABLE` | ❌ Flag absent |
| `-debug_environment` | `#if DEBUG_QA_PERSIST_SETTINGS` | ❌ Flag absent |
| `-debug_flushAuthToken` | `#if !RELEASE` | ❌ `RELEASE` défini |
| `-debug_firebase_preference` | `#if DEBUGFIREBASETRACKINGCONSOLE` | ❌ Flag absent |

**Code source** (`AppDelegate.swift:42-60`) :

```swift
#if DEBUG_QA_ID_ENABLE  // ← Ce flag N'EXISTE PAS en Store !
let debugQaEnableIds = UserDefaults.standard.bool(forKey: LocalStorageKeys.DebugSettings.debugQaEnableIds)
AccessibilityIdWithContextConfiguration.isEnable = debugQaEnableIds
#endif

#if DEBUG_QA_PERSIST_SETTINGS  // ← Ce flag N'EXISTE PAS en Store !
let envValue = UserDefaults.standard.string(forKey: LocalStorageKeys.DebugSettings.debugEnvironment)
UserDefaults.standard.set(envValue, forKey: LocalStorageKeys.DebugSettings.debugEnvironment)
#endif
```

**Triple protection dans le code iOS :**
1. **Flags de compilation absents** : `DEBUG_QA_ID_ENABLE`, `DEBUG_QA_PERSIST_SETTINGS`, etc. n'existent pas en Store
2. **Condition `#if !RELEASE`** : Exclut `flushAuthTokenIfNeeded()`
3. **Bundle exclu** : Le `DebugSettings.bundle` est supprimé des builds Store

### Tableau récapitulatif par build

| Build | Process Arguments | Reset | Accessibility IDs | Commentaire |
|-------|-------------------|-------|-------------------|-------------|
| **iOS Sandbox (local)** | ✅ Fonctionnent | ⚠️ Logout only | ✅ Activables | Build avec flags debug |
| **iOS Sandbox (BrowserStack)** | ⚠️ Non configuré | ❌ Non | ⚠️ Non configuré | À implémenter |
| **iOS Store (local)** | ❌ **TOUS ignorés** | ❌ Non | ❌ Impossibles | **AUCUN flag debug en Store** |
| **iOS Store (BrowserStack)** | ❌ **TOUS ignorés** | ❌ Non | ❌ Impossibles | **AUCUN flag debug en Store** |

### Implémentation côté Appium

**Fichier** : `config/capabilities/local-capability-builder.ts:149-172`

```typescript
iosSandbox: {
  bundleId: "fr.accor.push.sandbox",
  getArguments: () => [
    "-debug_flushAuthToken", "true",     // ✅ Logout au démarrage
    "-debug_environment", "rec2",         // ✅ Environnement de test
    "-debug_qa_enable_ids", "true",       // ✅ Active accessibility IDs
  ],
},
iosStore: {
  bundleId: "fr.accor.push",
  // ⚠️ iOS Store n'a AUCUN flag de debug compilé !
  // Tous ces arguments seraient ignorés :
  // - debug_qa_enable_ids → requiert DEBUG_QA_ID_ENABLE
  // - debug_environment → requiert DEBUG_QA_PERSIST_SETTINGS
  // - debug_flushAuthToken → requiert !RELEASE
  getArguments: () => [],  // Aucun argument utile
},
```

### Résultat

- ⚠️ **iOS Sandbox** : L'utilisateur est déconnecté mais l'app n'est PAS dans un état "first launch"
- ❌ **iOS Store** : Pas de reset possible (limitation du build RELEASE)
- ⚠️ OneTrust, préférences, cache persistent entre les scénarios
- 📋 **ACTION REQUISE** : Demander à l'équipe iOS d'implémenter `-debug_fullReset` (voir spec ci-dessous)

---

## Autres options (non utilisées)

### Option 2 : Automatiser le logout via UI (Appium)

Avant chaque scénario iOS, naviguer dans l'app pour se déconnecter :

```typescript
// Dans tests/step-definitions/hooks/session-management.local.hooks.ts
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
// Dans config/capabilities/local-capability-builder.ts pour iOS
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

## 📋 SPEC : Nouveau flag `-debug_fullReset` pour iOS

### Contexte

Le flag existant `-debug_flushAuthToken` fait uniquement un logout, mais pour les tests automatisés nous avons besoin d'un reset complet équivalent à `pm clear` sur Android.

### Demande

Créer un nouveau flag `-debug_fullReset` qui remet l'app dans un état "first launch".

### Implémentation suggérée

**Fichier** : `AccorHotelsApp/AppCoreModule/AppCoreModule.swift`

```swift
// Ajouter dans LocalStorageKeys.DebugSettings
public static let debugFullReset = "debug_fullReset"

// Nouvelle fonction à côté de flushAuthTokenIfNeeded()
private func fullResetIfNeeded() async {
    guard UserDefaults.standard.bool(forKey: LocalStorageKeys.DebugSettings.debugFullReset) else { return }

    // 1. Logout (auth tokens) - existant
    await userSessionLogoutRepository.logout()

    // 2. OneTrust consent - NOUVEAU
    OneTrustWrapper.shared.clearAllData()

    // 3. Clear ALL UserDefaults - NOUVEAU
    if let bundleID = Bundle.main.bundleIdentifier {
        UserDefaults.standard.removePersistentDomain(forName: bundleID)
        UserDefaults.standard.synchronize()
    }

    // 4. Clear database (SwiftData) - NOUVEAU
    try? await DatabaseManager.shared.deleteAllDatas()

    // 5. Clear URL cache - NOUVEAU
    URLCache.shared.removeAllCachedResponses()

    // 6. Clear GraphQL cache - NOUVEAU
    // graphQLAdapterClear.clear() si accessible

    // 7. Reset le flag pour éviter boucle infinie au redémarrage
    UserDefaults.standard.set(false, forKey: LocalStorageKeys.DebugSettings.debugFullReset)
}
```

**Appel dans optionallyDisplayEnvironmentChoice()** :

```swift
#if !RELEASE
Task {
    await fullResetIfNeeded()    // Nouveau - full reset
    await flushAuthTokenIfNeeded()  // Existant - logout only
}
#endif
```

### Ce qui sera nettoyé

| Donnée | Avant (flushAuthToken) | Après (fullReset) |
|--------|------------------------|-------------------|
| Auth tokens | ✅ | ✅ |
| OneTrust consent | ❌ | ✅ |
| UserDefaults (40+ clés) | ❌ | ✅ |
| Base de données SwiftData | ❌ | ✅ |
| Cache URL/images | ❌ | ✅ |
| Cache GraphQL | ❌ | ✅ |
| Deeplinks | ❌ | ✅ |
| Trackers | ❌ | ✅ |

### Configuration DebugSettings.bundle

Ajouter dans `FeatureFlip.plist` :

```xml
<dict>
    <key>Type</key>
    <string>PSToggleSwitchSpecifier</string>
    <key>Title</key>
    <string>Full Reset (first launch state)?</string>
    <key>Key</key>
    <string>debug_fullReset</string>
    <key>DefaultValue</key>
    <false/>
</dict>
```

### Utilisation côté Appium

```typescript
iosSandbox: {
  getArguments: () => [
    "-debug_fullReset", "true",  // Full reset (remplace flushAuthToken)
    "-debug_environment", "rec2",
    "-debug_qa_enable_ids", "true",
  ],
},
```

### Priorité

**Haute** - Bloque les tests automatisés qui nécessitent un état "first launch" (OneTrust, onboarding, etc.)

---

## Recommandations

### Pour iOS Sandbox (local)
⚠️ **Actuellement : `-debug_flushAuthToken`** (logout uniquement)
- Déconnecte l'utilisateur
- OneTrust et préférences persistent

✅ **Idéal : `-debug_fullReset`** (à implémenter par l'équipe iOS)
- Remet l'app en état "first launch"
- Voir spec ci-dessus

### Pour iOS Store (local)
⚠️ **Pas de solution idéale** - Choisir selon le contexte :

| Option | Vitesse | Fiabilité | Recommandé pour |
|--------|---------|-----------|-----------------|
| `fullReset: true` | Lent (~30s/scénario) | ✅ 100% | Tests critiques nécessitant un état vraiment propre |
| Logout via UI | Moyen (~5s) | ⚠️ Fragile | Tests fréquents si l'UI est stable |
| Ne rien faire | Rapide | ❌ Données persistantes | Tests qui n'ont pas besoin d'état propre |

### Pour iOS BrowserStack
- **Sandbox** : Ajouter `-debug_flushAuthToken` dans les arguments si besoin
- **Store** : Utiliser `fullReset: true` ou accepter la limitation

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
| 2025-12-02 | Mise à jour des chemins de fichiers pour correspondre à l'architecture actuelle |
| 2025-12-02 | **CORRECTION MAJEURE** : `-debug_flushAuthToken` ne fonctionne PAS sur iOS Store (build RELEASE). Documenté la limitation avec analyse du code Swift (`#if RELEASE`). |
| 2025-12-02 | **DÉCOUVERTE** : `-debug_flushAuthToken` fait seulement logout, pas de reset OneTrust/préférences/cache. Ajout spec pour nouveau flag `-debug_fullReset`. |
| 2025-12-02 | **DÉCOUVERTE MAJEURE** : iOS Store ne supporte AUCUN process argument ! Tous les flags debug (`DEBUG_QA_ID_ENABLE`, `DEBUG_QA_PERSIST_SETTINGS`, etc.) sont absents du build Store. Retiré tous les arguments inutiles de `iosStore`. |
