// Circuit de validation : chaque indice joué doit avoir été validé
// (résolution à l'aveugle par un agent indépendant + jugement du sens et des faits).
import type { Entry, Lang, Tier } from '../engine/types';
import fr from './review/fr.json';
import en from './review/en.json';
import es from './review/es.json';

export interface ReviewEntry {
  /** ok : validé tel quel. fixed : remplacé par la correction validée. rejected : retiré. */
  s: 'ok' | 'fixed' | 'rejected';
  /** Niveau recalibré. */
  t?: Tier;
  /** Texte corrigé (si s = fixed). */
  f?: string;
}

export type Review = Record<string, ReviewEntry>;

export const REVIEWS: Record<Lang, Review> = { fr: fr as Review, en: en as Review, es: es as Review };

export const reviewKey = (word: string, clue: string) => `${word}|${clue}`;

/** Vrai quand un fichier de validation existe pour la langue (sinon on joue en mode brouillon). */
export function hasReview(lang: Lang): boolean {
  return Object.keys(REVIEWS[lang]).length > 0;
}

/**
 * Applique la validation : retire les indices rejetés, remplace les indices corrigés,
 * replace chaque indice à son niveau recalibré. Un indice absent du fichier n'est pas joué.
 * Un mot sans aucun indice valide disparaît du lexique.
 */
export function applyReview(lang: Lang, entries: Entry[]): Entry[] {
  if (!hasReview(lang)) return entries;
  const r = REVIEWS[lang];
  const out: Entry[] = [];
  // Deux mots ne partagent jamais un indice : une correction peut tomber sur l'indice d'un autre mot.
  const seen = new Set<string>();
  for (const e of entries) {
    const tiers: Record<Tier, string[]> = { 1: [], 2: [], 3: [] };
    const push = (clue: string | undefined, tier: Tier) => {
      if (!clue) return;
      const rev = r[reviewKey(e.w, clue)];
      if (!rev || rev.s === 'rejected') return;
      const text = rev.s === 'fixed' && rev.f ? rev.f : clue;
      if (seen.has(text)) return;
      seen.add(text);
      tiers[rev.t ?? tier].push(text);
    };
    push(e.c, 1);
    push(e.c2, 2);
    push(e.c3, 3);
    for (const c of e.more2 ?? []) push(c, 2);
    for (const c of e.more3 ?? []) push(c, 3);
    // Il faut au moins un indice facile ou moyen pour que le mot reste jouable à tous les niveaux.
    const base = tiers[1][0] ?? tiers[2][0];
    if (!base) continue;
    const t1 = tiers[1].length ? tiers[1] : [];
    out.push({
      w: e.w,
      c: base,
      c2: tiers[2].find((x) => x !== base),
      c3: tiers[3][0],
      more2: tiers[2].filter((x) => x !== base).slice(1).concat(t1.slice(1)),
      more3: tiers[3].slice(1),
    });
  }
  return out;
}

/** Clé d'un indice publié, pour le contrôle du vérificateur. */
export function isValidated(lang: Lang, word: string, clue: string): boolean {
  if (!hasReview(lang)) return false;
  return Object.entries(REVIEWS[lang]).some(([k, v]) => k.startsWith(`${word}|`) && v.s !== 'rejected' && (v.s === 'fixed' ? v.f === clue : k === reviewKey(word, clue)));
}
