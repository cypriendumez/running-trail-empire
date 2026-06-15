# 📱 App native (Capacitor) — enregistrement GPS écran éteint, façon Strava

Objectif : transformer l'app web en **vraie app iOS/Android** capable d'enregistrer une course
**en arrière-plan, écran éteint, téléphone dans la poche** (impossible en pur web).

Tout le code web est réutilisé. On ajoute juste une **coquille native** + un **plugin GPS arrière-plan**.

---

## ✅ Déjà préparé (par l'IA, sans rien casser)
- `capacitor.config.ts` — config de base (⚠️ mettre ton URL de prod dans `server.url`).
- `src/lib/native/geo.ts` — couche GPS unifiée : web (navigateur) **ou** natif (arrière-plan).
  Aucun package natif importé → le build web reste intact.

---

## 🔧 Étapes quand tu seras prêt à publier (sur ton Mac)

### 1. Installer Capacitor + le plugin GPS arrière-plan (gratuit, open-source)
```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor-community/background-geolocation
npx cap init "Running & Trail Empire" com.runningtrailempire.app
npx cap add ios
npx cap add android
npx cap sync
```

### 2. Brancher le GPS natif dans Ghost Runner (1 changement)
Dans `src/components/ghost-runner/GhostRunner.tsx`, remplacer l'appel direct
`navigator.geolocation.watchPosition(...)` par la couche unifiée déjà prête :
```ts
import { startRunTracking } from "@/lib/native/geo";
// au démarrage :
stopTrackingRef.current = await startRunTracking(
  (p) => onGpsPosition({ coords: { latitude: p.lat, longitude: p.lng, accuracy: p.accuracy, speed: p.speed } as GeolocationCoordinates, timestamp: p.time } as GeolocationPosition),
  () => { /* pas de fix → mode démo */ },
);
// à l'arrêt : stopTrackingRef.current?.();
```
→ En web : identique à aujourd'hui. En app native : **arrière-plan, écran éteint.**

### 3. Permissions iOS (`ios/App/App/Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Pour enregistrer ta course (distance, allure, parcours).</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Pour continuer à enregistrer ta course même écran éteint ou téléphone dans la poche.</string>
<key>UIBackgroundModes</key>
<array><string>location</string></array>
```
Android (`android/app/src/main/AndroidManifest.xml`) : `ACCESS_FINE_LOCATION` + `ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE`.

### 4. Compte Apple Developer
- S'inscrire : https://developer.apple.com/programs/ → **99 $/an** (récurrent).
- Android : Google Play **25 $ une fois**, OU **gratuit** en distribuant l'APK directement.

### 5. Politique de confidentialité (obligatoire pour la géoloc)
Une page publique expliquant : quelles données (localisation), pourquoi (enregistrer la course),
où c'est stocké (Supabase), comment supprimer. (Je peux te la rédiger.)

### 6. Compiler & publier
```bash
npm run build && npx cap sync
npx cap open ios      # ouvre Xcode → signer avec ton compte Apple → Archive → upload App Store Connect
npx cap open android  # ouvre Android Studio → générer l'APK/AAB signé
```
Tester l'arrière-plan **sur un vrai iPhone** (pas le simulateur).

---

## ⚖️ Risque de refus Apple : faible, mais à faire proprement
La localisation en arrière-plan est **scrutée**, mais c'est une **catégorie standard approuvée**
(Strava, Nike Run, Decathlon…). Les 2 vrais motifs de refus et comment les éviter :
1. **« Juste un site web » (Guideline 4.2)** → évité car l'app utilise une **vraie fonction native**
   (GPS arrière-plan) + notifications. Ne PAS soumettre une simple coquille sans fonction native.
2. **Permission floue / pas de politique de confidentialité** → évité avec les textes ci-dessus + la page de confidentialité.
→ Confiance **élevée** si fait dans les règles. Le dernier mot reste à Apple (review ~1-3 jours).
