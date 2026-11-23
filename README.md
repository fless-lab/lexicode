# Lexicode

Jeu de mots-codes : chaque lettre porte un numéro, les mots trouvés grâce aux indices révèlent la phrase cachée. Français, anglais et espagnol, choix de la langue au premier lancement.

## Commandes

```
npm install
npm run dev          # jouer dans le navigateur
npm run verify       # génère et contrôle 6 453 grilles, puis rejoue 90 parties (doit afficher 0 problème)
npm run build        # version web pour Android
npm run build:single # un seul fichier HTML, pratique pour faire tester
```

## Version web

Chaque push sur `master` vérifie les grilles, compile et publie le jeu sur GitHub Pages (`.github/workflows/pages.yml`). Le jeu s'installe comme une application (manifeste, icône) et fonctionne hors ligne après le premier chargement.

## Direction artistique

Nuit arcade : l'univers du bureau du chiffre la nuit, habillé avec la générosité de Royal Match et la clarté de Duolingo. Aplats saturés sans halo ni flou, contours foncés et reliefs pleins sur chaque élément, gros boutons brillants (vert pour jouer, or pour les récompenses), tuiles blanches cernées, clavier de jeu propre au jeu (il remplace le clavier du téléphone, disposition selon la langue), grandes tuiles colorées pour les modes, et un thème par chapitre réservé à l'aventure pour que l'application garde une identité stable. Chaque geste a un retour : la tuile s'écrase puis rebondit, le mot trouvé se retourne en vert, la phrase s'allume lettre par lettre, et les lettres de la phrase pleuvent sur l'écran de victoire.

- Décors illustrés en SVG (`src/ui/scenes.tsx`) : toits la nuit avec la fenêtre d'Ada, et une scène par chapitre (atelier, bibliothèque, train de nuit, archives en feu, observatoire, salle des machines, tour, cabinet noir), plus l'expédition. Ils prennent les couleurs du thème du chapitre et vivent doucement (étoiles, flamme, engrenages, train qui passe). Grain de papier et vignettage pour éviter l'effet vectoriel lisse.
- Loupi, le raton laveur d'Ada (`src/ui/mascot.tsx`) : personnage original, la mascotte et l'icône de l'application. Il est dessiné en pièces séparées (queue, corps, tête, oreilles, yeux, bras, loupe) et a cinq humeurs (calme, réflexion avec l'œil grossi par la loupe, joie, tristesse, surprise). Il cligne des yeux, respire, remue la queue. On le retrouve sur les toits de l'accueil (il saute quand on le touche), comme pion sur le chemin de l'aventure, à côté de la grille où il réagit aux combos et aux erreurs, dans le tutoriel, à l'ouverture des chapitres et sur les écrans de fin. Un illustrateur pourra redessiner chaque pièce plus tard sans toucher au code. L'icône se régénère avec `npx tsx .qa/icon.tsx`.
- Icônes : [Phosphor](https://phosphoricons.com) (licence MIT), style duotone partout pour une famille homogène.
- Polices embarquées Lilita One (titres, boutons, tuiles, chiffres) et Nunito (textes). Aucun emoji.
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

## Boutique, garde-robe et achats

Règle de base : l'argent achète du style et du confort, jamais du score. Aucune aide payante ne compte dans les modes classés (défi du jour, arène) : une partie terminée avec une aide y est marquée « hors classement » et n'entre ni au record ni au classement.

- **Catalogue** (`src/catalog.ts`) : tenues de Loupi (chapeau, cou, loupe, dos), tuiles, claviers, effets de victoire, cadres de profil, décors de l'accueil, packs de grilles. Chaque objet a un prix en jetons, un produit du magasin ou une condition pour être gagné en jouant (chapitre, ligue, événement, fin de l'aventure). Les objets gagnés arrivent tout seuls dans la garde-robe.
- **Vitrine** : trois objets mis en avant, renouvelés chaque lundi. Pack de démarrage proposé une seule fois. Abonnement Lexicode+ (sans pub, archives des défis passés, un gel de série par semaine).
- **Garde-robe** : on essaie tout gratuitement, il faut posséder une pièce pour la garder. La tenue choisie est portée par Loupi partout dans le jeu.
- **Achats** (`src/services/billing.ts`) : RevenueCat par-dessus Google Play Billing, avec vérification des reçus côté serveur et restauration sur un nouveau téléphone. Dans la version web, les achats sont simulés.

