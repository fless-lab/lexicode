import type { Lang, LangPack } from '../engine/types';
import { STORY } from './story';
// Paquets précalculés par `npm run packs` (scripts/build-packs.ts) : le jeu n'embarque ni les lexiques bruts
// ni les fichiers de validation, et n'a plus à les assembler au démarrage.
import fr from './packs/fr.json';
import en from './packs/en.json';
import es from './packs/es.json';

export const PACKS: Record<Lang, LangPack> = { fr: fr as LangPack, en: en as LangPack, es: es as LangPack };

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
