import { allClues, type Entry, type Lang, type LangPack } from '../engine/types';
import { norm } from '../engine/text';
import { fr } from './fr';
import { en } from './en';
import { es } from './es';
import { LEX_FR } from './lex-fr';
import { LEX_EN } from './lex-en';
import { LEX_ES } from './lex-es';
import { STORY } from './story';
import { EVENT_PHRASES, PACK_PHRASES } from './extra';
import { LEX_FR_MORE, EXTRA_FR } from './lex-fr-2';
import { LEX_EN_MORE, EXTRA_EN } from './lex-en-2';
import { LEX_ES_MORE, EXTRA_ES } from './lex-es-2';
import { applyReview } from './review';

/** Lit un lexique « MOT|facile|moyen|malin ». */
export function parseLex(src: string): Entry[] {
  return src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [w0, c, c2, c3] = l.split('|');
      const w = w0.trim();
      const fix = (x?: string) => (x?.trim() ? blankAnswer(x.trim(), w) : undefined);
      return { w, c: fix(c)!, c2: fix(c2), c3: fix(c3) };
    });
}

/** Remplace la réponse par « … » quand elle apparaît dans l'indice : on obtient un indice à trous. */
export function blankAnswer(clue: string, answer: string): string {
  return clue.replace(/\p{L}+/gu, (tok) => (norm(tok).replace(/[^A-Z]/g, '') === answer ? '…' : tok));
}

/** Indices supplémentaires : « MOT|moyens en plus|malins en plus », plusieurs séparés par « ; ». */
export function applyExtras(entries: Entry[], src: string): Entry[] {
  const map = new Map(entries.map((e) => [e.w, { ...e }]));
  const seen = new Set(entries.flatMap((e) => allClues(e)));
  for (const line of src.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [w, m2 = '', m3 = ''] = line.split('|');
    const e = map.get(w.trim());
    if (!e) continue;
    // Un indice déjà utilisé ailleurs est ignoré, pour qu'aucun indice ne serve deux fois.
    const split = (x: string) =>
      x.split(';').map((c) => blankAnswer(c.trim(), e.w)).filter((c) => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      });
    e.more2 = [...(e.more2 ?? []), ...split(m2)];
    e.more3 = [...(e.more3 ?? []), ...split(m3)];
  }
  return [...map.values()];
}

/** Le lexique à trois niveaux remplace les anciennes entrées du même mot, les autres restent en indice facile. */
function build(base: LangPack, lex: string, extras = ''): LangPack {
  const rich = applyExtras(parseLex(lex), extras);
  const have = new Set(rich.map((e) => e.w));
  const usedClues = new Set(rich.flatMap((e) => allClues(e)));
  const legacy = base.entries.filter((e) => !have.has(e.w) && !usedClues.has(e.c));
  const story = STORY[base.lang].chapters.map((c) => ({ t: c.phrase, k: 'story' }));
  // Messages d'événements et packs : réservés, jamais tirés au hasard ailleurs.
  const events = Object.entries(EVENT_PHRASES).flatMap(([id, m]) => m[base.lang].map((t) => ({ t, k: `event:${id}` })));
  const packs = Object.entries(PACK_PHRASES).flatMap(([id, m]) => m[base.lang].map((t) => ({ t, k: `pack:${id}` })));
  // Seuls les indices validés (ou corrigés) arrivent en jeu.
  return { ...base, entries: applyReview(base.lang, [...rich, ...legacy]), phrases: [...base.phrases, ...story, ...events, ...packs] };
}

export const PACKS: Record<Lang, LangPack> = {
  fr: build(fr, LEX_FR + LEX_FR_MORE, EXTRA_FR),
  en: build(en, LEX_EN + LEX_EN_MORE, EXTRA_EN),
  es: build(es, LEX_ES + LEX_ES_MORE, EXTRA_ES),
};

export const LANGS: { code: Lang; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

/** Langue proposée par défaut d'après le téléphone. */
export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2).toLowerCase() : 'en';
  return (['fr', 'en', 'es'] as const).find((l) => l === nav) ?? 'en';
}

/** Index de la phrase de récit d'un chapitre. */
export function storyPhraseIndex(pack: LangPack, chapter: number): number {
  const text = STORY[pack.lang].chapters[chapter % STORY[pack.lang].chapters.length].phrase;
  return pack.phrases.findIndex((p) => p.k === 'story' && p.t === text);
}

/** Index des phrases réservées à un événement ou à un pack, dans l'ordre. */
export function reservedIndices(pack: LangPack, key: string): number[] {
  return pack.phrases.map((p, i) => (p.k === key ? i : -1)).filter((i) => i >= 0);
}
