import type { Difficulty, Entry, LangPack, Mods, PhraseCell, Puzzle, PuzzleWord, Tier } from './types';
import { rngFromSeed, shuffle, hashString, type Rng } from './rng';
import { norm, isAZ, letterSet, letterCount } from './text';

export interface DiffCfg {
  minWords: number;
  maxWords: number;
  given: number;
  minLen: number;
  maxLen: number;
  phraseMin: number;
  phraseMax: number;
}

export const DIFF: Record<Difficulty, DiffCfg> = {
  1: { minWords: 5, maxWords: 7, given: 4, minLen: 3, maxLen: 7, phraseMin: 0, phraseMax: 24 },
  2: { minWords: 5, maxWords: 8, given: 3, minLen: 3, maxLen: 8, phraseMin: 14, phraseMax: 30 },
  3: { minWords: 6, maxWords: 9, given: 2, minLen: 3, maxLen: 9, phraseMin: 20, phraseMax: 38 },
  4: { minWords: 7, maxWords: 10, given: 1, minLen: 4, maxLen: 10, phraseMin: 26, phraseMax: 50 },
  5: { minWords: 8, maxWords: 11, given: 0, minLen: 4, maxLen: 12, phraseMin: 30, phraseMax: 99 },
};

const RARE = new Set(['J', 'K', 'Q', 'W', 'X', 'Y', 'Z', 'V', 'H', 'F', 'B', 'G']);

export function ratingFor(d: Difficulty): number {
  return 700 + d * 150;
}

export function buildPhraseCells(text: string, letterToCode: Record<string, number>): PhraseCell[] {
  const cells: PhraseCell[] = [];
  for (const raw of text) {
    const n = norm(raw);
    if (n.length === 1 && isAZ(n)) {
      cells.push({ kind: 'letter', n, shown: raw.toUpperCase(), code: letterToCode[n] });
    } else {
      cells.push({ kind: 'sep', ch: raw });
    }
  }
  return cells;
}

interface CoverResult {
  chosen: Entry[];
  uncovered: Set<string>;
}

function greedyCover(target: Set<string>, pool: Entry[], cfg: DiffCfg, rng: Rng): CoverResult {
  const uncovered = new Set(target);
  const chosen: Entry[] = [];
  const used = new Set<string>();
  while (uncovered.size > 0 && chosen.length < cfg.maxWords) {
    let best: Entry | null = null;
    let bestScore = 0;
    for (const e of pool) {
      if (used.has(e.w)) continue;
      let s = 0;
      for (const l of new Set(e.w)) if (uncovered.has(l)) s += RARE.has(l) ? 1.6 : 1;
      if (s === 0) continue;
      s += rng() * 0.9;
      if (s > bestScore) {
        bestScore = s;
        best = e;
      }
    }
    if (!best) break;
    chosen.push(best);
    used.add(best.w);
    for (const l of best.w) uncovered.delete(l);
  }
  return { chosen, uncovered };
}

/** 'mix' : moyen ou malin ; 'mix12' : facile ou moyen. */
export type TierChoice = Tier | 'mix' | 'mix12';

/** Niveau d'indice par défaut selon la difficulté. */
export function tierFor(d: Difficulty): TierChoice {
  return d === 1 ? 1 : d === 2 ? 'mix12' : d === 3 ? 2 : d === 4 ? 'mix' : 3;
}

/** Choisit l'indice d'un mot au niveau voulu, en redescendant si ce niveau manque. */
export function pickClue(e: Entry, choice: TierChoice, rng: Rng): { clue: string; tier: Tier } {
  const want: Tier = choice === 'mix' ? (rng() < 0.5 ? 2 : 3) : choice === 'mix12' ? (rng() < 0.5 ? 1 : 2) : choice;
  const by: Record<Tier, string[]> = {
    1: [e.c],
    2: [e.c2, ...(e.more2 ?? [])].filter((x): x is string => !!x),
    3: [e.c3, ...(e.more3 ?? [])].filter((x): x is string => !!x),
  };
  for (let t = want; t >= 1; t--) {
    const list = by[t as Tier];
    if (list.length) return { clue: list[Math.floor(rng() * list.length)], tier: t as Tier };
  }
  return { clue: e.c, tier: 1 };
}

