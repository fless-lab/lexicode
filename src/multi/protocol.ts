// Contrat partagé entre l'application et le serveur pour le jeu à plusieurs.
// Le serveur tient l'état de chaque partie : les clients envoient leurs frappes, il les rejoue
// avec le moteur commun et diffuse la progression. Personne ne peut annoncer un faux avancement.

import type { Difficulty, Lang } from '../engine/types';

/** duel : 1 contre 1 classé ; party : salon de 2 à 5 amis ; coop : une grille, chacun ses indices. */
export type RoomKind = 'duel' | 'party' | 'coop';

export type TrapKind = 'ink' | 'freeze';

export interface Look {
  hat?: string;
  neck?: string;
  loupe?: string;
  back?: string;
  title?: string;
  frame?: string;
}

export interface PlayerPub {
  id: string;
  name: string;
  place: string;
  rating: number;
  look: Look;
  /** Couleur attribuée dans la salle (index dans PLAYER_COLORS). */
  color: number;
  host: boolean;
  ready: boolean;
  connected: boolean;
  /** Lettres différentes trouvées (sur RoomState.total) et mots trouvés. */
  letters: number;
  words: number;
  mistakes: number;
  /** Temps final, pénalités comprises, quand la grille est finie. */
  doneMs: number | null;
  /** Charges de piège disponibles (variante piège). */
  traps: number;
}

export interface RoomOptions {
  lang: Lang;
  d: Difficulty;
  traps: boolean;
}

export type Phase = 'lobby' | 'countdown' | 'play' | 'done';

export interface RoomState {
  kind: RoomKind;
  code: string;
  phase: Phase;
  options: RoomOptions;
  players: PlayerPub[];
  /** Nombre de lettres différentes à trouver (la jauge de chaque joueur va de 0 à total). */
  total: number;
  /** Graine de la grille, connue de tous dès le compte à rebours. */
  seed: string | null;
  /** Heure serveur du départ et de la fin imposée. */
  startAt: number | null;
  endAt: number | null;
  /** Coop : à qui appartient chaque indice (id de joueur, par mot). */
  clueOwner: string[] | null;
  /** Coop : cœurs restants de l'équipe. */
  teamLives: number | null;
}

/** Messages du client vers le serveur. */
export type ClientMsg =
  | { t: 'ready'; ready: boolean }
  | { t: 'options'; options: Partial<RoomOptions> }
  | { t: 'start' }
  | { t: 'move'; code: number; letter: string }
  | { t: 'trap'; target: string; kind: TrapKind }
  | { t: 'ping'; word: number }
  | { t: 'emote'; e: Emote }
  | { t: 'rematch' }
  /** Le client demande l'état complet (après s'être abonné aux messages). */
  | { t: 'sync' };

export type Emote = 'wow' | 'gg' | 'think' | 'hurry';

/** Messages du serveur vers les clients, en plus de l'état complet. */
export type ServerMsg =
  | { t: 'state'; s: RoomState }
  | { t: 'move'; by: string; code: number; letter: string; ok: boolean }
  | { t: 'trapped'; by: string; target: string; kind: TrapKind; until: number }
  | { t: 'ping'; by: string; word: number }
  | { t: 'emote'; by: string; e: Emote }
  | { t: 'result'; ranking: ResultRow[]; ratingDelta?: Record<string, number> }
  | { t: 'error'; reason: string };

export interface ResultRow {
  id: string;
  rank: number;
  ms: number | null;
  letters: number;
  words: number;
  mistakes: number;
}

export const PLAYER_COLORS = ['#ffb938', '#3fd6a6', '#ff5d62', '#7a5af5', '#3c9cf0'];

export const MULTI_RULES = {
  /** Durée maximale d'une partie à plusieurs. */
  timeMs: 5 * 60_000,
  countdownMs: 3_500,
  /** Une erreur coûte du temps plutôt qu'une vie : on reste dans la course. */
  mistakePenaltyMs: 3_000,
  /** Un piège gagné tous les deux mots trouvés. */
  wordsPerTrap: 2,
  trapMs: { ink: 8_000, freeze: 3_000 } as Record<TrapKind, number>,
  /** Après un piège, la victime est protégée un moment. */
  trapImmunityMs: 10_000,
  coopLives: 6,
  maxPlayers: { duel: 2, party: 5, coop: 4 } as Record<RoomKind, number>,
  minPlayers: { duel: 2, party: 2, coop: 2 } as Record<RoomKind, number>,
};
