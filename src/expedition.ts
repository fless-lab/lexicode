// L'Expédition : descente infinie et procédurale. Chaque étage est généré à partir
// de la graine de l'expédition et de sa profondeur : lieu, palette, altérations.
import type { CSSProperties } from 'react';
import type { Difficulty, Lang, LangPack, Puzzle } from './engine/types';
import { rngFromSeed, shuffle } from './engine/rng';
import { generatePuzzle, cryptogramPuzzle, applyMods, type ModSpec, type TierChoice } from './engine/generator';

export type ModId = 'ink' | 'fog' | 'chain' | 'smudge' | 'timer' | 'cryptic' | 'bare' | 'cipher';
export type RelicId = 'heart' | 'hourglass' | 'lantern' | 'quill' | 'inkwell' | 'compass' | 'prism' | 'seal';

export const RELICS: RelicId[] = ['heart', 'hourglass', 'lantern', 'quill', 'inkwell', 'compass', 'prism', 'seal'];
export const START_HEARTS = 3;
export const MAX_HEARTS = 6;

export interface Run {
  seed: string;
  daily: boolean;
  depth: number;
  hearts: number;
  relics: RelicId[];
}

export interface Floor {
  depth: number;
  d: Difficulty;
  mods: ModId[];
  place: number;
  qual: number;
  hue: number;
  timeMs: number | null;
}

const PLACES: Record<Lang, string[]> = {
  fr: ["L'atelier noyé", 'La Crypte', 'La Galerie des cartes', 'La Serre d’Ada', 'La Citerne', 'Le Scriptorium', 'La Volière', 'Le Belvédère', 'La Chapelle', 'La Chambre forte', 'La Rotonde', 'Le Cloître', 'La Forge', "L'Orangerie", 'Le Puits'],
  en: ['Ada’s workshop', 'The Crypt', 'The Map Gallery', 'The Glasshouse', 'The Cistern', 'The Scriptorium', 'The Aviary', 'The Lookout', 'The Chapel', 'The Vault', 'The Rotunda', 'The Cloister', 'The Forge', 'The Orangery', 'The Well'],
  es: ['El taller sumergido', 'La Cripta', 'La Galería de mapas', 'El invernadero de Ada', 'La Cisterna', 'El Scriptorium', 'La Pajarera', 'El Mirador', 'La Capilla', 'La Cámara acorazada', 'La Rotonda', 'El Claustro', 'La Forja', 'El Naranjal', 'El Pozo'],
};

const QUALS: Record<Lang, string[]> = {
  fr: ['des miroirs', 'de verre', 'des horloges', 'aux mille portes', 'de sel', 'sans fenêtres', 'des échos', 'de cuivre', 'des marées', 'de brume', 'des cartographes', 'du silence', 'des lanternes', "d'ardoise", 'des automates'],
  en: ['of Mirrors', 'of Glass', 'of Clocks', 'of a Thousand Doors', 'of Salt', 'Without Windows', 'of Echoes', 'of Copper', 'of Tides', 'of Fog', 'of Mapmakers', 'of Silence', 'of Lanterns', 'of Slate', 'of Automatons'],
  es: ['de los espejos', 'de cristal', 'de los relojes', 'de las mil puertas', 'de sal', 'sin ventanas', 'de los ecos', 'de cobre', 'de las mareas', 'de niebla', 'de los cartógrafos', 'del silencio', 'de los faroles', 'de pizarra', 'de los autómatas'],
};

export function floorName(lang: Lang, f: Floor): string {
  return `${PLACES[lang][f.place]} ${QUALS[lang][f.qual]}`;
}

/** Les altérations arrivent progressivement, puis se cumulent. */
const MOD_UNLOCK: [ModId, number][] = [
  ['timer', 1],
  ['ink', 2],
  ['cryptic', 3],
  ['chain', 4],
  ['smudge', 5],
  ['bare', 6],
  ['fog', 8],
  ['cipher', 10],
];

export function makeFloor(seed: string, depth: number): Floor {
  const rng = rngFromSeed(`floor|${seed}|${depth}`);
  const d = Math.min(5, 1 + Math.floor(depth / 3)) as Difficulty;
  const pool = MOD_UNLOCK.filter(([, at]) => depth >= at).map(([m]) => m);
  const count = Math.min(pool.length, depth === 0 ? 0 : 1 + Math.floor(depth / 4));
  let mods = shuffle(pool, rng).slice(0, count);
  // Un étage sur cinq est un sanctuaire : plus calme, pour respirer.
  if (depth > 0 && depth % 5 === 4) mods = mods.slice(0, 1);
  // Le cryptogramme remplace les mots : chaîne, encre et indices n'ont plus d'objet.
  if (mods.includes('cipher')) mods = mods.filter((m) => !['chain', 'ink', 'smudge', 'cryptic'].includes(m));
  const timeMs = mods.includes('timer') ? Math.max(70_000, 200_000 - depth * 5_000) : null;
  return { depth, d, mods, place: Math.floor(rng() * 15), qual: Math.floor(rng() * 15), hue: Math.floor(rng() * 360), timeMs };
}

export function floorPuzzle(pack: LangPack, run: Run, f: Floor): Puzzle {
  const seed = `exp-${run.seed}-${f.depth}`;
  const has = (r: RelicId) => run.relics.includes(r);
  if (f.mods.includes('cipher')) return applyMods(cryptogramPuzzle(pack, seed, f.d), { fog: f.mods.includes('fog') && !has('compass') });
  let tier: TierChoice = f.mods.includes('cryptic') ? 3 : f.d >= 4 ? 'mix' : f.d >= 3 ? 2 : 1;
  if (has('prism') && tier !== 1) tier = 2;
  const p = generatePuzzle(pack, seed, f.d, { tier, given: f.mods.includes('bare') ? 0 : undefined });
  const spec: ModSpec = {
    ink: f.mods.includes('ink') && !has('inkwell') ? Math.min(0.55, 0.25 + f.depth * 0.015) : undefined,
    fog: f.mods.includes('fog') && !has('compass'),
    chain: f.mods.includes('chain'),
    smudge: f.mods.includes('smudge'),
  };
  return applyMods(p, spec);
}

/** Trois reliques proposées après chaque étage, jamais deux fois la même dans l'offre. */
export function relicOffer(run: Run): RelicId[] {
  const rng = rngFromSeed(`relics|${run.seed}|${run.depth}`);
  const unique: RelicId[] = ['inkwell', 'compass', 'prism'];
  const pool = RELICS.filter((r) => !(unique.includes(r) && run.relics.includes(r)) && !(r === 'heart' && run.hearts >= MAX_HEARTS));
  return shuffle(pool, rng).slice(0, 3);
}

export function count(run: Run, r: RelicId): number {
  return run.relics.filter((x) => x === r).length;
}

/** Palette procédurale de l'étage. */
export function floorPalette(hue: number): CSSProperties {
  const acc = (hue + 160) % 360;
  return {
    '--abyss': `hsl(${hue} 42% 9%)`,
    '--deep': `hsl(${hue} 36% 14%)`,
    '--tide': `hsl(${hue} 32% 20%)`,
    '--tide-2': `hsl(${hue} 30% 27%)`,
    '--line': `hsl(${acc} 50% 60% / .2)`,
    '--brass': `hsl(${acc} 55% 62%)`,
    '--brass-hi': `hsl(${acc} 70% 74%)`,
    '--brass-lo': `hsl(${acc} 40% 42%)`,
    '--mist': `hsl(${hue} 18% 66%)`,
  } as CSSProperties;
}
