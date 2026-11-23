// Jeu d'icônes maison : trait de 1,75 sur une grille de 24, extrémités arrondies.
const P: Record<string, React.ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
    </>
  ),
  flame: <path d="M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.4 2.6-5.3 3.7-8.7.3 1.8 1.4 3 2.6 3.6.2-2.6 1.4-4.7 3.4-6.1-.5 2.9.9 4.8 2.2 6.5 1 1.3 1.6 2.7 1.6 4.7 0 3.6-3 6.3-7 6.3z" />,
  token: (
    <>
      <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" />
      <path d="M12 7.5l3.8 2.3v4.4L12 16.5l-3.8-2.3V9.8z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
    </>
  ),
  hourglass: <path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  heartFill: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" fill="currentColor" />,
  skull: (
    <>
      <path d="M5 11a7 7 0 1 1 14 0c0 2.3-1 3.6-2 4.4V19H7v-3.6C6 14.6 5 13.3 5 11z" />
      <circle cx="9.3" cy="11.3" r="1.4" />
      <circle cx="14.7" cy="11.3" r="1.4" />
      <path d="M10.5 19v-2M13.5 19v-2" />
    </>
  ),
  run: (
    <>
      <circle cx="14.5" cy="4.5" r="1.8" />
      <path d="M6 20l3.5-5 3 2 1-5.5L10 10l-3 2.5M13.5 11.5l3 3H20M9.5 15l-1.5-3" />
    </>
  ),
  volcano: <path d="M3 20l5.5-9h7L21 20zM9.5 11L12 7l2.5 4M12 3v1.5M8.5 4.5l1 1.2M15.5 4.5l-1 1.2" />,
  leaf: <path d="M5 19c0-8 5.5-13.5 14-14 0 8.5-5.5 14-13 14H5zm0 0c3-4 6-6.5 9-8" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L19 4M15.5 7.5l2.5 2.5M13.5 9.5l2 2" />
    </>
  ),
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4" />,
  book: <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6v13c-2.5-1.5-5.5-1.5-8-.5zM20 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z" />,
  medal: (
    <>
      <circle cx="12" cy="15" r="5" />
      <path d="M8.5 11.3L6 3h4l2 5 2-5h4l-2.5 8.3M12 13v4" />
    </>
  ),
  crown: <path d="M4 18h16M5 15L3.5 7l5 4L12 5l3.5 6 5-4L19 15z" />,
  bulb: <path d="M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.8.7-1.5 1.6-1.5 2.5h-4c0-.9-.7-1.8-1.5-2.5z" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  chest: <path d="M3.5 10.5h17V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM3.5 10.5V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v2.5M10.5 10.5v3h3v-3" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  map: <path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  starFill: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" />,
  share: <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6.5h14V13" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  home: <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" />,
  sound: <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  vibrate: (
    <>
      <rect x="8" y="4" width="8" height="16" rx="1.5" />
      <path d="M4.5 8v8M19.5 8v8" />
    </>
  ),
  bolt: <path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".6" fill="currentColor" />
    </>
  ),
  brain: <path d="M9.5 4.5A3 3 0 0 0 6.5 7.5 3 3 0 0 0 4.5 12a3 3 0 0 0 2 4.5 3 3 0 0 0 3 3h1V4.5zM14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 4.5 3 3 0 0 1-2 4.5 3 3 0 0 1-3 3h-1V4.5z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" />
    </>
  ),
  rotate: <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1M17.5 3.5v3.5H14M6.5 20.5V17H10" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5l.01 0M4.5 12l.01 0M4.5 17.5l.01 0" />,
  flag: <path d="M5.5 21V4M5.5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.5-1.8-.4-1.4.3-2.7 1.8-2.7H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10.5" cy="7.2" r="1" fill="currentColor" />
      <circle cx="15" cy="7.8" r="1" fill="currentColor" />
    </>
  ),
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  double: <path d="M7 17L12 7l5 10M8.7 13.5h6.6M17.5 4.5l2.5 2.5M20 4.5L17.5 7" />,
  erase: <path d="M9 5.5h11v13H9L3.5 12zM12.5 9.5l5 5M17.5 9.5l-5 5" />,
  arena: <path d="M5 19l9.5-9.5M14.5 4.5l5 5-2 2-5-5zM19 19l-9.5-9.5M9.5 4.5l-5 5 2 2 5-5zM4 20l2-2M20 20l-2-2" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5" />
    </>
  ),
  combo: <path d="M4 17l4-4 3 3 5-6 4 4M16 6h4v4" />,
  gift: <path d="M4 10h16v3H4zM5.5 13h13v7h-13zM12 10v10M12 10c-1-3-5.5-4-5.5-1.5S10 10 12 10c1-3 5.5-4 5.5-1.5S14 10 12 10z" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  const body = P[name] ?? P.sparkle;
  return (
    <svg
      className={`ico ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
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
