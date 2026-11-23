import { allClues, type LangPack, type Puzzle } from './types';
import { norm, isAZ } from './text';
import { initGame, select, typeLetter, phraseSolved, wordSolved } from './game';
import { DIFF } from './generator';

/** Contrôle complet d'une grille. Retourne la liste des problèmes (vide = grille valide). */
export function verifyPuzzle(p: Puzzle, pack: LangPack): string[] {
  const errs: string[] = [];

  // 1. Bijection lettre <-> numéro, numéros 1..N.
  const seen = new Set<string>();
  for (let c = 1; c <= p.maxCode; c++) {
    const l = p.codeToLetter[c];
    if (!l || !isAZ(l)) errs.push(`numéro ${c} sans lettre`);
    else if (seen.has(l)) errs.push(`lettre ${l} sur deux numéros`);
    else seen.add(l);
  }
  if (Object.keys(p.codeToLetter).length !== p.maxCode) errs.push('numérotation incohérente');

  // 2. La phrase se reconstruit à l'identique.
  const rebuilt = p.phrase.map((c) => (c.kind === 'letter' ? p.codeToLetter[c.code] : c.ch)).join('');
  if (norm(rebuilt) !== norm(p.phraseText)) errs.push('phrase mal encodée');

  // 3. Chaque mot correspond à son indice dans le pack et à ses numéros.
  const answers = new Set<string>();
  for (const w of p.words) {
    const entry = pack.entries.find((e) => e.w === w.answer && allClues(e).includes(w.clue));
    if (!entry) errs.push(`mot ${w.answer} absent du pack`);
    if (answers.has(w.answer)) errs.push(`mot ${w.answer} en double`);
    answers.add(w.answer);
    const dec = w.codes.map((c) => p.codeToLetter[c]).join('');
    if (dec !== w.answer) errs.push(`mot ${w.answer} mal encodé (${dec})`);
  }

  // 4. Couverture : chaque lettre de la phrase est apprise par un mot ou donnée.
  const known = new Set<number>(p.given);
  for (const w of p.words) for (const c of w.codes) known.add(c);
  if (!p.cryptogram)
    for (const cell of p.phrase) {
      if (cell.kind === 'letter' && !known.has(cell.code)) errs.push(`lettre ${cell.n} impossible à trouver`);
    }

  // 5. Bornes de difficulté (avec la marge d'assouplissement du générateur).
  const cfg = DIFF[p.difficulty];
  if (!p.cryptogram && p.words.length === 0) errs.push('aucun mot');
  if (p.words.length > cfg.maxWords + 6) errs.push(`trop de mots (${p.words.length})`);
  if (p.given.length > cfg.given + 4) errs.push(`trop de lettres données (${p.given.length})`);

  // 6. Partie simulée : un joueur parfait remplit les mots un par un et doit gagner.
  let s = initGame(p, 0);
  for (let w = 0; w < p.words.length && !s.finished; w++) {
    for (let i = 0; i < p.words[w].codes.length && !s.finished; i++) {
      s = select(s, { kind: 'word', w, i });
      s = typeLetter(s, p.words[w].answer[i], 1000);
    }
    if (!s.finished && !wordSolved(s, w)) errs.push(`mot ${w} non résolu en simulation`);
  }
  // Cryptogramme (ou fin de grille) : le joueur complète la phrase case par case.
  for (let i = 0; i < p.phrase.length && !s.finished; i++) {
    const c = p.phrase[i];
    if (c.kind !== 'letter') continue;
    s = select(s, { kind: 'phrase', i });
    s = typeLetter(s, c.n, 1000);
  }
  if (!s.finished || !phraseSolved(s)) errs.push('partie simulée non gagnée');
  if (s.mistakes !== 0) errs.push('erreurs comptées pour un joueur parfait');

  return errs;
}

/** Contrôle du contenu d'un pack, indépendamment des grilles. */
export function verifyPack(pack: LangPack): string[] {
  const errs: string[] = [];
  const words = new Set<string>();
  const clues = new Set<string>();
  for (const e of pack.entries) {
    if (!/^[A-Z]{3,}$/.test(e.w)) errs.push(`réponse invalide: ${e.w}`);
    if (words.has(e.w)) errs.push(`réponse en double: ${e.w}`);
    for (const c of allClues(e)) {
      if (!c) continue;
      if (clues.has(c)) errs.push(`indice en double: ${c}`);
      if (/—/.test(c)) errs.push(`tiret cadratin: ${c}`);
      if (norm(c).replace(/[^A-Z]/g, ' ').split(' ').includes(e.w)) errs.push(`la réponse apparaît dans l'indice: ${e.w} / ${c}`);
      clues.add(c);
    }
    words.add(e.w);
  }
  for (const ph of pack.phrases) {
    for (const ch of ph.t) {
      const n = norm(ch);
      if (/[a-zA-Z]/.test(ch) || /\p{L}/u.test(ch)) {
        if (!(n.length === 1 && isAZ(n))) errs.push(`caractère non pris en charge "${ch}" dans: ${ph.t}`);
      }
    }
  }
  return errs;
}
