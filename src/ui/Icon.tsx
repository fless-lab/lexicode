// Icônes : dessins de la bibliothèque Phosphor (licence MIT, mention complète dans icon-paths.ts),
// en style duotone partout pour une famille homogène. Seuls les dessins utilisés, dans la seule
// graisse voulue, sont gardés dans icon-paths.ts (généré par scripts/icons.ts) ; le <svg> rendu
// est le même que celui du composant Phosphor.
import { createElement } from 'react';
import { ICON_PATHS } from './icon-paths';

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 20, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  const els = ICON_PATHS[name as IconName] ?? ICON_PATHS.sparkle;
  const svg = (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 256 256" className={`ico ${className ?? ''}`}>
      {els.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
  return title ? <span role="img" aria-label={title} style={{ display: 'inline-flex' }}>{svg}</span> : svg;
}

export const MODE_ICON: Record<string, string> = {
  daily: 'calendar',
  level: 'map',
  practice: 'target',
  timeattack: 'hourglass',
  survival: 'heart',
  sudden: 'skull',
  marathon: 'run',
  hardcore: 'volcano',
  zen: 'leaf',
  cryptogram: 'key',
  expedition: 'flag',
  message: 'send',
};

export const BOOSTER_ICON: Record<string, string> = { freeze: 'snow', shield: 'shield', reveal: 'eye', double: 'double' };

export function achIcon(id: string): string {
  const map: [string, string][] = [
    ['first', 'trophy'], ['wins', 'trophy'], ['perfect', 'star'], ['flawless', 'star'], ['speed', 'bolt'],
    ['streak', 'flame'], ['ta_', 'hourglass'], ['survival', 'heart'], ['sudden', 'skull'], ['marathon', 'run'],
    ['hardcore', 'volcano'], ['boss', 'crown'], ['world', 'map'], ['album', 'book'], ['polyglot', 'globe'],
    ['rating', 'brain'], ['league', 'medal'], ['no_hint', 'target'], ['comeback', 'rotate'], ['combo', 'combo'],
    ['crypto', 'key'], ['quests', 'list'], ['season', 'flag'], ['skins', 'palette'], ['chapter', 'book'], ['depth', 'flag'], ['cycle', 'rotate'],
  ];
  return map.find(([p]) => id.startsWith(p))?.[1] ?? 'sparkle';
}
