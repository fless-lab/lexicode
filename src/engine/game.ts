import type { Puzzle } from './types';

export type Sel = { kind: 'word'; w: number; i: number } | { kind: 'phrase'; i: number };

export interface GameState {
  puzzle: Puzzle;
  /** Lettre proposée par le joueur pour chaque numéro. */
  guesses: Record<number, string>;
  /** Numéros verrouillés (donnés au départ ou révélés par un indice). */
  locked: Record<number, true>;
  sel: Sel | null;
  mistakes: number;
  hints: number;
  oracle: number;
  startedAt: number;
  elapsedMs: number;
  finished: boolean;
  /** Nombre d'erreurs autorisées avant l'échec (null = illimité). */
  lives: number | null;
  failed: boolean;
  failReason: 'time' | 'mistakes' | null;
  /** Lettres justes d'affilée, et record de la partie. */
  combo: number;
  maxCombo: number;
  /** Erreurs absorbées par le bonus bouclier. */
  shield: number;
  /** Paires numéro|lettre déjà comptées comme erreur. */
  counted: Record<string, true>;
  /** Journal des coups [ms depuis le début, numéro, lettre] : le serveur le rejoue pour valider la partie. */
  log: [number, number, string][];
}

export function initGame(puzzle: Puzzle, now = Date.now(), lives: number | null = null): GameState {
  const guesses: Record<number, string> = {};
  const locked: Record<number, true> = {};
  for (const c of puzzle.given) {
    guesses[c] = puzzle.codeToLetter[c];
    locked[c] = true;
  }
  const s: GameState = {
    puzzle,
    guesses,
    locked,
    sel: null,
    mistakes: 0,
    hints: 0,
    oracle: 0,
    startedAt: now,
    elapsedMs: 0,
    finished: false,
    lives,
    failed: false,
    failReason: null,
    combo: 0,
    maxCombo: 0,
    shield: 0,
    counted: {},
    log: [],
  };
  s.sel = firstEmpty(s);
  return s;
}

export function codeAt(p: Puzzle, sel: Sel): number | null {
  if (sel.kind === 'word') return p.words[sel.w]?.codes[sel.i] ?? null;
  const cell = p.phrase[sel.i];
  return cell && cell.kind === 'letter' ? cell.code : null;
}

export function isCorrect(s: GameState, code: number): boolean {
  return s.guesses[code] === s.puzzle.codeToLetter[code];
}

export function isWrong(s: GameState, code: number): boolean {
  const g = s.guesses[code];
  return !!g && g !== s.puzzle.codeToLetter[code];
}

export function wordSolved(s: GameState, w: number): boolean {
  return s.puzzle.words[w].codes.every((c) => isCorrect(s, c));
}

export function phraseSolved(s: GameState): boolean {
  return s.puzzle.phrase.every((c) => c.kind === 'sep' || isCorrect(s, c.code));
}

export function progress(s: GameState): number {
  const cells = s.puzzle.phrase.filter((c) => c.kind === 'letter');
  const ok = cells.filter((c) => c.kind === 'letter' && isCorrect(s, c.code)).length;
  return cells.length ? ok / cells.length : 0;
}

function firstEmpty(s: GameState): Sel | null {
  const p = s.puzzle;
  for (let w = 0; w < p.words.length; w++) {
    const i = p.words[w].codes.findIndex((c) => !isCorrect(s, c));
    if (i >= 0) return { kind: 'word', w, i };
  }
  const i = p.phrase.findIndex((c) => c.kind === 'letter' && !isCorrect(s, c.code));
  return i >= 0 ? { kind: 'phrase', i } : null;
}

/** Case suivante à remplir après une saisie. */
function advance(s: GameState, from: Sel): Sel | null {
  const p = s.puzzle;
  if (from.kind === 'word') {
    const codes = p.words[from.w].codes;
    for (let k = from.i + 1; k < codes.length; k++) if (!isCorrect(s, codes[k])) return { kind: 'word', w: from.w, i: k };
    for (let k = 0; k < from.i; k++) if (!isCorrect(s, codes[k])) return { kind: 'word', w: from.w, i: k };
    for (let d = 1; d <= p.words.length; d++) {
      const w = (from.w + d) % p.words.length;
      const i = p.words[w].codes.findIndex((c) => !isCorrect(s, c));
      if (i >= 0) return { kind: 'word', w, i };
    }
    return firstEmpty(s);
  }
  for (let k = from.i + 1; k < p.phrase.length; k++) {
    const c = p.phrase[k];
    if (c.kind === 'letter' && !isCorrect(s, c.code)) return { kind: 'phrase', i: k };
  }
  return firstEmpty(s);
}