Pour activer les vrais achats :
1. Dans la Play Console, créer les produits avec les identifiants de `SKUS` (abonnements `lexicode_plus_monthly` et `lexicode_plus_yearly`, produits uniques et consommables pour le reste).
2. Dans RevenueCat, créer le projet, relier la Play Console, importer les produits et créer un droit nommé `plus` relié aux deux abonnements.
3. Mettre la clé publique Android dans `.env` : `VITE_RC_ANDROID_KEY=...`, puis `npm run build && npx cap sync android`.

## Événements saisonniers

Un événement est une fiche de données dans `src/events.ts` : dates, thème de l'application, décor ajouté aux scènes, tenue de Loupi, titre et histoire en trois langues, monnaie propre (jamais achetable), nombre de messages et récompenses. Les messages à déchiffrer sont dans `src/content/extra.ts` et passent par le vérificateur. Le premier, « À la rescousse du Père Noël », démarre seul le 1er décembre. Pour l'essayer avant : ajouter `?event=xmas` à l'adresse.

Le serveur expose aussi une liste d'événements (`GET /v1/events`) pour lancer, prolonger ou corriger un événement sans mise à jour du Play Store. Les dessins d'un nouvel événement doivent être livrés dans une mise à jour quelques semaines avant.

## Serveur

Le dossier `server/` contient notre propre serveur : Node et TypeScript, Express pour l'API, Colyseus pour le temps réel (multijoueur, à venir) et PostgreSQL pour les données. Il partage le moteur du jeu avec l'application, ce qui lui permet de rejouer chaque partie classée.

**Comment une partie classée est vérifiée.** Au lancement, l'application demande au serveur d'ouvrir la partie : le serveur note l'heure et, pour l'arène, tire lui-même la graine de la grille. À la fin, l'application envoie le journal des coups (chaque lettre avec son instant). Le serveur rejoue la partie avec le même moteur, recalcule le score et refuse le journal si la grille n'est pas résolue, si une aide a été utilisée, si deux frappes sont trop rapprochées pour être humaines ou si la durée annoncée dépasse le temps réellement écoulé chez lui. Seul le meilleur score de chaque joueur est gardé par classement, et chaque partie validée est conservée comme fantôme pour le multijoueur.

**Côté application.** Il suffit de mettre l'adresse du serveur dans `.env` : `VITE_API_URL=https://api.exemple.com`. Sans cette ligne, le jeu reste entièrement local et les classements affichent la démonstration. Le joueur reçoit une identité anonyme à la première partie classée ; son nom, sa ville et son pays sont envoyés quand il les change. Hors ligne, la partie se joue normalement mais ne compte pas au classement.

**Mise en ligne.** Sur un petit serveur (un VPS à 5 ou 10 euros par mois suffit au départ) avec Docker :

```bash
cd server
cp .env.example .env      # remplir DB_PASSWORD, SERVER_SECRET (openssl rand -hex 32) et CORS_ORIGIN
docker compose up -d --build
```

Cela lance trois services : la base PostgreSQL, le serveur (port 2567) et une sauvegarde de la base chaque nuit, gardée 14 jours dans `server/backups/`. Les tables sont créées au démarrage (`server/migrations/`). Il faut ensuite placer un proxy HTTPS devant le port 2567 (Caddy le fait en deux lignes). Ces fichiers Docker n'ont pas pu être essayés dans l'environnement où ils ont été écrits : à vérifier au premier lancement.

**Points d'entrée.** `POST /v1/auth/anon`, `PATCH /v1/me`, `GET /v1/me/multi`, `POST /v1/games`, `POST /v1/games/:id/finish`, `GET /v1/boards/:lang/:key?scope=world|country|city&place=`, `GET /v1/ghosts/:lang/:key`, `GET /v1/events`, `GET /v1/online`, `GET /v1/rooms/:code`, les défis (`/v1/challenges…`) et `GET /health`.

