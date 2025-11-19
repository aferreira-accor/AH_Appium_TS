# 🍪 Problème : Bannière des cookies OneTrust ne s'affiche pas dans les tests BrowserStack

## 📋 Contexte

**Problème observé :**
- ✅ La bannière des cookies OneTrust apparaît correctement dans **Appium Inspector** (BrowserStack)
- ❌ La bannière **ne s'affiche JAMAIS** dans les **tests automatisés** WebdriverIO sur BrowserStack
- 🔄 Même app URL utilisée : `bs://67175c2e51a43273030e599ba2bb203441d3e019`
- 📱 App concernée : **Android Store** (`com.accor.appli.hybrid`)

---

## 🔍 Observation clé : StartDispatcherActivity

### Comportement dans les tests automatisés :
```
📱 App started - Activity: com.accor.app.startdispatcher.view.StartDispatcherActivity
⏩ Redirection directe vers la page de login (sans afficher les cookies)
```

### Comportement dans Appium Inspector :
```
📱 App started - Activity: com.accor.app.startdispatcher.view.StartDispatcherActivity
✅ Affichage de la bannière OneTrust avec le bouton "Accept All"
🆔 Resource ID: com.accor.appli.hybrid:id/btn_accept_cookies
```

**Hypothèse principale :** `StartDispatcherActivity` applique une logique de routage différente entre Inspector et tests automatisés.

---

## ✅ Tentatives effectuées pour résoudre le problème

### 1. Alignement des capabilities avec Appium Inspector

**Capabilities Inspector (fonctionnel) :**
```json
{
  "platformName": "Android",
  "appium:platformVersion": "16.0",
  "appium:deviceName": "Google Pixel 10",
  "appium:automationName": "uiautomator2",
  "appium:app": "bs://67175c2e51a43273030e599ba2bb203441d3e019",
  "appium:appPackage": "com.accor.appli.hybrid",
  "appium:appActivity": "com.accor.app.splashscreen.view.SplashScreenActivity",
  "appium:ensureWebviewsHavePages": true,
  "appium:nativeWebScreenshot": true,
  "appium:connectHardwareKeyboard": true,
  "appium:disableSuppressAccessibilityService": true,
  "appium:skipServerInstallation": true,
  "appium:newCommandTimeout": 3600
}
```

**Modifications appliquées dans le projet :**
- ✅ `appActivity`: `SplashScreenActivity` (aligné)
- ✅ `ensureWebviewsHavePages: true`
- ✅ `nativeWebScreenshot: true`
- ✅ `connectHardwareKeyboard: true`
- ✅ `disableSuppressAccessibilityService: true`
- ✅ `skipServerInstallation: true`
- ✅ `autoGrantPermissions: true`
- ✅ `language: 'fr'`, `locale: 'FR'`
- ✅ `fullReset: true`, `noReset: false` (pour nettoyer l'état de l'app)
- ✅ BrowserStack Local **désactivé** pour Android Store
- ✅ Géolocalisation FR (`geoLocation: 'FR'`, `timezone: 'Europe/Paris'`)

**Résultat :** ❌ Aucun changement, bannière toujours absente

---

### 2. Tentatives de détection et d'interaction

#### A. Détection par Resource ID natif
```typescript
const resourceId = 'com.accor.appli.hybrid:id/btn_accept_cookies';
const cookieSelector = `android=new UiSelector().resourceId("${resourceId}")`;
await cookieButton.waitForDisplayed({ timeout: 30000 });
```
**Résultat :** ❌ Élément jamais trouvé

#### B. Attente de fin de StartDispatcherActivity
```typescript
await driver.waitUntil(async () => {
  const act = await driver.getCurrentActivity();
  return !/StartDispatcherActivity$/.test(act);
}, { timeout: 15000 });
```
**Résultat :** ❌ L'activité change mais la bannière n'apparaît pas

#### C. Tentative de forcer OneTrustActivity
```typescript
await driver.startActivity('com.accor.appli.hybrid', 
  'com.accor.app.onetrust.global.view.OneTrustActivity');
```
**Résultat :** ❌ `SecurityException: Permission Denial` - L'activité n'est **pas exportée**

#### D. Fallback WebView
```typescript
const contexts = await driver.getContexts();
const webviewCtx = contexts.find(ctx => String(ctx).includes('WEBVIEW'));
await driver.switchContext(webviewCtx);
const webAccept = await $('css selector:#onetrust-accept-btn-handler');
```
**Résultat :** ❌ Pas de contexte WebView disponible, ou élément non trouvé

---

### 3. Tentatives d'activité de démarrage

| AppActivity testée | Résultat |
|-------------------|----------|
| ❌ Aucune (LAUNCHER par défaut) | Démarre sur `StartDispatcherActivity` → Login |
| ❌ `OneTrustActivity` | `BROWSERSTACK_INVALID_APP_ACTIVITY` (non launchable) |
| ❌ `SplashScreenActivity` | Démarre sur `StartDispatcherActivity` → Login |

---

## 🤔 Questions pour les développeurs Android