/** Phrases réservées (histoire, événements, packs) : jamais tirées au hasard. */
export const isReservedCat = (k: string) => k === 'story' || k.startsWith('event:') || k.startsWith('pack:');
const isStory = (pack: LangPack, i: number) => isReservedCat(pack.phrases[i].k);

export interface GenOptions {
  /** Niveau des indices (par défaut selon la difficulté). */
  tier?: TierChoice;
  /** Nombre de lettres données imposé. */
  given?: number;
  /** Force une phrase précise (index dans le pack). */
  phraseIndex?: number;
  /** Restreint à une catégorie de phrases. */
  category?: string;
  /** Mots à éviter (vus dans les grilles précédentes) ; repris seulement si la grille ne se construit pas sans eux. */
  avoid?: ReadonlySet<string>;
}

/**
 * Génère une grille déterministe à partir d'une graine.
 * Règles garanties (contrôlées ensuite par verify.ts) :
 *  - chaque lettre de la phrase est apprise par au moins un mot ou révélée au départ ;
 *  - une lettre = un numéro, un numéro = une lettre ;
 *  - aucune réponse en double.
 */
export function generatePuzzle(
  pack: LangPack,
  seed: string,
  difficulty: Difficulty,
  opts: GenOptions = {},
): Puzzle {
  const rng = rngFromSeed(`${pack.lang}|${seed}|${difficulty}`);
  let cfg = { ...DIFF[difficulty] };
  if (opts.given !== undefined) cfg.given = opts.given;
  const tierChoice = opts.tier ?? tierFor(difficulty);

  // Phrases candidates (les phrases du récit ne sortent jamais au hasard).
  let indices: number[];
  if (opts.phraseIndex !== undefined) {
    indices = [opts.phraseIndex];
  } else {
    const all = pack.phrases.map((_, i) => i).filter((i) => !isStory(pack, i));
    const byCat = opts.category ? all.filter((i) => pack.phrases[i].k === opts.category) : all;
    const base = byCat.length ? byCat : all;
    const fit = base.filter((i) => {
      const n = letterCount(pack.phrases[i].t);
      return n >= cfg.phraseMin && n <= cfg.phraseMax;
    });
    indices = shuffle(fit.length >= 2 ? fit : base, rng);
  }

  // Essais successifs, avec assouplissement progressif si aucune phrase ne passe.
  for (let relax = 0; relax < 4; relax++) {
    for (const pi of indices) {
      const phrase = pack.phrases[pi];
      const target = letterSet(phrase.t);
      const avoid = relax < 2 ? opts.avoid : undefined;
      const pool = shuffle(
        pack.entries.filter((e) => e.w.length >= cfg.minLen && e.w.length <= cfg.maxLen && !avoid?.has(e.w)),
        rng,
      );
      for (let attempt = 0; attempt < 6; attempt++) {
        const { chosen, uncovered } = greedyCover(target, pool, cfg, rng);
        if (uncovered.size > cfg.given) continue;

        // Compléter jusqu'au nombre minimum de mots avec des mots qui recoupent la phrase.
        const usedW = new Set(chosen.map((e) => e.w));
        const extras = pool.filter(
          (e) => !usedW.has(e.w) && [...new Set(e.w)].filter((l) => target.has(l)).length >= 2,
        );
        while (chosen.length < cfg.minWords && extras.length) {
          const e = extras.splice(Math.floor(rng() * extras.length), 1)[0];
          chosen.push(e);
          usedW.add(e.w);
        }
        if (chosen.length < Math.min(cfg.minWords, 3)) continue;

        // Lettres révélées : celles non couvertes, puis des lettres fréquentes de la phrase.
        const givenLetters = new Set(uncovered);
        const freq = new Map<string, number>();
        for (const ch of norm(phrase.t)) if (isAZ(ch)) freq.set(ch, (freq.get(ch) ?? 0) + 1);
        // Le bruit est tiré avant le tri : un comparateur qui appelle rng() dépend du nombre de
        // comparaisons, qui change d'un moteur JavaScript à l'autre (navigateur contre serveur).
        const byFreq = [...freq.entries()]
          .filter(([l]) => !givenLetters.has(l))
          .map(([l, f]) => [l, f + (rng() - 0.5) * 1.5] as const)
          .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
          .map(([l]) => l);
        while (givenLetters.size < cfg.given && byFreq.length) givenLetters.add(byFreq.shift()!);

        // Numérotation : uniquement les lettres utilisées, numéros 1..N mélangés.
        const used = new Set<string>(target);
        for (const e of chosen) for (const l of e.w) used.add(l);
        const order = shuffle([...used], rng);
        const letterToCode: Record<string, number> = {};
        const codeToLetter: Record<number, string> = {};
        order.forEach((l, i) => {
          letterToCode[l] = i + 1;
          codeToLetter[i + 1] = l;
        });

        const words: PuzzleWord[] = shuffle(chosen, rng).map((e) => {
          const { clue, tier } = pickClue(e, tierChoice, rng);
          return { clue, tier, answer: e.w, codes: [...e.w].map((l) => letterToCode[l]) };
        });

        return {
          id: `${pack.lang}-${hashString(seed + '|' + difficulty).toString(36)}`,
          lang: pack.lang,
          seed,
          category: phrase.k,
          phraseText: phrase.t,
          phraseIndex: pi,
          difficulty,
          rating: ratingFor(difficulty),
          phrase: buildPhraseCells(phrase.t, letterToCode),
          words,
          given: [...givenLetters].map((l) => letterToCode[l]).sort((a, b) => a - b),
          codeToLetter,
          maxCode: order.length,
          story: phrase.k === 'story' || undefined,
        };
      }
    }
    // Assouplir : plus de mots, mots plus longs, plus de lettres révélées.
    cfg = {
      ...cfg,
      maxWords: cfg.maxWords + 2,
      maxLen: cfg.maxLen + 2,
      minLen: 3,
      given: cfg.given + 1,
    };
    if (opts.phraseIndex === undefined) indices = shuffle(pack.phrases.map((_, i) => i).filter((i) => !isStory(pack, i)), rng);
  }
  throw new Error(`Impossible de générer une grille (${pack.lang}, ${seed}, d${difficulty})`);
}

