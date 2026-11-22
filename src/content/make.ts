import type { Lang, LangPack } from '../engine/types';

/** Format compact : [RÉPONSE, indice] et [phrase, catégorie]. */
export function makePack(lang: Lang, entries: [string, string][], phrases: [string, string][]): LangPack {
  return {
    lang,
    entries: entries.map(([w, c]) => ({ w, c })),
    phrases: phrases.map(([t, k]) => ({ t, k })),
  };
}