### 1. Logique de StartDispatcherActivity
- **Est-ce que `StartDispatcherActivity` fait des appels réseau/remote config avant de router ?**
  - Si oui, y a-t-il un timeout qui fait que dans les tests automatisés, la réponse arrive trop tard ?
  
- **Y a-t-il une logique qui skip les cookies selon certaines conditions ?**
  - Déjà acceptés (même avec `fullReset: true`) ?
  - Feature flag / A/B test ?
  - Géolocalisation / langue ?
  - User-agent / device fingerprint ?

### 2. OneTrustActivity
- **L'activité OneTrust est-elle conditionnelle ?**
  - First launch only ?
  - Feature flag activable/désactivable ?
  
- **Pourquoi `OneTrustActivity` n'est-elle pas `exported` ?**
  - Est-ce intentionnel pour des raisons de sécurité ?
  
- **Peut-on forcer l'affichage des cookies via :**
  - Un intent extra au démarrage ?
  - Un debug flag (comme `-debug_qa_enable_ids` pour iOS) ?
  - Une configuration BuildConfig ?

### 3. Différences de comportement
- **Pourquoi Appium Inspector affiche les cookies mais pas les tests automatisés ?**
  - Y a-t-il une détection de "test/automation mode" ?
  - Les capabilities supplémentaires influent-elles le routage ?
  - Un delay/timing différent entre lancement manuel vs automatisé ?

### 4. Logs et debugging

- **Y a-t-il des logs dans `StartDispatcherActivity` qui indiquent pourquoi OneTrust est skippé ?**
  - Peut-on activer un mode verbose/debug pour voir la décision de routage ?
  - Quelles sont les conditions exactes qui déclenchent l'affichage d'OneTrust ?

- **Est-ce que l'app utilise Firebase Remote Config / Feature Flags ?**
  - Si oui, quelle est la configuration pour "show_onetrust_banner" ou équivalent ?
  - Peut-on forcer cette valeur en mode test via un paramètre de lancement ?
  - Y a-t-il des valeurs par défaut différentes selon l'environnement (dev/staging/prod) ?

### 5. Solution de contournement

- **Existe-t-il un moyen de :**
  - Forcer l'affichage des cookies en mode test ?
  - Bypasser `StartDispatcherActivity` pour aller directement à `OneTrustActivity` ?
  - Accepter les cookies programmatiquement (SharedPreferences, etc.) ?
  - Créer une variante de build spéciale pour les tests automatisés qui force l'affichage d'OneTrust ?

---

## 📸 Preuves visuelles

### Screenshots générés lors des tests :
1. `cookies_debug_*.png` - État de l'app au moment où on cherche les cookies
2. `no_cookies_*.png` - État après 30s d'attente (toujours pas de bannière)
3. `failed_step_*.png` - État final (page de login sans cookies)

**Observation :** Les 3 screenshots montrent la **page de login**, jamais la bannière OneTrust.

### Logs typiques :
```
[0-0] 📱 App started - Package: com.accor.appli.hybrid, Activity: com.accor.app.startdispatcher.view.StartDispatcherActivity
[0-0] 🍪 Looking for cookies banner with package: com.accor.appli.hybrid
[0-0] 🔍 Cookie selector: android=new UiSelector().resourceId("com.accor.appli.hybrid:id/btn_accept_cookies")
[0-0] 📍 Current activity: com.accor.app.startdispatcher.view.StartDispatcherActivity
[0-0] ⏳ Waiting for cookies banner to appear...
[0-0] ❌ Cookies banner not found after 30s - continuing with test
[0-0] No cookies even after dispatcher finished
```

---

## 🎯 Solution temporaire actuelle

En attendant une solution définitive, le test **continue sans accepter les cookies** lorsqu'ils ne sont pas détectés après 30 secondes.

**Impact :**
- ❓ Incertitude sur l'état de l'app pour les tests suivants
- ❓ Possible différence de comportement selon que les cookies soient acceptés ou non

---

## 📝 Notes techniques

### Fichiers modifiés :
- `config/capabilities/capability-builder.ts` - Alignement capabilities Store
- `config/platforms/android-store.browserstack.conf.ts` - Désactivation BS Local
- `tests/page-objects/navigation/AppStartupPage.ts` - Logique de détection/fallback
- `tests/page-objects/authentication/LoginPage.ts` - Sélecteur login

### Code de détection actuel :
```typescript
// AppStartupPage.acceptCookies()
const appPackage = (caps['appium:appPackage'] || caps.appPackage) as string;
const resourceId = appPackage === 'com.accor.appli.hybrid'
  ? 'com.accor.appli.hybrid:id/btn_accept_cookies'  // Store
  : 'com.accor.appli.hybrid.inhouse:id/btn_accept_cookies';  // Inhouse
```

---

## 🚀 Prochaines étapes

1. **Meeting avec les développeurs Android** pour comprendre la logique de `StartDispatcherActivity`
2. Identifier pourquoi le comportement diffère entre Inspector et tests automatisés
3. Implémenter une solution robuste (feature flag, intent extra, ou bypass)

---

**Date de création :** 13 octobre 2025  
**Équipe concernée :** QA Automation + Développement Android  
**Priorité :** 🔴 Haute (bloque l'automatisation Android Store)