// ---------- Modes de jeu ----------

const EPOCH = Date.UTC(2026, 0, 1);

export function dayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
}

export function difficultyForLength(n: number): Difficulty {
  if (n <= 20) return 2;
  if (n <= 28) return 3;
  if (n <= 40) return 4;
  return 5;
}

/** Défi du jour : même grille pour tous les joueurs d'une langue, phrases parcourues sans répétition. */
export function dailyPuzzle(pack: LangPack, dateStr: string): Puzzle {
  const pool = pack.phrases.map((_, i) => i).filter((i) => !isStory(pack, i));
  const n = pool.length;
  const cycle = Math.floor(dayIndex(dateStr) / n);
  const order = shuffle(pool, rngFromSeed(`order|${pack.lang}|${cycle}`));
  const pi = order[((dayIndex(dateStr) % n) + n) % n];
  const d = difficultyForLength(letterCount(pack.phrases[pi].t));
  return generatePuzzle(pack, `daily-${dateStr}`, d, { phraseIndex: pi });
}

export const LEVELS_PER_WORLD = 12;

export function levelDifficulty(level: number): Difficulty {
  if (level <= 6) return 1;
  if (level <= 18) return 2;
  if (level <= 36) return 3;
  if (level <= 60) return 4;
  return 5;
}

export function worldCategory(pack: LangPack, level: number): string {
  const cats = [...new Set(pack.phrases.filter((p) => !isReservedCat(p.k)).map((p) => p.k))];
  const w = Math.floor((level - 1) / LEVELS_PER_WORLD);
  return cats[w % cats.length];
}

export function levelPuzzle(pack: LangPack, level: number): Puzzle {
  return generatePuzzle(pack, `level-${level}`, levelDifficulty(level), {
    category: worldCategory(pack, level),
  });
}