function finish(s: GameState, now: number): GameState {
  if (!s.finished && phraseSolved(s)) {
    // La phrase est trouvée : on complète aussi les mots pour l'affichage final.
    const guesses = { ...s.guesses };
    for (const [c, l] of Object.entries(s.puzzle.codeToLetter)) guesses[Number(c)] = l;
    return { ...s, guesses, finished: true, sel: null, elapsedMs: now - s.startedAt };
  }
  return s;
}

export function isOver(s: GameState): boolean {
  return s.finished || s.failed;
}

export function select(s: GameState, sel: Sel): GameState {
  return isOver(s) ? s : { ...s, sel };
}

export function failGame(s: GameState, reason: 'time' | 'mistakes', now = Date.now()): GameState {
  if (isOver(s)) return s;
  return { ...s, failed: true, failReason: reason, sel: null, elapsedMs: now - s.startedAt };
}

export function livesLeft(s: GameState): number | null {
  return s.lives === null ? null : Math.max(0, s.lives - s.mistakes);
}

export function typeLetter(s: GameState, letter: string, now = Date.now()): GameState {
  if (isOver(s) || !s.sel) return s;
  const code = codeAt(s.puzzle, s.sel);
  if (code === null || s.locked[code]) return { ...s, sel: advance(s, s.sel) };
  const right = letter === s.puzzle.codeToLetter[code];
  if (right && s.guesses[code] === letter) return { ...s, sel: advance(s, s.sel) };
  s = { ...s, log: [...s.log, [Math.max(0, now - s.startedAt), code, letter]] };
  let { mistakes, shield, combo, maxCombo } = s;
  const counted = { ...s.counted };
  const key = `${code}|${letter}`;
  // Avec un bouclier actif, la mauvaise lettre est refusée sans compter d'erreur.
  if (!right && shield > 0) return { ...s, shield: shield - 1, combo: 0 };
  const guesses = { ...s.guesses, [code]: letter };
  if (!right && !counted[key]) {
    mistakes++;
    counted[key] = true;
  }
  if (right) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else combo = 0;
  const next: GameState = { ...s, guesses, mistakes, counted, combo, maxCombo };
  if (s.lives !== null && mistakes >= s.lives) return failGame(next, 'mistakes', now);
  const sel = letter === s.puzzle.codeToLetter[code] ? advance(next, s.sel!) : s.sel;
  return finish({ ...next, sel }, now);
}

export function erase(s: GameState): GameState {
  if (isOver(s) || !s.sel) return s;
  const code = codeAt(s.puzzle, s.sel);
  if (code === null || s.locked[code]) return s;
  const guesses = { ...s.guesses };
  delete guesses[code];
  return { ...s, guesses };
}

export function revealCode(s: GameState, code: number, now = Date.now()): GameState {
  if (isOver(s)) return s;
  const guesses = { ...s.guesses, [code]: s.puzzle.codeToLetter[code] };
  const locked = { ...s.locked, [code]: true as const };
  const next = { ...s, guesses, locked, hints: s.hints + 1, combo: 0, log: [...s.log, [Math.max(0, now - s.startedAt), code, '?'] as [number, number, string]] };
  return finish({ ...next, sel: s.sel ? advance(next, s.sel) : null }, now);
}

/** Révèle la lettre de la case sélectionnée (ou la première manquante). */
export function revealSelected(s: GameState, now = Date.now()): GameState {
  const sel = s.sel ?? firstEmpty(s);
  if (!sel) return s;
  const code = codeAt(s.puzzle, sel);
  if (code === null || isCorrect(s, code)) return s;
  return revealCode({ ...s, sel }, code, now);
}