**Tests.** Lancer le serveur avec `NODE_ENV=test` (cela coupe la limite de créations de comptes par adresse) sur une base vide, puis `cd server && API_URL=http://localhost:2567 DATABASE_URL=postgres://... npm test`. Trois séries : l'arbitre multijoueur sans réseau (12 tests), l'API (21) et les salles temps réel avec de vrais clients (5).

## Jeu à plusieurs

Tout part de l'écran « À plusieurs » (tuile de l'accueil et lien en haut de l'arène). Aucun mode n'autorise d'aide ni de bonus, une partie dure au plus 5 minutes et une erreur coûte 3 secondes au lieu d'une vie.

- **Duel classé.** Une file d'attente par langue apparie deux joueurs de cote proche ; l'écart toléré s'élargit avec l'attente. Après 15 secondes sans adversaire, l'écran propose une course contre un fantôme, présenté comme tel. La cote de duel (Elo) est tenue par le serveur, à part du niveau solo.
- **Salon entre amis**, de 2 à 5 joueurs, rejoint par un code de 4 caractères ou un lien (`?salon=CODE`). L'hôte règle la difficulté et les pièges. Un piège se gagne tous les deux mots et vise le joueur juste devant : tache d'encre (deux indices cachés 8 s) ou clavier gelé (3 s). La victime est ensuite protégée 10 s. Les pièges ne s'achètent pas.
- **Enquête à plusieurs**, de 2 à 4 joueurs : une seule grille, les indices sont répartis et chacun ne voit que les siens. Les lettres d'un coéquipier apparaissent avec sa couleur, l'équipe partage six cœurs.
- **Défi entre amis.** Le créateur joue une grille tirée par le serveur, puis partage un lien (`?defi=CODE`). Son ami joue la même grille en voyant le fantôme du créateur avancer.
- **Course contre un fantôme** : la partie d'arène enregistrée d'un vrai joueur de niveau proche, rejouée à sa vitesse. Jamais le défi du jour, pour ne rien dévoiler.

**Comment c'est arbitré.** Le serveur tient l'état de chaque salle (`src/multi/match.ts`, partagé avec l'application). Les téléphones n'envoient que leurs frappes ; le serveur les rejoue avec le moteur du jeu et l'heure du serveur, refuse les frappes trop rapprochées et décide du classement. Les défis sont validés comme les parties classées, par rejeu du journal.

**Récompenses.** De l'XP à chaque partie ; des jetons (15 pour une victoire, 5 sinon) sur les cinq premières parties du jour seulement, pour qu'on ne puisse pas en fabriquer à la chaîne.

**Liens d'invitation.** Sur téléphone, l'adresse locale de l'application ne sert à rien dans un lien. Il faut indiquer l'adresse publique du jeu dans `.env` : `VITE_PUBLIC_URL=https://…`. Pour que ces liens ouvrent directement l'application Android, il faudra ajouter les « App Links » (fichier `assetlinks.json` sur le site et filtre d'intention dans le manifeste).

**Maquettes.** `?preview=mp-hub`, `mp-search`, `mp-versus`, `mp-lobby`, `mp-duel`, `mp-party`, `mp-party-trap`, `mp-coop`, `mp-ghost`, `mp-res-duel`, `mp-res-party`, `mp-res-coop`, `mp-challenge`, `mp-invite` affichent chaque écran avec des joueurs simulés, sans serveur.

## Ce qu'il reste à brancher avant la publication

1. **Serveur** : louer le VPS, remplir `server/.env`, lancer `docker compose up -d --build`, mettre un nom de domaine en HTTPS, puis `VITE_API_URL=...` et `VITE_PUBLIC_URL=...` dans le `.env` de l'application.
2. **Pubs** : AdMob est branché (pub récompensée, formulaire de consentement RGPD). Il tourne avec les identifiants de test de Google : remplacer l'identifiant d'application dans `android/app/src/main/AndroidManifest.xml` et mettre `VITE_ADMOB_REWARDED_ID=...` dans `.env`.
3. **Achats** : produits Play Console et clé RevenueCat (voir plus haut).
4. **Nom définitif** : vérifier que « Lexicode » est libre sur le Play Store.

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
