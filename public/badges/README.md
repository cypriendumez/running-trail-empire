# Badges App Store et Google Play

Ces deux images doivent être les fichiers OFFICIELS. Apple et Google interdisent tous
deux de redessiner leur badge, et fournissent l'artwork exact pour cet usage.

| Fichier attendu | Où le prendre |
|---|---|
| `app-store.svg` | Apple — « App Store Marketing Guidelines », section *Download on the App Store badge* : https://developer.apple.com/app-store/marketing/guidelines/ (choisir la langue française) |
| `google-play.png` | Google — *Google Play Badge Generator* : https://play.google.com/intl/fr/badges/ (choisir le français, format PNG) |

Tant que les fichiers ne sont pas là **et** que les deux variables d'environnement ne
sont pas renseignées sur Vercel, rien ne s'affiche — voir `src/lib/brand/stores.ts` :

```
NEXT_PUBLIC_APP_STORE_URL   = https://apps.apple.com/app/idXXXXXXXXX
NEXT_PUBLIC_PLAY_STORE_URL  = https://play.google.com/store/apps/details?id=…
```

⚠️ Ne pas remplacer ces images par une reconstitution « qui ressemble ». Les deux
chartes l'interdisent explicitement, et c'est le genre de détail qu'un acheteur regarde.
