# Lexicode

Jeu de mots-codes : chaque lettre porte un numéro, les mots trouvés grâce aux indices révèlent la phrase cachée. Français, anglais et espagnol, choix de la langue au premier lancement.

## Commandes

```
npm install
npm run dev          # jouer dans le navigateur
npm run verify       # génère et contrôle 2 550 grilles (doit afficher 0 problème)
npm run build        # version web pour Android
npm run build:single # un seul fichier HTML, pratique pour faire tester
```

## Ce qui est en place

- Moteur de grilles déterministe : même grille du jour pour tous les joueurs d'une langue.
- Vérificateur : numérotation cohérente, phrase reconstructible, chaque lettre trouvable, partie simulée gagnée.
- Modes : défi du jour, aventure par mondes de 12 niveaux (5 paliers de difficulté), entraînement.
- Rétention : série avec protections, coffre du jour, étoiles, album de phrases, indice de réflexion (type Elo), classements ville, pays, monde, amis, partage du résultat.
- Monétisation : jetons (lettre, mot, moteur de recherche), pub récompensée, écran Premium.

## Ce qu'il reste à brancher avant la publication

1. **Classements réels** : créer un projet Supabase, exécuter `backend/schema.sql`, puis remplacer `DemoRanking` dans `src/services/ranking.ts`. Les classements actuels sont simulés et signalés comme tels.
2. **Pubs** : plugin `@capacitor-community/admob`, à brancher dans `src/services/monetization.ts` (`ads.showRewarded`).
3. **Abonnement** : Google Play Billing via un plugin d'achats intégrés (RevenueCat est le plus simple), dans `billing.purchase`. Aujourd'hui Premium s'active localement.
4. **Contenu** : 120 mots et 33 à 35 phrases par langue. Il en faut plusieurs centaines pour des mois de défis sans répétition. Ajouter dans `src/content/<langue>.ts`, puis `npm run verify`.
5. **Icône, écran de démarrage, nom définitif** (vérifier que « Lexicode » est libre sur le Play Store).

## Construire l'APK / AAB

```
npm run android:sync
npx cap open android   # ouvre Android Studio, puis Build > Generate Signed Bundle
```

Compte développeur personnel récent : test fermé obligatoire avec au moins 12 testeurs pendant 14 jours avant la mise en production.

## Ajouter une langue

1. `src/content/xx.ts` sur le modèle de `fr.ts`.
2. Textes d'interface dans `src/i18n.ts` et disposition du clavier dans `KEYBOARDS`.
3. Ajouter la langue dans `src/content/index.ts` et le type `Lang`.
4. `npm run verify`.
