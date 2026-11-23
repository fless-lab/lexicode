# Lexicode

Jeu de mots-codes : chaque lettre porte un numéro, les mots trouvés grâce aux indices révèlent la phrase cachée. Français, anglais et espagnol, choix de la langue au premier lancement.

## Commandes

```
npm install
npm run dev          # jouer dans le navigateur
npm run verify       # génère et contrôle 3 909 grilles (aventure, expédition, tous les modes) (doit afficher 0 problème)
npm run build        # version web pour Android
npm run build:single # un seul fichier HTML, pratique pour faire tester
```

## Version web

Chaque push sur `master` vérifie les grilles, compile et publie le jeu sur GitHub Pages (`.github/workflows/pages.yml`). Le jeu s'installe comme une application (manifeste, icône) et fonctionne hors ligne après le premier chargement.

## Direction artistique

Le bureau du chiffre, la nuit, sous la lampe : encre indigo, lumière ambrée, tuiles de papier, clavier en touches de machine à écrire (anneau sombre, pastille ivoire). Chaque geste a un retour : la tuile s'écrase puis rebondit, le mot trouvé se retourne en vert, la phrase s'allume lettre par lettre, le sceau tombe comme un tampon et les lettres de la phrase pleuvent sur l'écran de victoire.

- Décors illustrés en SVG (`src/ui/scenes.tsx`) : toits la nuit avec la fenêtre d'Ada, et une scène par chapitre (atelier, bibliothèque, train de nuit, archives en feu, observatoire, salle des machines, tour, cabinet noir), plus l'expédition. Ils prennent les couleurs du thème du chapitre et vivent doucement (étoiles, flamme, engrenages, train qui passe). Grain de papier et vignettage pour éviter l'effet vectoriel lisse.
- Loupi, le raton laveur d'Ada (`src/ui/mascot.tsx`) : personnage original, la mascotte et l'icône de l'application. Il est dessiné en pièces séparées (queue, corps, tête, oreilles, yeux, bras, loupe) et a cinq humeurs (calme, réflexion avec l'œil grossi par la loupe, joie, tristesse, surprise). Il cligne des yeux, respire, remue la queue. On le retrouve sur les toits de l'accueil (il saute quand on le touche), comme pion sur le chemin de l'aventure, à côté de la grille où il réagit aux combos et aux erreurs, dans le tutoriel, à l'ouverture des chapitres et sur les écrans de fin. Un illustrateur pourra redessiner chaque pièce plus tard sans toucher au code. L'icône se régénère avec `npx tsx .qa/icon.tsx`.
- Icônes : [Phosphor](https://phosphoricons.com) (licence MIT), style duotone partout pour une famille homogène.
- Polices embarquées Zilla Slab (tuiles, titres, chiffres) et Figtree (interface). Aucun emoji.
- Sons entièrement synthétisés (`src/sound.ts`) : clic de touche, notes de marimba qui montent avec le combo, coup de tampon, une note par étoile, cloches de victoire, réverbération générée.

## Aventure : Le Cabinet noir

Un récit en 8 chapitres de 12 niveaux (`src/chapters.ts`, textes dans `src/content/story.ts`). Ada, une vieille cryptographe, a disparu ; le dernier niveau de chaque chapitre est son message chiffré, qui mène au lieu suivant. Chaque chapitre a son décor (palette) et ajoute une mécanique :

1. L'Atelier : les bases.
2. La Bibliothèque : indices subtils, moins de lettres données.
3. Le Train de nuit : chrono.
4. Les Archives brûlées : taches d'encre (numéros cachés).
5. L'Observatoire : indices enchaînés et malins.
6. La Salle des machines : trois vies, encre, indices délavés.
7. La Tour du chiffre : cryptogrammes purs.
8. Le Cabinet noir : tout à la fois, avec la brume sur la phrase.

Après le chapitre 8, un nouveau cycle recommence, plus dur (difficulté, encre, indices délavés, brume).

## Expédition (procédurale)

Descente infinie (`src/expedition.ts`) : chaque étage est généré à partir de la graine et de la profondeur (nom du lieu, palette, altérations qui se cumulent). Trois cœurs pour toute la descente, une relique à choisir entre les étages, un sanctuaire tous les cinq étages. Expédition du jour identique pour tous, une tentative par jour.

## Indices à trois niveaux

Environ 380 mots par langue (plus de 5 000 indices) : un indice facile, un moyen et deux ou trois malins qui tournent (`src/content/lex-*.ts`, format `MOT|facile|moyen|malin`). La difficulté choisit le niveau ; le vérificateur refuse les doublons, les réponses présentes dans l'indice et les tirets cadratins.

## Circuit de validation des indices

Aucun indice n'arrive au joueur sans avoir passé ce circuit. `src/content/review/<langue>.json` contient la décision pour chaque indice (`ok`, `fixed` avec son texte corrigé, ou `rejected`) et son niveau recalibré. `applyReview` (dans `src/content/review.ts`) n'utilise que les indices validés, et `npm run verify` échoue si un indice publié n'y figure pas.

1. Résolution à l'aveugle : un agent indépendant reçoit l'indice et le nombre de lettres, sans la réponse, et propose un mot avec sa confiance.
2. Jugement : un second agent, qui connaît la réponse, vérifie le fait, l'expression, la grammaire et le niveau réel. Il propose une correction quand l'indice est faible ou faux.
3. Fusion (`scripts/review-merge.ts`) : un indice faux est corrigé ou retiré ; un indice jugé juste mais que l'aveugle lit avec assurance comme un autre mot est retiré comme ambigu ; la réponse ne doit jamais apparaître dans l'indice, même cachée dans un mot plus long.
4. Toute correction repasse un test à l'aveugle (indices mélangés et anonymisés) puis un second juge indépendant, car une correction peut elle-même introduire une erreur.
5. Le niveau est recalibré d'après la mesure : un indice « malin » résolu sans hésiter descend en moyen, un « facile » que personne ne trouve monte.

Première passe (novembre 2026) sur 5 072 indices : 4 311 validés tels quels, 713 corrigés puis revalidés, 48 retirés, 765 changés de niveau. Prochaines étapes : signalement « indice douteux » et taux de réussite réel par indice chez les joueurs, puis relecture ciblée par des locuteurs natifs.

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
