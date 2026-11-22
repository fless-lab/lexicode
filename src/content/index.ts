import type { Lang, LangPack } from '../engine/types';
import { fr } from './fr';
import { en } from './en';
import { es } from './es';

export const PACKS: Record<Lang, LangPack> = { fr, en, es };

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