export function practicePuzzle(pack: LangPack, difficulty: Difficulty, nonce: string): Puzzle {
  return generatePuzzle(pack, `practice-${nonce}`, difficulty);
}

/**
 * Cryptogramme pur : la phrase seule, chiffrée, sans mots indices.
 * Seules les lettres les plus fréquentes sont données au départ.
 */
export function cryptogramPuzzle(pack: LangPack, seed: string, difficulty: Difficulty, phraseIndex?: number): Puzzle {
  const rng = rngFromSeed(`crypto|${pack.lang}|${seed}|${difficulty}`);
  const minLen = difficulty >= 4 ? 26 : 18;
  const free = pack.phrases.map((_, i) => i).filter((i) => !isStory(pack, i));
  const candidates = free.filter((i) => letterCount(pack.phrases[i].t) >= minLen);
  const pool = candidates.length ? candidates : free;
  const pi = phraseIndex ?? pool[Math.floor(rng() * pool.length)];
  const phrase = pack.phrases[pi];
  const target = [...letterSet(phrase.t)];
  const order = shuffle(target, rng);
  const letterToCode: Record<string, number> = {};
  const codeToLetter: Record<number, string> = {};
  order.forEach((l, i) => {
    letterToCode[l] = i + 1;
    codeToLetter[i + 1] = l;
  });
  const freq = new Map<string, number>();
  for (const ch of norm(phrase.t)) if (isAZ(ch)) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const nGiven = { 1: 5, 2: 4, 3: 3, 4: 3, 5: 2 }[difficulty];
  const given = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, nGiven)
    .map(([l]) => letterToCode[l])
    .sort((a, b) => a - b);
  return {
    id: `${pack.lang}-c-${hashString(seed + '|' + difficulty).toString(36)}`,
    lang: pack.lang,
    seed,
    category: phrase.k,
    phraseText: phrase.t,
    phraseIndex: pi,
    difficulty,
    rating: ratingFor(difficulty) + 100,
    phrase: buildPhraseCells(phrase.t, letterToCode),
    words: [],
    given,
    codeToLetter,
    maxCode: order.length,
    cryptogram: true,
    story: phrase.k === 'story' || undefined,
  };
}

export interface ModSpec {
  /** Part des numéros des mots cachés sous l'encre (0 à 1). */
  ink?: number;
  fog?: boolean;
  chain?: boolean;
  smudge?: boolean;
}

/** Applique des altérations à une grille, de façon déterministe. */
export function applyMods(p: Puzzle, spec: ModSpec): Puzzle {
  const rng = rngFromSeed(`mods|${p.id}`);
  const mods: Mods = {};
  if (spec.ink && p.words.length) {
    const inWords = [...new Set(p.words.flatMap((w) => w.codes))].filter((c) => !p.given.includes(c));
    mods.ink = shuffle(inWords, rng).slice(0, Math.round(inWords.length * spec.ink)).sort((a, b) => a - b);
  }
  if (spec.fog) mods.fog = true;
  if (spec.chain && p.words.length > 1) mods.chain = true;
  let words = p.words;
  if (spec.smudge) {
    mods.smudge = true;
    words = p.words.map((w) => ({ ...w, shown: smudge(w.clue, rng) }));
  }
  return { ...p, words, mods };
}

/** Efface environ une lettre sur trois de l'indice, sans toucher au premier caractère de chaque mot. */
export function smudge(text: string, rng: Rng): string {
  let start = true;
  let out = '';
  for (const ch of text) {
    const letter = /\p{L}/u.test(ch);
    out += letter && !start && rng() < 0.28 ? '·' : ch;
    start = !letter;
  }
  return out;
}

/** Grille d'un niveau d'événement ou d'un pack : phrase imposée, graine propre. */
export function reservedPuzzle(pack: LangPack, key: string, phraseIndex: number, i: number, d: Difficulty): Puzzle {
  return generatePuzzle(pack, `${key}-${i}`, d, { phraseIndex });
}
