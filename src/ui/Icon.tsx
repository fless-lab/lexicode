// Icônes : la bibliothèque Phosphor (licence MIT), en style duotone partout pour une famille homogène.
// Les noms internes restent les mêmes ; seul le dessin vient de Phosphor.
import type { ComponentType } from 'react';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Ghost } from '@phosphor-icons/react/dist/csr/Ghost';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { Handshake } from '@phosphor-icons/react/dist/csr/Handshake';
import { ChatCircleDots } from '@phosphor-icons/react/dist/csr/ChatCircleDots';
import { WifiSlash } from '@phosphor-icons/react/dist/csr/WifiSlash';
import { HandWaving } from '@phosphor-icons/react/dist/csr/HandWaving';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';
import { Fire } from '@phosphor-icons/react/dist/csr/Fire';
import { Coin } from '@phosphor-icons/react/dist/csr/Coin';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { Timer } from '@phosphor-icons/react/dist/csr/Timer';
import { HourglassHigh } from '@phosphor-icons/react/dist/csr/HourglassHigh';
import { Heart } from '@phosphor-icons/react/dist/csr/Heart';
import { Heartbeat } from '@phosphor-icons/react/dist/csr/Heartbeat';
import { Skull } from '@phosphor-icons/react/dist/csr/Skull';
import { PersonSimpleRun } from '@phosphor-icons/react/dist/csr/PersonSimpleRun';
import { Mountains } from '@phosphor-icons/react/dist/csr/Mountains';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { BookOpenText } from '@phosphor-icons/react/dist/csr/BookOpenText';
import { Medal } from '@phosphor-icons/react/dist/csr/Medal';
import { Crown } from '@phosphor-icons/react/dist/csr/Crown';
import { Lightbulb } from '@phosphor-icons/react/dist/csr/Lightbulb';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { TreasureChest } from '@phosphor-icons/react/dist/csr/TreasureChest';
import { CalendarStar } from '@phosphor-icons/react/dist/csr/CalendarStar';
import { MapTrifold } from '@phosphor-icons/react/dist/csr/MapTrifold';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Star } from '@phosphor-icons/react/dist/csr/Star';
import { Export } from '@phosphor-icons/react/dist/csr/Export';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { Vibrate } from '@phosphor-icons/react/dist/csr/Vibrate';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { Target } from '@phosphor-icons/react/dist/csr/Target';
import { Brain } from '@phosphor-icons/react/dist/csr/Brain';
import { Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { Palette } from '@phosphor-icons/react/dist/csr/Palette';
import { Snowflake } from '@phosphor-icons/react/dist/csr/Snowflake';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { Backspace } from '@phosphor-icons/react/dist/csr/Backspace';
import { Sword } from '@phosphor-icons/react/dist/csr/Sword';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';
import { Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { Lamp } from '@phosphor-icons/react/dist/csr/Lamp';
import { Feather } from '@phosphor-icons/react/dist/csr/Feather';
import { Drop } from '@phosphor-icons/react/dist/csr/Drop';
import { Compass } from '@phosphor-icons/react/dist/csr/Compass';
import { Diamond } from '@phosphor-icons/react/dist/csr/Diamond';
import { Seal } from '@phosphor-icons/react/dist/csr/Seal';
import { CloudFog } from '@phosphor-icons/react/dist/csr/CloudFog';
import { LinkSimple } from '@phosphor-icons/react/dist/csr/LinkSimple';
import { Eraser } from '@phosphor-icons/react/dist/csr/Eraser';
import { Infinity as InfinityIcon } from '@phosphor-icons/react/dist/csr/Infinity';
import { Detective } from '@phosphor-icons/react/dist/csr/Detective';
import type { IconWeight } from '@phosphor-icons/react';

type PIcon = ComponentType<{ size?: number; weight?: IconWeight; className?: string; color?: string }>;

const P: Record<string, [PIcon, IconWeight?]> = {
  back: [CaretLeft, 'bold'], close: [X, 'bold'], check: [Check, 'bold'], erase: [Backspace],
  gear: [GearSix], flame: [Fire], token: [Coin], clock: [Timer], hourglass: [HourglassHigh],
  heart: [Heart], heartFill: [Heart, 'fill'], skull: [Skull], run: [PersonSimpleRun], volcano: [Mountains],
  leaf: [Leaf], key: [Key], trophy: [Trophy], book: [BookOpenText], medal: [Medal], crown: [Crown],
  bulb: [Lightbulb], search: [MagnifyingGlass], sparkle: [Sparkle], lock: [LockSimple], chest: [TreasureChest],
  calendar: [CalendarStar], map: [MapTrifold], shield: [ShieldCheck], star: [Star], starFill: [Star, 'fill'],
  share: [Export], play: [Play, 'fill'], home: [House], sound: [SpeakerHigh], vibrate: [Vibrate], bolt: [Lightning],
  target: [Target], brain: [Brain], globe: [Globe], rotate: [ArrowCounterClockwise, 'bold'], list: [ListChecks],
  flag: [Flag], palette: [Palette], snow: [Snowflake], eye: [Eye], double: [Coins], arena: [Sword],
  chart: [ChartBar], user: [User], combo: [TrendUp], gift: [Gift],
  users: [UsersThree], ghost: [Ghost], copy: [Copy], send: [PaperPlaneTilt], handshake: [Handshake], chat: [ChatCircleDots], offline: [WifiSlash], wave: [HandWaving],
  // Reliques et altérations : chaque objet a enfin son dessin.
  lantern: [Lamp], quill: [Feather], inkwell: [Drop], compass: [Compass], prism: [Diamond], seal: [Seal],
  fog: [CloudFog], chain: [LinkSimple], smudge: [Eraser], infinite: [InfinityIcon], detective: [Detective],
  daily: [CalendarStar], level: [MapTrifold], practice: [Target], timeattack: [HourglassHigh], survival: [Heartbeat],
  sudden: [Skull], marathon: [PersonSimpleRun], hardcore: [Mountains], zen: [Leaf], cryptogram: [Key], expedition: [Flag],
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  const [Cmp, weight] = P[name] ?? P.sparkle;
  const svg = <Cmp size={size} weight={weight ?? 'duotone'} className={`ico ${className ?? ''}`} />;
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