export function revealWord(s: GameState, w: number, now = Date.now()): GameState {
  if (isOver(s)) return s;
  const guesses = { ...s.guesses };
  const locked = { ...s.locked };
  for (const c of s.puzzle.words[w].codes) {
    guesses[c] = s.puzzle.codeToLetter[c];
    locked[c] = true;
  }
  const next = { ...s, guesses, locked, hints: s.hints + 3, combo: 0 };
  return finish({ ...next, sel: advance(next, { kind: 'word', w, i: 0 }) }, now);
}

/** Bonus révélation : dévoile jusqu'à n lettres manquantes de la phrase, sans compter d'indice. */
export function revealPhraseLetters(s: GameState, n: number, now = Date.now()): GameState {
  if (isOver(s)) return s;
  const missing = [...new Set(s.puzzle.phrase.filter((c) => c.kind === 'letter' && !isCorrect(s, c.code)).map((c) => (c as { code: number }).code))];
  const pick = missing.slice(0, n);
  const guesses = { ...s.guesses };
  const locked = { ...s.locked };
  for (const c of pick) {
    guesses[c] = s.puzzle.codeToLetter[c];
    locked[c] = true;
  }
  const next = { ...s, guesses, locked };
  return finish({ ...next, sel: s.sel ? advance(next, s.sel) : firstEmpty(next) }, now);
}

export function addShield(s: GameState, n = 1): GameState {
  return { ...s, shield: s.shield + n };
}

/** Lettres déjà utilisées pour un autre numéro (aide visuelle sur le clavier). */
export function usedLetters(s: GameState): Set<string> {
  const out = new Set<string>();
  for (const [c, l] of Object.entries(s.guesses)) if (isCorrect(s, Number(c))) out.add(l);
  return out;
}

/** Score sur 1000 : temps, erreurs et indices pénalisent. */
export function computeScore(s: GameState): number {
  const secs = s.elapsedMs / 1000;
  const par = 40 + s.puzzle.words.length * 25;
  const timePenalty = Math.max(0, secs - par) * 1.2;
  const comboBonus = Math.min(250, s.maxCombo * 10);
  const raw = 1000 + comboBonus - timePenalty - s.mistakes * 40 - s.hints * 60 - s.oracle * 30;
  return Math.max(100, Math.round(raw));
}

export function stars(s: GameState): 1 | 2 | 3 {
  const sc = computeScore(s);
  if (sc >= 850 && s.hints === 0 && s.mistakes <= 1) return 3;
  if (sc >= 550) return 2;
  return 1;
}

/** Recherche par motif : "S_L_T" trouve SALUT dans le lexique. */
export function oracleSearch(pattern: string, lexicon: string[], limit = 12): string[] {
  const p = pattern.toUpperCase();
  const out: string[] = [];
  for (const w of lexicon) {
    if (w.length !== p.length) continue;
    let ok = true;
    for (let i = 0; i < p.length; i++) if (p[i] !== '_' && p[i] !== w[i]) { ok = false; break; }
    if (ok) out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

export function wordPattern(s: GameState, w: number): string {
  return s.puzzle.words[w].codes.map((c) => (isCorrect(s, c) ? s.guesses[c] : '_')).join('');
}

/** Case qui porte ce numéro (dans un mot de préférence, sinon dans la phrase). */
export function selFor(p: Puzzle, code: number): Sel | null {
  for (let w = 0; w < p.words.length; w++) {
    const i = p.words[w].codes.indexOf(code);
    if (i >= 0) return { kind: 'word', w, i };
  }
  const i = p.phrase.findIndex((c) => c.kind === 'letter' && c.code === code);
  return i >= 0 ? { kind: 'phrase', i } : null;
}

/**
 * Rejoue une partie à partir de son journal, avec exactement les règles du jeu.
 * Utilisé par le serveur pour recalculer le résultat au lieu de croire le téléphone.
 */
export function replay(puzzle: Puzzle, log: [number, number, string][], lives: number | null = null): GameState {
  let s = initGame(puzzle, 0, lives);
  let last = -1;
  for (const [t, code, letter] of log) {
    if (isOver(s)) break;
    if (t < last) return failGame(s, 'mistakes', last);
    last = t;
    if (letter === '?') {
      s = revealCode(s, code, t);
      continue;
    }
    const sel = selFor(puzzle, code);
    if (!sel) continue;
    s = typeLetter(select(s, sel), letter, t);
  }
  return s;
}
