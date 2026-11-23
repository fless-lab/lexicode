export type Lang = 'fr' | 'en' | 'es';

/** Une paire indice / réponse. La réponse est en majuscules A-Z sans accents. */
export interface Entry {
  w: string;
  /** Indice facile (définition directe). */
  c: string;
  /** Indice moyen (culture, périphrase). */
  c2?: string;
  /** Indice malin (jeu de mots, expression, double sens). */
  c3?: string;
}

export type Tier = 1 | 2 | 3;

/** Altérations qui compliquent une grille (chapitres, expédition). */
export interface Mods {
  /** Numéros cachés sous l'encre dans les mots, révélés quand la lettre est trouvée. */
  ink?: number[];
  /** Brume : les numéros de la phrase sont cachés tant que la lettre n'est pas trouvée. */
  fog?: boolean;
  /** Indices enchaînés : chaque indice s'ouvre quand le mot précédent est résolu. */
  chain?: boolean;
  /** Indices délavés : certaines lettres de l'indice sont effacées. */
  smudge?: boolean;
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
  tier: Tier;
  /** Indice tel qu'affiché (délavé si l'altération est active). */
  shown?: string;
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
  mods?: Mods;
  /** Phrase du récit de l'aventure. */
  story?: boolean;
}
