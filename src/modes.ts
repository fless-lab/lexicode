import type { Difficulty, LangPack, Puzzle } from './engine/types';
import { dailyPuzzle, levelPuzzle, practicePuzzle, generatePuzzle, levelDifficulty, worldCategory } from './engine/generator';

export type ModeKind =
  | 'daily'
  | 'level'
  | 'practice'
  | 'timeattack'
  | 'sudden'
  | 'survival'
  | 'marathon'
  | 'hardcore'
  | 'zen';

export interface Mode {
  kind: ModeKind;
  d: Difficulty;
  nonce: string;
  date?: string;
  level?: number;
  /** Rang de la grille dans une série marathon. */
  run?: number;
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

/** Un niveau sur six est un boss : chrono et trois vies. */
export function isBossLevel(level: number): boolean {
  return level % 6 === 0;
}

export function rulesFor(m: Mode): Rules {
  const base: Rules = { timeMs: null, lives: null, noHints: false, cheapHints: false, mistakePenaltyMs: 0, mult: 1 };
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
      return { ...base, timeMs: 300_000, lives: 1, noHints: true, mult: 2 };
    case 'zen':
      return { ...base, cheapHints: true, mult: 0.5 };
    case 'level':
      if (m.level && isBossLevel(m.level)) return { ...base, timeMs: Math.round(TIME_LIMIT[m.d] * 1.4), lives: 3, mult: 1.3 };
      return base;
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
      // Les boss sont un cran plus difficiles que les niveaux qui les entourent.
      if (isBossLevel(m.level!))
        return generatePuzzle(pack, `boss-${m.level}`, Math.min(5, levelDifficulty(m.level!) + 1) as Difficulty, { category: worldCategory(pack, m.level!) });
      return levelPuzzle(pack, m.level!);
    case 'hardcore':
      return generatePuzzle(pack, `hardcore-${m.nonce}`, 5);
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
  return { kind: 'level', d: levelDifficulty(level), nonce: '', level };
}

/** Modes de l'arène, dans l'ordre d'affichage. `pickD` : la difficulté se choisit. */
export const ARENA: { kind: ModeKind; icon: string; pickD: boolean; unlockLevel: number }[] = [
  { kind: 'timeattack', icon: '⏱', pickD: true, unlockLevel: 1 },
  { kind: 'survival', icon: '❤️', pickD: true, unlockLevel: 1 },
  { kind: 'sudden', icon: '💀', pickD: true, unlockLevel: 3 },
  { kind: 'marathon', icon: '🏃', pickD: false, unlockLevel: 5 },
  { kind: 'hardcore', icon: '🔥', pickD: false, unlockLevel: 8 },
  { kind: 'zen', icon: '🍃', pickD: true, unlockLevel: 1 },
];
