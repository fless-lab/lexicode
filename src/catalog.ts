// Catalogue de la boutique. Chaque objet a un prix (jetons ou magasin) ou une condition
// pour être gagné en jouant. Rien ici ne donne d'avantage dans les modes classés.
import type { Lang } from './engine/types';
import type { HatId, NeckId, LoupeId, Outfit } from './ui/mascot';
import type { SkinId } from './meta';
import { SKUS, type Sku } from './services/billing';
import type { Save } from './storage';

export type ItemKind = 'hat' | 'neck' | 'loupe' | 'back' | 'skin' | 'keyboard' | 'effect' | 'frame' | 'decor' | 'pack';
export type KeyboardId = 'classic' | 'typewriter' | 'wood' | 'neon' | 'frost';
export type EffectId = 'letters' | 'ink' | 'fireworks' | 'snow';
export type FrameId = 'laurel' | 'star' | 'flame' | 'northstar';
export type DecorId = 'home' | 'tower' | 'train' | 'observatory';

/** Comment on obtient un objet sans le payer. */
export type Unlock =
  | { chapter: number }
  | { league: number }
  | { event: string }
  | { adventureDone: true };

export interface Item {
  /** Identifiant unique, de la forme « type:valeur ». */
  id: string;
  kind: ItemKind;
  value: string;
  name: Record<Lang, string>;
  tokens?: number;
  sku?: Sku;
  unlock?: Unlock;
  /** Niveau de joueur requis avant de pouvoir l'acheter en jetons (objets rares). */
  minLevel?: number;
  /** Offert à tous dès le départ. */
  free?: boolean;
  /** Pas encore disponible (contenu en préparation). */
  soon?: boolean;
}

const N = (fr: string, en: string, es: string): Record<Lang, string> => ({ fr, en, es });
const it = (kind: ItemKind, value: string, name: Record<Lang, string>, extra: Partial<Item> = {}): Item => ({ id: `${kind}:${value}`, kind, value, name, ...extra });

export const ITEMS: Item[] = [
  // Tenues de Loupi
  it('hat', 'deerstalker', N('Casquette de détective', 'Detective cap', 'Gorra de detective'), { sku: SKUS.outfitDetective }),
  it('hat', 'beret', N('Béret de peintre', "Painter's beret", 'Boina de pintor'), { tokens: 400, minLevel: 12 }),
  it('hat', 'conductor', N('Casquette de chef de gare', "Conductor's cap", 'Gorra de jefe de estación'), { unlock: { chapter: 3 } }),
  it('hat', 'tophat', N('Haut-de-forme', 'Top hat', 'Sombrero de copa'), { sku: SKUS.outfitTophat }),
  it('hat', 'santa', N('Bonnet de Noël', 'Santa hat', 'Gorro navideño'), { unlock: { event: 'xmas-2026' } }),
  it('neck', 'scarf', N('Écharpe ambrée', 'Amber scarf', 'Bufanda ámbar'), { free: true }),
  it('neck', 'none', N('Sans rien', 'Nothing', 'Nada'), { free: true }),
  it('neck', 'bowtie', N('Nœud papillon', 'Bow tie', 'Pajarita'), { tokens: 200, minLevel: 3 }),
  it('neck', 'scarf_xmas', N('Écharpe de Noël', 'Holiday scarf', 'Bufanda navideña'), { unlock: { event: 'xmas-2026' } }),
  it('loupe', 'gold', N('Loupe dorée', 'Golden loupe', 'Lupa dorada'), { free: true }),
  it('loupe', 'crystal', N('Loupe de cristal', 'Crystal loupe', 'Lupa de cristal'), { sku: SKUS.loupeCrystal }),
  it('loupe', 'steam', N('Loupe à vapeur', 'Steam loupe', 'Lupa de vapor'), { unlock: { chapter: 6 } }),
  it('back', 'cape', N('Cape du Cabinet noir', 'Black Cabinet cape', 'Capa del Gabinete negro'), { unlock: { adventureDone: true } }),
  // Tuiles (la possession des tuiles reste dans save.skins)
  it('skin', 'ivory', N('Ivoire', 'Ivory', 'Marfil'), { free: true }),
  it('skin', 'frost', N('Givre', 'Frost', 'Escarcha'), { tokens: 300, minLevel: 10 }),
  it('skin', 'ruby', N('Rubis', 'Ruby', 'Rubí'), { sku: SKUS.skinRuby }),
  it('skin', 'obsidian', N('Obsidienne', 'Obsidian', 'Obsidiana'), { tokens: 600, minLevel: 20 }),
  it('skin', 'gingerbread', N("Pain d'épices", 'Gingerbread', 'Jengibre'), { unlock: { event: 'xmas-2026' } }),
  // Claviers
  it('keyboard', 'classic', N('Classique', 'Classic', 'Clásico'), { free: true }),
  it('keyboard', 'typewriter', N('Machine à écrire', 'Typewriter', 'Máquina de escribir'), { tokens: 500, minLevel: 15 }),
  it('keyboard', 'wood', N('Bois verni', 'Varnished wood', 'Madera barnizada'), { sku: SKUS.kbWood }),
  it('keyboard', 'neon', N('Néon', 'Neon', 'Neón'), { sku: SKUS.kbNeon }),
  it('keyboard', 'frost', N('Givré', 'Frosted', 'Escarchado'), { unlock: { event: 'xmas-2026' } }),
  // Effets de victoire
  it('effect', 'letters', N('Pluie de lettres', 'Letter rain', 'Lluvia de letras'), { free: true }),
  it('effect', 'ink', N("Éclaboussures d'encre", 'Ink splashes', 'Salpicaduras de tinta'), { tokens: 350, minLevel: 8 }),
  it('effect', 'fireworks', N("Feu d'artifice", 'Fireworks', 'Fuegos artificiales'), { sku: SKUS.fxFireworks }),
  it('effect', 'snow', N('Victoire sous la neige', 'Snowfall victory', 'Victoria nevada'), { unlock: { event: 'xmas-2026' } }),
  // Cadres
  it('frame', 'laurel', N('Lauriers', 'Laurels', 'Laureles'), { tokens: 250, minLevel: 5 }),
  it('frame', 'star', N('Étoile', 'Star', 'Estrella'), { unlock: { league: 2 } }),
  it('frame', 'flame', N('Flammes', 'Flames', 'Llamas'), { sku: SKUS.frameFlame }),
  it('frame', 'northstar', N('Étoile du Nord', 'North Star', 'Estrella polar'), { unlock: { event: 'xmas-2026' } }),
  // Décors de l'accueil
  it('decor', 'home', N('Les toits', 'The rooftops', 'Los tejados'), { free: true }),
  it('decor', 'tower', N('La tour du chiffre', 'Cipher Tower', 'La torre del cifrado'), { tokens: 800, minLevel: 25 }),
  it('decor', 'train', N('Le viaduc', 'The viaduct', 'El viaducto'), { sku: SKUS.decorTrain }),
  it('decor', 'observatory', N('La coupole', 'The dome', 'La cúpula'), { unlock: { chapter: 5 } }),
  // Packs de grilles
  it('pack', 'proverbs', N('Proverbes', 'Proverbs', 'Refranes'), { sku: SKUS.packProverbs, tokens: 1200 }),
  it('pack', 'cinema', N('Cinéma', 'Cinema', 'Cine'), { sku: SKUS.packCinema, tokens: 1200 }),
  it('pack', 'football', N('Football', 'Football', 'Fútbol'), { sku: SKUS.packFootball, tokens: 1200 }),
  it('pack', 'geography', N('Géographie', 'Geography', 'Geografía'), { sku: SKUS.packGeography, tokens: 1200 }),
  it('pack', 'africa', N("Contes et cultures d'Afrique", 'Tales and cultures of Africa', 'Cuentos y culturas de África'), { sku: SKUS.packAfrica, tokens: 1200 }),
];

