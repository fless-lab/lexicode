# Lexicode

Jeu de mots-codes : chaque lettre porte un numéro, les mots trouvés grâce aux indices révèlent la phrase cachée. Français, anglais et espagnol, choix de la langue au premier lancement.

## Commandes

```
npm install
npm run dev          # jouer dans le navigateur
npm run verify       # génère et contrôle 3 270 grilles et les règles d'échec (doit afficher 0 problème)
npm run build        # version web pour Android
npm run build:single # un seul fichier HTML, pratique pour faire tester
```

## Version web

Chaque push sur `master` vérifie les grilles, compile et publie le jeu sur GitHub Pages (`.github/workflows/pages.yml`). Le jeu s'installe comme une application (manifeste, icône) et fonctionne hors ligne après le premier chargement.

## Direction artistique

Salle de chiffrement : sarcelle profonde, laiton, tuiles ivoire façon touches de machine. Polices embarquées Zilla Slab (tuiles, titres, chiffres) et Figtree (interface). Icônes dessinées en SVG (`src/ui/Icon.tsx`), aucun emoji. Sons entièrement synthétisés (`src/sound.ts`) : clic de touche, notes de marimba qui montent avec le combo, cloches de victoire, réverbération générée.

## Ce qui est en place

- Moteur de grilles déterministe : même grille du jour pour tous les joueurs d'une langue.
- Vérificateur : numérotation cohérente, phrase reconstructible, chaque lettre trouvable, partie simulée gagnée.
- Défi du jour, aventure en mondes de 12 niveaux sans fin (5 paliers de difficulté, un boss tous les 6 niveaux avec chrono et 3 vies), entraînement.
- Arène, avec échec réel :
  - Contre-la-montre : chrono selon la difficulté, bonus de score pour le temps restant.
  - Survie : 3 vies.
  - Mort subite : une erreur et c'est perdu.
  - Marathon : chrono partagé, chaque grille ajoute du temps, chaque erreur en retire 5 s, la difficulté monte.
  - Hardcore : Expert, sans indice, une vie, 5 minutes.
  - Zen : sans chrono, indices à moitié prix.
  Les modes se débloquent avec le niveau du joueur.
- Progression : XP et niveaux de joueur avec titres, ligues hebdomadaires sur 7 divisions (montée et descente), 36 succès récompensés, records par mode.
- Profondeur : combos (score et notes qui montent), mode cryptogramme pur (sans mots indices), bonus utilisables en partie (gel du chrono, bouclier, révélation, double XP).
- Quêtes du jour (3 par jour, coffre bonus), saison de 28 jours à 30 paliers avec piste gratuite et piste Premium, 7 habillages de tuiles à débloquer, 45 succès.
- Rétention : série avec protections, coffre du jour, étoiles, album de phrases par catégorie, indice de réflexion (type Elo), classements par mode (ville, pays, monde, amis), partage du résultat, tutoriel au premier lancement, sons et vibrations.
- Monétisation : jetons (lettre, mot, moteur de recherche), pub récompensée, écran Premium.

## Ce qu'il reste à brancher avant la publication

1. **Classements réels** : créer un projet Supabase, exécuter `backend/schema.sql`, puis remplacer `DemoRanking` dans `src/services/ranking.ts`. Les classements actuels sont simulés et signalés comme tels.
2. **Pubs** : plugin `@capacitor-community/admob`, à brancher dans `src/services/monetization.ts` (`ads.showRewarded`).
3. **Abonnement** : Google Play Billing via un plugin d'achats intégrés (RevenueCat est le plus simple), dans `billing.purchase`. Aujourd'hui Premium s'active localement.
4. **Contenu** : environ 180 mots et 113 phrases par langue (proverbes, expressions, faits). Il en faut plusieurs centaines pour des mois de défis sans répétition. Ajouter dans `src/content/<langue>.ts`, puis `npm run verify`.
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
