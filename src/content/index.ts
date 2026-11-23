import type { Entry, Lang, LangPack } from '../engine/types';
import { fr } from './fr';
import { en } from './en';
import { es } from './es';
import { LEX_FR } from './lex-fr';
import { LEX_EN } from './lex-en';
import { LEX_ES } from './lex-es';
import { STORY } from './story';

/** Lit un lexique « MOT|facile|moyen|malin ». */
export function parseLex(src: string): Entry[] {
  return src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [w, c, c2, c3] = l.split('|');
      return { w: w.trim(), c: c.trim(), c2: c2?.trim() || undefined, c3: c3?.trim() || undefined };
    });
}

/** Le lexique à trois niveaux remplace les anciennes entrées du même mot, les autres restent en indice facile. */
function build(base: LangPack, lex: string): LangPack {
  const rich = parseLex(lex);
  const have = new Set(rich.map((e) => e.w));
  const usedClues = new Set(rich.flatMap((e) => [e.c, e.c2, e.c3]).filter(Boolean));
  const legacy = base.entries.filter((e) => !have.has(e.w) && !usedClues.has(e.c));
  const story = STORY[base.lang].chapters.map((c) => ({ t: c.phrase, k: 'story' }));
  return { ...base, entries: [...rich, ...legacy], phrases: [...base.phrases, ...story] };
}

export const PACKS: Record<Lang, LangPack> = {
  fr: build(fr, LEX_FR),
  en: build(en, LEX_EN),
  es: build(es, LEX_ES),
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
