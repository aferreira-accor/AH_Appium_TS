Reformulation complète des objectifs
🎯 Objectif principal
Avoir un projet de tests automatisés 100% pilotable depuis le fichier .env pour tester 4 types d'apps mobiles sur BrowserStack :
Android Store
Android Inhouse
iOS Store
iOS Sandbox
📋 Fonctionnalités requises
1. Filtrage flexible par tags Cucumber
Depuis .env, tu définis *_BS_TAGS pour contrôler quels scénarios exécuter : Exemples d'usage :
TAGS=@smoke → Exécute tous les scénarios avec @smoke (même s'ils sont dans des fichiers features différents)
TAGS=@Internationalization → Exécute tous les scénarios du feature taggé @Internationalization
TAGS=@scenario_42 → Exécute uniquement ce scénario spécifique
TAGS=@login and @android → Combine plusieurs tags
2. Parallélisation contrôlée
*_BS_PARALLEL_SESSIONS=X dans .env définit le nombre de workers Exemple avec 50 scénarios filtrés : Config : ANDROID_STORE_BS_PARALLEL_SESSIONS=2
→ 2 workers actifs en parallèle
→ Chaque worker prend des scénarios un par un
→ Worker 1 : ~25 scénarios
→ Worker 2 : ~25 scénarios
Config : ANDROID_STORE_BS_PARALLEL_SESSIONS=8
→ 8 workers actifs en parallèle
→ Chaque worker prend ~6-7 scénarios
→ Exécution plus rapide (si limite BrowserStack le permet)
3. Sessions BrowserStack indépendantes
CRUCIAL : 1 scénario = 1 session BrowserStack unique Exemple avec 50 scénarios et 2 workers :
BrowserStack Dashboard :
- Build : "Adam - Android Store - 10.68.0"
- 50 sessions créées (pas 2 longues sessions !)
- Sessions actives max simultanément : 2 (limite = PARALLEL_SESSIONS)
- Threads BrowserStack utilisés : 2 sur 10 disponibles

Timeline :
T=0s  : Worker 1 → Scenario 1  → Session #1  🟢
        Worker 2 → Scenario 2  → Session #2  🟢
        
T=30s : Worker 1 termine → Scenario 3  → Session #3  🟢
        Worker 2 encore actif...
        
T=35s : Worker 2 termine → Scenario 4  → Session #4  🟢
        
... jusqu'à 50 sessions au total
4. Rotation automatique des devices
Device pool : 10 devices en cache BrowserStack Rotation round-robin :
Session 1  → Device #1 (Samsung Galaxy S24)
Session 2  → Device #2 (OnePlus 12R)
Session 3  → Device #3 (Google Pixel 8)
...
Session 10 → Device #10
Session 11 → Device #1 (recommence le cycle)
...
Session 50 → Device #10
5. Configuration locale optionnelle par scénario
Chaque scénario peut définir sa langue/locale/timezone via tags :
@locale:de_DE @language:de @timezone:Berlin
Scenario: Test German locale
  Given The app is launched
→ Ce scénario s'exécute sur un device configuré en allemand (Berlin timezone) Sans tags :
Scenario: Test default locale
  Given The app is launched
→ Utilise la config par défaut (fr_FR, fr, Paris)
6. Flexibilité et malléabilité
Tout se configure dans .env :
Changer le nombre de workers : PARALLEL_SESSIONS=3 au lieu de 2
Changer les tags : TAGS=@smoke au lieu de @Internationalization
Changer le device : DEVICE_NAME=Google Pixel 8
Activer sélection aléatoire : RANDOM_DEVICES=true
✅ Est-ce faisable avec WDIO + Appium + BrowserStack ?
OUI, 100% faisable !
Ce qui fonctionne nativement :
✅ Filtrage par tags → WDIO cucumberOpts.tags
✅ Workers parallèles → WDIO maxInstances
✅ BrowserStack sessions → Chaque worker = 1 connexion BrowserStack
✅ Tags de locale → Parsing des tags + configuration capabilities
Ce qui nécessite du code custom :
⚠️ 1 scénario = 1 session → Nécessite split des scénarios + limitation de workers
⚠️ Rotation de devices → Nécessite device pool + round-robin
🔧 Architecture à implémenter
Solution : Split des scénarios + Limitation de workers
Workflow :
1. Split scenarios
   50 scénarios → 50 fichiers .feature individuels

2. WDIO Config
   maxInstances = PARALLEL_SESSIONS (ex: 2)
   capabilities = 1 seule capability (pas 2!)
   specs = .tmp/parallel-specs/**/*.feature

3. Exécution
   WDIO crée 2 workers max
   Ces 2 workers se partagent les 50 fichiers
   Chaque worker prend un fichier, l'exécute, en prend un autre

4. Device rotation
   Avant chaque scénario : getNextDevice() du pool
   Créer session BrowserStack avec ce device
❓ Point que tu pourrais avoir mal compris
AUCUN ! Ta compréhension est parfaite. Tu veux :
N scénarios → N sessions BrowserStack indépendantes
_BS_PARALLEL_SESSIONS=X workers qui se partagent ces N sessions
Rotation des devices du pool
Contrôle total depuis .env