export const item = (id: string) => ITEMS.find((i) => i.id === id);

/** Lots vendus d'un coup sur le magasin. */
export const BUNDLES: { sku: Sku; items: string[]; tokens?: number; boosters?: number; once?: boolean }[] = [
  { sku: SKUS.bundleGentleman, items: ['hat:tophat', 'neck:bowtie', 'loupe:crystal'] },
  { sku: SKUS.starter, items: ['hat:deerstalker'], tokens: 500, boosters: 3, once: true },
];

export const TOKEN_PACKS: { sku: Sku; tokens: number; bonus: string }[] = [
  { sku: SKUS.tok120, tokens: 120, bonus: '' },
  { sku: SKUS.tok650, tokens: 650, bonus: '+10 %' },
  { sku: SKUS.tok1400, tokens: 1400, bonus: '+20 %' },
];

export const CHAPTER_LEVELS = 12;

export function owns(s: Save, id: string): boolean {
  const i = item(id);
  if (!i) return false;
  if (i.free) return true;
  if (i.kind === 'skin') return s.skins.includes(i.value as SkinId);
  return s.owned.includes(id);
}

/** Vrai quand la condition de jeu est remplie (l'objet est alors accordé automatiquement). */
export function unlockMet(s: Save, lang: Lang, u: Unlock): boolean {
  const level = s.campaign[lang]?.level ?? 1;
  if ('chapter' in u) return level > (u.chapter - 1) * CHAPTER_LEVELS;
  if ('league' in u) return s.league.tier >= u.league;
  if ('adventureDone' in u) return level > 8 * CHAPTER_LEVELS;
  return false;
}

/** Accorde tous les objets dont la condition de jeu est remplie. */
export function grantUnlocks(s: Save, lang: Lang): Save {
  const add = ITEMS.filter((i) => i.unlock && !('event' in i.unlock) && !owns(s, i.id) && unlockMet(s, lang, i.unlock)).map((i) => i.id);
  return add.length ? grant(s, add) : s;
}

export function grant(s: Save, ids: string[]): Save {
  const skins = new Set(s.skins);
  const owned = new Set(s.owned);
  for (const id of ids) {
    const i = item(id);
    if (!i) continue;
    if (i.kind === 'skin') skins.add(i.value as SkinId);
    else owned.add(id);
  }
  return { ...s, skins: [...skins], owned: [...owned] };
}

/** Tenue que porte Loupi, d'après ce qui est équipé. */
export function outfitOf(s: Save): Outfit {
  const e = s.equip;
  return { hat: e.hat as HatId | undefined, neck: e.neck as NeckId, loupe: e.loupe as LoupeId, back: e.back as 'cape' | undefined };
}

/** Objets que l'on peut acheter cette semaine en vitrine : la sélection change chaque lundi. */
export function weeklyShowcase(week: string): string[] {
  const pool = ITEMS.filter((i) => (i.sku || i.tokens) && i.kind !== 'pack').map((i) => i.id);
  let h = 0;
  for (const c of week) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}
