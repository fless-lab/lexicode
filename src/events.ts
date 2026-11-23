// Événements saisonniers. Tout est décrit par des données : un événement se lance,
// s'arrête ou se modifie sans toucher au code des écrans. En production, cette liste
// viendra du serveur (configuration à distance), avec cette copie embarquée comme secours hors ligne.
import type { Lang } from './engine/types';
import type { Outfit } from './ui/mascot';

/** Récompense d'événement : un objet du catalogue (« type:valeur ») ou un titre. */
export interface EventReward { at: number; item?: string; title?: string; label: Record<Lang, string> }

export interface SeasonalEvent {
  id: string;
  /** Dates incluses, en heure locale du joueur. */
  start: string;
  end: string;
  /** Classe CSS qui habille toute l'application pendant l'événement. */
  theme: string;
  /** Décor ajouté aux scènes (neige, lanternes, citrouilles…). */
  decor: 'xmas' | 'lunar' | 'ramadan' | 'halloween';
  /** Tenue que porte Loupi pendant l'événement. */
  outfit: Outfit;
  title: Record<Lang, string>;
  story: Record<Lang, string>;
  /** Monnaie propre à l'événement, gagnée en jouant, jamais achetable. */
  currency: Record<Lang, string>;
  levels: number;
  perLevel: number;
  rewards: EventReward[];
}

const L = (fr: string, en: string, es: string): Record<Lang, string> => ({ fr, en, es });

export const EVENTS: SeasonalEvent[] = [
  {
    id: 'xmas-2026',
    start: '2026-12-01',
    end: '2026-12-31',
    theme: 'event-xmas',
    decor: 'xmas',
    outfit: { hat: 'santa', neck: 'scarf_xmas' },
    title: L('À la rescousse du Père Noël', "Santa's Rescue", 'Al rescate de Papá Noel'),
    story: L(
      "Le traîneau s'est posé en catastrophe sur les toits, et un lutin farceur a chiffré la liste des cadeaux. Aide Loupi à déchiffrer les douze messages avant le réveillon.",
      'The sleigh crash-landed on the rooftops, and a prankster elf scrambled the gift list. Help Loupi crack the twelve messages before Christmas Eve.',
      'El trineo aterrizó de golpe en los tejados y un duende bromista cifró la lista de regalos. Ayuda a Loupi a descifrar los doce mensajes antes de Nochebuena.',
    ),
    currency: L('flocons', 'snowflakes', 'copos'),
    levels: 12,
    perLevel: 10,
    rewards: [
      { at: 10, item: 'hat:santa', label: L('Bonnet de Noël', 'Santa hat', 'Gorro navideño') },
      { at: 30, item: 'skin:gingerbread', label: L("Tuiles pain d'épices", 'Gingerbread tiles', 'Fichas de jengibre') },
      { at: 50, item: 'keyboard:frost', label: L('Clavier givré', 'Frosted keyboard', 'Teclado escarchado') },
      { at: 70, item: 'effect:snow', label: L('Victoire sous la neige', 'Snowfall victory', 'Victoria nevada') },
      { at: 90, item: 'frame:northstar', label: L("Cadre étoile du Nord", 'North Star frame', 'Marco estrella polar') },
      { at: 120, item: 'neck:scarf_xmas', label: L('Écharpe de Noël', 'Holiday scarf', 'Bufanda navideña') },
      { at: 120, title: 'elf', label: L("Titre « Lutin d'honneur »", 'Title "Honorary Elf"', 'Título «Duende de honor»') },
    ],
  },
];

/** L'événement en cours à cette date, ou celui forcé par ?event= pour l'aperçu. */
export function activeEvent(day: string): SeasonalEvent | null {
  const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('event') : null;
  if (forced) return EVENTS.find((e) => e.id.startsWith(forced)) ?? null;
  return EVENTS.find((e) => day >= e.start && day <= e.end) ?? null;
}

export function daysLeft(ev: SeasonalEvent, day: string): number {
  return Math.max(0, Math.round((Date.parse(ev.end) - Date.parse(day)) / 86400000) + 1);
}

/** Difficulté du n-ième message : l'événement monte doucement en puissance. */
export function eventDifficulty(i: number): 1 | 2 | 3 | 4 {
  return Math.min(4, 1 + Math.floor(i / 3)) as 1 | 2 | 3 | 4;
}
