import type { Difficulty, LangPack, Puzzle } from './engine/types';
import { dailyPuzzle, practicePuzzle, generatePuzzle, cryptogramPuzzle } from './engine/generator';
import { levelInfo, adventurePuzzle, adventureLimits } from './chapters';
import { makeFloor, floorPuzzle, count, type Run } from './expedition';

export type ModeKind =
  | 'daily'
  | 'level'
  | 'practice'
  | 'timeattack'
  | 'sudden'
  | 'survival'
  | 'marathon'
  | 'hardcore'
  | 'zen'
  | 'cryptogram'
  | 'expedition';

export interface Mode {
  kind: ModeKind;
  d: Difficulty;
  nonce: string;
  date?: string;
  level?: number;
  /** Rang de la grille dans une série marathon. */
  run?: number;
  /** État de l'expédition en cours. */
  exp?: Run;
}

export interface Rules {
  /** Temps imparti en ms (null = pas de chrono). */
  timeMs: number | null;
  /** Erreurs autorisées avant échec (null = illimité). */
  lives: number | null;
  noHints: boolean;
  /** Indices à moitié prix (zen). */
  cheapHints: boolean;
  /** Pénalité en ms par erreur sur le chrono (marathon). */
  mistakePenaltyMs: number;
  /** Multiplicateur de score. */
  mult: number;
  /** Bonus utilisables en partie. */
  boosters: boolean;
}

/** Temps imparti par difficulté pour le contre-la-montre. */
export const TIME_LIMIT: Record<Difficulty, number> = {
  1: 100_000,
  2: 130_000,
  3: 160_000,
  4: 200_000,
  5: 240_000,
};

export const MARATHON_START_MS = 150_000;
export const MARATHON_BONUS_MS = (d: Difficulty) => 30_000 + d * 8_000;

/** Deux boss par chapitre : au milieu et au message final. */
export function isBossLevel(level: number): boolean {
  return levelInfo(level).boss;
}

export const HOURGLASS_MS = 25_000;

export function rulesFor(m: Mode): Rules {
  const base: Rules = { timeMs: null, lives: null, noHints: false, cheapHints: false, mistakePenaltyMs: 0, mult: 1, boosters: true };
  switch (m.kind) {
    case 'timeattack':
      return { ...base, timeMs: TIME_LIMIT[m.d], mult: 1.25 };
    case 'sudden':
      return { ...base, lives: 1, mult: 1.5 };
    case 'survival':
      return { ...base, lives: 3, mult: 1.2 };
    case 'marathon':
      return { ...base, timeMs: MARATHON_START_MS, mistakePenaltyMs: 5_000 };
    case 'hardcore':
      return { ...base, timeMs: 300_000, lives: 1, noHints: true, mult: 2, boosters: false };
    case 'cryptogram':
      return { ...base, mult: 1.6 };
    case 'daily':
      return { ...base, boosters: false };
    case 'zen':
      return { ...base, cheapHints: true, mult: 0.5 };
    case 'level': {
      const info = levelInfo(m.level ?? 1);
      const lim = adventureLimits(info, (d) => TIME_LIMIT[d]);
      return { ...base, ...lim, mult: 1 + info.chapter * 0.1 + info.cycle * 0.5 + (info.boss ? 0.3 : 0) };
    }
    case 'expedition': {
      const run = m.exp!;
      const f = makeFloor(run.seed, run.depth);
      return { ...base, lives: run.hearts, timeMs: f.timeMs !== null ? f.timeMs + count(run, 'hourglass') * HOURGLASS_MS : null, boosters: false };
    }
    default:
      return base;
  }
}

/** Difficulté de la n-ième grille d'un marathon : monte toutes les deux grilles. */
export function marathonDifficulty(run: number): Difficulty {
  return Math.min(5, 1 + Math.floor(run / 2)) as Difficulty;
}

export function puzzleFor(pack: LangPack, m: Mode): Puzzle {
  switch (m.kind) {
    case 'daily':
      return dailyPuzzle(pack, m.date!);
    case 'level':
      return adventurePuzzle(pack, m.level!);
    case 'expedition':
      return floorPuzzle(pack, m.exp!, makeFloor(m.exp!.seed, m.exp!.depth));
    case 'hardcore':
      return generatePuzzle(pack, `hardcore-${m.nonce}`, 5);
    case 'cryptogram':
      return cryptogramPuzzle(pack, m.nonce, m.d);
    case 'marathon':
      return generatePuzzle(pack, `marathon-${m.nonce}-${m.run ?? 0}`, marathonDifficulty(m.run ?? 0));
    default:
      return practicePuzzle(pack, m.d, `${m.kind}-${m.nonce}`);
  }
}

/** Clé de record : un record par mode et par difficulté quand elle est au choix. */
export function recordKey(m: Mode): string | null {
  switch (m.kind) {
    case 'timeattack':
    case 'sudden':
    case 'survival':
    case 'zen':
    case 'cryptogram':
    case 'practice':
      return `${m.kind}:${m.d}`;
    case 'marathon':
    case 'hardcore':
      return m.kind;
    default:
      return null;
  }
}

export function levelMode(level: number): Mode {
  return { kind: 'level', d: levelInfo(level).d, nonce: '', level };
}

/** Modes de l'arène, dans l'ordre d'affichage. `pickD` : la difficulté se choisit. */
export const ARENA: { kind: ModeKind; icon: string; pickD: boolean; unlockLevel: number }[] = [
  { kind: 'timeattack', icon: '⏱', pickD: true, unlockLevel: 1 },
  { kind: 'survival', icon: '❤️', pickD: true, unlockLevel: 1 },
  { kind: 'sudden', icon: '💀', pickD: true, unlockLevel: 3 },
  { kind: 'marathon', icon: '🏃', pickD: false, unlockLevel: 5 },
  { kind: 'hardcore', icon: '🔥', pickD: false, unlockLevel: 8 },
  { kind: 'cryptogram', icon: '🗝', pickD: true, unlockLevel: 4 },
  { kind: 'zen', icon: '🍃', pickD: true, unlockLevel: 1 },
];
