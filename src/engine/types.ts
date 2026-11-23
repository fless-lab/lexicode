export type Lang = 'fr' | 'en' | 'es';

/** Une paire indice / réponse. La réponse est en majuscules A-Z sans accents. */
export interface Entry {
  w: string;
  c: string;
}

/** Une phrase cachée. `k` est la catégorie (proverb, fact). */
export interface PhraseDef {
  t: string;
  k: string;
}

export interface LangPack {
  lang: Lang;
  entries: Entry[];
  phrases: PhraseDef[];
}

export interface PuzzleWord {
  clue: string;
  answer: string;
  codes: number[];
}

export type PhraseCell =
  | { kind: 'letter'; n: string; shown: string; code: number }
  | { kind: 'sep'; ch: string };

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Puzzle {
  id: string;
  lang: Lang;
  seed: string;
  category: string;
  phraseText: string;
  phraseIndex: number;
  difficulty: Difficulty;
  /** Cote de difficulté utilisée pour l'indice de réflexion (type Elo). */
  rating: number;
  phrase: PhraseCell[];
  words: PuzzleWord[];
  /** Codes révélés au départ. */
  given: number[];
  codeToLetter: Record<number, string>;
  maxCode: number;
  /** Cryptogramme pur : pas de mots indices, la phrase seule. */
  cryptogram?: boolean;
}
