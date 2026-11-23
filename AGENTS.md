# Lexicode : notes pour les agents de code

Ce fichier sert à toute session d'agent qui travaille sur le dépôt (Claude Code, Codex ou autre). Le README décrit le jeu et sa mise en ligne ; ici, on trouve ce qu'il faut savoir pour modifier le code sans rien casser.

## Règles du propriétaire

- Messages de commit : en français, sans aucune mention d'un assistant ou d'un outil d'IA, ni ligne de co-auteur. L'auteur est Abdou-Raouf ATARMLA, et lui seul.
- Travailler directement sur `master`.
- Textes rédigés (README, textes du jeu) : pas de tiret cadratin, des phrases sobres qui ne sonnent pas « générées ».
- Avant de produire un document, vérifier s'il existe déjà.
- Changement visuel important (refonte d'écran, nouvelle direction) : proposer d'abord des maquettes ou des captures, attendre la validation, puis appliquer.
- Le jeu ne doit pas devenir « payer pour gagner » : rien d'achetable ne donne d'avantage dans les modes classés ni dans le jeu à plusieurs.

## Organisation

| Dossier | Rôle |
| --- | --- |
| `src/engine` | Moteur pur : génération des grilles (`generator.ts`), règles et journal des coups (`game.ts`), hasard reproductible (`rng.ts`). Partagé avec le serveur. |
| `src/content` | Phrases et mots-indices en trois langues, packs, événements. Chaque indice publié a été vérifié (voir « Circuit de validation » dans le README). |
| `src/modes.ts` | Modes de jeu, règles, liste des modes classés (`RANKED`). |
| `src/multi` | Protocole et arbitre du jeu à plusieurs (`match.ts`), partagés avec le serveur. |
| `src/services` | API du serveur (`api.ts`), salles temps réel (`multi.ts`), classements, achats (RevenueCat), pubs (AdMob). |
| `src/ui` | Écrans React. `Play.tsx` est l'écran de partie, réutilisé partout (solo, défis, multijoueur). |
| `src/styles.css` | Tout le style. La couche « nuit arcade » commence au commentaire « Habillage arcade » ; les blocs suivants sont classés par écran. |
| `server/` | Serveur Node : Express (API), Colyseus (temps réel), PostgreSQL, migrations SQL, tests. |
| `scripts/verify.ts` | Contrôle de toutes les grilles et rejeu de parties. |

## Commandes utiles

```
npm run dev                 # jeu dans le navigateur
npm run verify              # doit finir par « 0 problème(s) » et « rejouées à l'identique »
npx tsc --noEmit -p .       # types de l'application
npm run build:single        # un seul fichier HTML (dist-single/index.html)
cd server && npx tsc -p . --noEmit
```

Tests du serveur : une base PostgreSQL vide, le serveur lancé avec `NODE_ENV=test DATABASE_URL=... npx tsx src/index.ts`, puis `API_URL=http://localhost:2567 DATABASE_URL=... npm test` dans `server/`. Les 38 tests doivent passer.

## Pièges connus

- **Le hasard doit être reproductible partout.** Le serveur régénère chaque grille pour vérifier les parties. N'appelez jamais `rng()` dans une fonction de tri (le nombre d'appels change d'un moteur JavaScript à l'autre) et n'utilisez pas `Math.random` dans `src/engine` ni `src/content`.
- **Ne pas toucher aux contenus publiés sans repasser la vérification.** `npm run verify` refuse tout indice non validé.
- **Phrases réservées** (`story`, `event:<id>`, `pack:<id>`) : elles sont exclues des tirages au hasard. Un nouveau pack ou événement doit utiliser ces catégories.
- **Maquettes sans serveur** : `?preview=shop`, `?preview=wardrobe`, `?preview=event`, `?event=xmas` et `?preview=mp-…` (liste dans le README) affichent les écrans avec des données simulées. Ajouter `&qa=1` expose `window.__lexi()`, qui renvoie la grille en cours (utile pour les tests automatiques).
- **Les tuiles et le clavier** reçoivent leur thème par des variables CSS (`--tile`, `--tile-edge`, `--tile-ink`, `--tile-num`) et les classes `skin-*` et `kbs-*`.

## Visuels et ressources

- Loupi, le raton laveur, est un SVG articulé dans `src/ui/mascot.tsx` (humeurs `idle`, `happy`, `sad`, `think`, `wow`, tenues par `Outfit`). Toute nouvelle tenue s'ajoute là, puis dans le catalogue (`src/catalog.ts`).
- Les décors de chapitres sont des scènes SVG dans `src/ui/scenes.tsx`, à aplats et contours sombres, sans flou ni dégradé lumineux.
- Les icônes viennent de Phosphor (licence MIT), style duotone, importées une par une dans `src/ui/Icon.tsx`.
- Polices : Lilita One pour les titres, boutons, tuiles et chiffres ; Nunito pour le texte.
- L'icône de l'application est générée par `.qa/icon.tsx` à partir de Loupi.

Pistes ouvertes pour des ressources : sons propres (aujourd'hui synthétisés dans `src/sound.ts`), décors du prochain événement saisonnier, nouvelles tenues de Loupi, captures et visuels pour la fiche Play Store.

## Avant de pousser

1. `npx tsc --noEmit -p .` et `cd server && npx tsc -p . --noEmit` sans erreur.
2. `npm run verify` à 0 problème.
3. Tests du serveur si le serveur ou `src/multi` a changé.
4. Pour un changement visuel, une capture d'écran à 390 × 844 de chaque écran touché.
