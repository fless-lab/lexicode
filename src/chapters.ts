// Aventure : 8 chapitres de 12 niveaux, chacun avec son décor et sa mécanique.
// Après le chapitre 8, un nouveau cycle recommence, plus dur.
import type { Difficulty, LangPack, Puzzle } from './engine/types';
import { generatePuzzle, cryptogramPuzzle, applyMods, type TierChoice, type ModSpec } from './engine/generator';
import { storyPhraseIndex } from './content';

export interface ChapterDef {
  theme: string;
  icon: string;
  dFrom: Difficulty;
  dTo: Difficulty;
  tier: TierChoice;
  mods: ModSpec;
  timeMs?: number;
  lives?: number;
  cryptogram?: boolean;
  /** Lettres données retirées par rapport à la normale. */
  fewerGiven?: number;
}

export const LEVELS_PER_CHAPTER = 12;

export const CHAPTERS: ChapterDef[] = [
  { theme: 'atelier', icon: 'gear', dFrom: 1, dTo: 2, tier: 1, mods: {} },
  { theme: 'library', icon: 'book', dFrom: 2, dTo: 3, tier: 2, mods: {}, fewerGiven: 1, lives: 5 },
  { theme: 'train', icon: 'clock', dFrom: 2, dTo: 3, tier: 2, mods: {}, timeMs: 170_000, lives: 5 },
  { theme: 'archives', icon: 'flame', dFrom: 3, dTo: 3, tier: 2, mods: { ink: 0.35 }, lives: 4 },
  { theme: 'observatory', icon: 'star', dFrom: 3, dTo: 4, tier: 3, mods: { chain: true }, lives: 4 },
  { theme: 'machines', icon: 'gear', dFrom: 4, dTo: 4, tier: 'mix', mods: { ink: 0.3, smudge: true }, lives: 3 },
  { theme: 'tower', icon: 'key', dFrom: 3, dTo: 5, tier: 3, mods: {}, cryptogram: true, lives: 4 },
  { theme: 'cabinet', icon: 'crown', dFrom: 4, dTo: 5, tier: 3, mods: { ink: 0.4, fog: true, chain: true }, timeMs: 240_000, lives: 3 },
];

export interface LevelInfo {
  level: number;
  /** Chapitre de 0 à 7. */
  chapter: number;
  /** Cycle à partir de 0 (chaque cycle durcit tout). */
  cycle: number;
  /** Position dans le chapitre, de 0 à 11. */
  step: number;
  boss: boolean;
  finale: boolean;
  d: Difficulty;
  def: ChapterDef;
}

export function levelInfo(level: number): LevelInfo {
  const ch = Math.floor((level - 1) / LEVELS_PER_CHAPTER);
  const chapter = ch % CHAPTERS.length;
  const cycle = Math.floor(ch / CHAPTERS.length);
  const step = (level - 1) % LEVELS_PER_CHAPTER;
  const def = CHAPTERS[chapter];
  const ramp = def.dFrom + Math.round(((def.dTo - def.dFrom) * step) / (LEVELS_PER_CHAPTER - 1));
  const boss = step === 5 || step === 11;
  const d = Math.min(5, ramp + cycle + (boss && step === 5 ? 0 : 0)) as Difficulty;
  return { level, chapter, cycle, step, boss, finale: step === 11, d, def };
}

/** Altérations du niveau : celles du chapitre, renforcées à chaque cycle. */
export function levelMods(info: LevelInfo): ModSpec {
  const m = { ...info.def.mods };
  if (info.cycle >= 1) m.ink = Math.min(0.6, (m.ink ?? 0) + 0.15 * info.cycle);
  if (info.cycle >= 2) m.smudge = true;
  if (info.cycle >= 3) m.fog = true;
  return m;
}

/** Mots des niveaux déjà générés, par langue : chaque niveau évite ceux des précédents. */
const advWords = new Map<string, string[]>();
const AVOID_LEVELS = 5;

function adventureWords(pack: LangPack, level: number): string[] {
  const key = `${pack.lang}|${level}`;
  let w = advWords.get(key);
  if (!w) {
    w = adventureBase(pack, level).words.map((x) => x.answer);
    advWords.set(key, w);
  }
  return w;
}

function adventureBase(pack: LangPack, level: number): Puzzle {
  const info = levelInfo(level);
  const def = info.def;
  let tier: TierChoice = info.cycle >= 1 && def.tier !== 3 ? (def.tier === 1 ? 2 : 3) : def.tier;
  // Grilles moyennes : l'indice facile alterne avec l'indice moyen, pour ne pas revoir toujours la même définition.
  if (tier === 1 && info.d >= 2) tier = 'mix12';
  const seed = `adv-${level}`;
  const story = info.finale ? storyPhraseIndex(pack, info.chapter) : undefined;
  if (def.cryptogram) return cryptogramPuzzle(pack, seed, info.d, story !== undefined && story >= 0 ? story : undefined);
  // Les niveaux précédents sont calculés dans l'ordre (et mémorisés) pour ne pas resservir leurs mots.
  for (let l = Math.max(1, level - AVOID_LEVELS); l < level; l++) adventureWords(pack, l);
  const avoid = new Set<string>();
  for (let l = Math.max(1, level - AVOID_LEVELS); l < level; l++) for (const x of advWords.get(`${pack.lang}|${l}`) ?? []) avoid.add(x);
  const base = { 1: 4, 2: 3, 3: 2, 4: 1, 5: 0 }[info.d];
  return generatePuzzle(pack, seed, info.d, {
    tier,
    phraseIndex: story !== undefined && story >= 0 ? story : undefined,
    given: def.fewerGiven ? Math.max(0, base - def.fewerGiven) : undefined,
    avoid,
  });
}

export function adventurePuzzle(pack: LangPack, level: number): Puzzle {
  const p = adventureBase(pack, level);
  advWords.set(`${pack.lang}|${level}`, p.words.map((x) => x.answer));
  return applyMods(p, levelMods(levelInfo(level)));
}

/** Chrono et vies du niveau. Les boss ont toujours un chrono et trois vies. */
export function adventureLimits(info: LevelInfo, timeLimit: (d: Difficulty) => number): { timeMs: number | null; lives: number | null } {
  const shrink = Math.pow(0.9, info.cycle);
  let timeMs = info.def.timeMs ? Math.round(info.def.timeMs * shrink) : null;
  let lives = info.def.lives ?? null;
  if (info.boss) {
    timeMs = timeMs ?? Math.round(timeLimit(info.d) * 1.4 * shrink);
    lives = Math.min(lives ?? 3, 3);
  }
  return { timeMs, lives };
}
