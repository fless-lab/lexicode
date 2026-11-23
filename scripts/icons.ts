// Génère src/ui/icon-paths.ts : les seuls dessins Phosphor dont le jeu se sert, dans la graisse voulue.
// Le paquet @phosphor-icons/react embarque six graisses par icône, impossibles à élaguer au build ;
// ici on n'en garde qu'une, et Icon.tsx rend directement le <svg>.
//
// Pour ajouter ou changer une icône : modifier ICONS ci-dessous (noms des composants Phosphor,
// https://phosphoricons.com), puis lancer `npx tsx scripts/icons.ts`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidElement, type ReactElement } from 'react';

type Weight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/** Nom interne -> [icône Phosphor, graisse] (duotone par défaut, pour une famille homogène). */
const ICONS: Record<string, [string, Weight?]> = {
  back: ['CaretLeft', 'bold'], close: ['X', 'bold'], check: ['Check', 'bold'], erase: ['Backspace'],
  gear: ['GearSix'], flame: ['Fire'], token: ['Coin'], clock: ['Timer'], hourglass: ['HourglassHigh'],
  heart: ['Heart'], heartFill: ['Heart', 'fill'], skull: ['Skull'], run: ['PersonSimpleRun'], volcano: ['Mountains'],
  leaf: ['Leaf'], key: ['Key'], trophy: ['Trophy'], book: ['BookOpenText'], medal: ['Medal'], crown: ['Crown'],
  bulb: ['Lightbulb'], search: ['MagnifyingGlass'], sparkle: ['Sparkle'], lock: ['LockSimple'], chest: ['TreasureChest'],
  calendar: ['CalendarStar'], map: ['MapTrifold'], shield: ['ShieldCheck'], star: ['Star'], starFill: ['Star', 'fill'],
  share: ['Export'], play: ['Play', 'fill'], home: ['House'], sound: ['SpeakerHigh'], vibrate: ['Vibrate'], bolt: ['Lightning'],
  target: ['Target'], brain: ['Brain'], globe: ['Globe'], rotate: ['ArrowCounterClockwise', 'bold'], list: ['ListChecks'],
  flag: ['Flag'], palette: ['Palette'], snow: ['Snowflake'], eye: ['Eye'], double: ['Coins'], arena: ['Sword'],
  chart: ['ChartBar'], user: ['User'], combo: ['TrendUp'], gift: ['Gift'],
  users: ['UsersThree'], ghost: ['Ghost'], copy: ['Copy'], send: ['PaperPlaneTilt'], handshake: ['Handshake'], chat: ['ChatCircleDots'], offline: ['WifiSlash'], wave: ['HandWaving'],
  // Reliques et altérations
  lantern: ['Lamp'], quill: ['Feather'], inkwell: ['Drop'], compass: ['Compass'], prism: ['Diamond'], seal: ['Seal'],
  fog: ['CloudFog'], chain: ['LinkSimple'], smudge: ['Eraser'], infinite: ['Infinity'], detective: ['Detective'],
  // Modes de jeu
  daily: ['CalendarStar'], level: ['MapTrifold'], practice: ['Target'], timeattack: ['HourglassHigh'], survival: ['Heartbeat'],
  sudden: ['Skull'], marathon: ['PersonSimpleRun'], hardcore: ['Mountains'], zen: ['Leaf'], cryptogram: ['Key'], expedition: ['Flag'],
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = path.join(root, 'node_modules/@phosphor-icons/react');
const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version as string;
const license = fs.readFileSync(path.join(pkg, 'LICENSE'), 'utf8').trim();

type El = [string, Record<string, string | number>];

/** Éléments SVG d'une graisse, avec leurs attributs tels que Phosphor les passe à React. */
function flatten(node: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out));
  else if (isValidElement(node)) {
    const { children, ...props } = (node as ReactElement<Record<string, unknown>>).props;
    if (typeof node.type === 'string') out.push([node.type, props as El[1]]);
    flatten(children, out);
  }
  return out;
}

const drawings = new Map<string, El[]>();
const byName: Record<string, string> = {};
for (const [name, [icon, weight = 'duotone']] of Object.entries(ICONS)) {
  const key = `${icon}:${weight}`;
  if (!drawings.has(key)) {
    const defs = (await import(path.join(pkg, `dist/defs/${icon}.es.js`))).default as Map<Weight, unknown>;
    const els = flatten(defs.get(weight));
    if (!els.length) throw new Error(`${icon} : graisse ${weight} introuvable`);
    drawings.set(key, els);
  }
  byName[name] = key;
}

const keys = [...drawings.keys()];
const out = `// Fichier généré par scripts/icons.ts : ne pas modifier à la main.
//
// Dessins tirés de Phosphor Icons ${version} (https://phosphoricons.com), sous licence MIT :
//
${license.split('\n').map((l) => `//   ${l}`.trimEnd()).join('\n')}

/** Un élément SVG : balise et attributs. */
export type IconEl = [string, Record<string, string | number>];

const D: IconEl[][] = [
${keys.map((k) => `  // ${k}\n  ${JSON.stringify(drawings.get(k))},`).join('\n')}
];

export const ICON_PATHS = {
${Object.entries(byName).map(([n, k]) => `  ${n}: D[${keys.indexOf(k)}],`).join('\n')}
} satisfies Record<string, IconEl[]>;
`;
fs.writeFileSync(path.join(root, 'src/ui/icon-paths.ts'), out);
console.log(`src/ui/icon-paths.ts : ${Object.keys(byName).length} noms, ${keys.length} dessins, ${(out.length / 1024).toFixed(1)} ko`);
