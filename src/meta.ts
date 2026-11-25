// Systèmes de rétention : quêtes du jour, bonus, saison, habillages de tuiles.
import { rngFromSeed, shuffle } from './engine/rng';
import { dayIndex } from './engine/generator';
import type { GameEvent } from './progress';

// ---------- Bonus ----------

export type BoosterId = 'freeze' | 'shield' | 'reveal' | 'double';
export const BOOSTERS: BoosterId[] = ['freeze', 'shield', 'reveal', 'double'];
/** Gel : arrête le chrono 15 s. Bouclier : absorbe une erreur. Révélation : 3 lettres. Double : XP x2 sur la partie. */
export const FREEZE_MS = 15_000;
export const REVEAL_N = 3;
/** Atouts de chaque type utilisables dans une même partie (hors modes classés, où ils sont coupés pour tous). */
export const BOOSTER_CAP = { free: 1, premium: 3 };

// ---------- Quêtes du jour ----------

export interface QuestDef {
  id: string;
  target: number;
  /** 'sum' : on additionne, 'max' : on garde la meilleure valeur. */
  agg: 'sum' | 'max';
  value: (e: GameEvent) => number;
  reward: { tokens: number; xp: number; booster?: BoosterId };
}

const TIMED = new Set(['timeattack', 'marathon', 'hardcore']);

export const QUESTS: QuestDef[] = [
  { id: 'win3', target: 3, agg: 'sum', value: (e) => (e.won ? 1 : 0), reward: { tokens: 3, xp: 40 } },
  { id: 'win5', target: 5, agg: 'sum', value: (e) => (e.won ? 1 : 0), reward: { tokens: 5, xp: 70, booster: 'reveal' } },
  { id: 'timed2', target: 2, agg: 'sum', value: (e) => (e.won && TIMED.has(e.kind) ? 1 : e.kind === 'marathon' && (e.run ?? 0) > 0 ? 1 : 0), reward: { tokens: 4, xp: 60, booster: 'freeze' } },
  { id: 'nohint2', target: 2, agg: 'sum', value: (e) => (e.won && e.hints === 0 ? 1 : 0), reward: { tokens: 4, xp: 50 } },
  { id: 'combo12', target: 12, agg: 'max', value: (e) => e.maxCombo ?? 0, reward: { tokens: 4, xp: 50, booster: 'shield' } },
  { id: 'combo25', target: 25, agg: 'max', value: (e) => e.maxCombo ?? 0, reward: { tokens: 6, xp: 80, booster: 'double' } },
  { id: 'words15', target: 15, agg: 'sum', value: (e) => e.words ?? 0, reward: { tokens: 3, xp: 40 } },
  { id: 'marathon4', target: 4, agg: 'max', value: (e) => (e.kind === 'marathon' ? e.run ?? 0 : 0), reward: { tokens: 6, xp: 80, booster: 'freeze' } },
  { id: 'levels2', target: 2, agg: 'sum', value: (e) => (e.won && e.kind === 'level' ? 1 : 0), reward: { tokens: 3, xp: 40 } },
  { id: 'stars2', target: 2, agg: 'sum', value: (e) => (e.won && e.stars === 3 ? 1 : 0), reward: { tokens: 5, xp: 60, booster: 'shield' } },
  { id: 'crypto1', target: 1, agg: 'sum', value: (e) => (e.won && e.kind === 'cryptogram' ? 1 : 0), reward: { tokens: 5, xp: 70 } },
  { id: 'survive1', target: 1, agg: 'sum', value: (e) => (e.won && (e.kind === 'survival' || e.kind === 'sudden') ? 1 : 0), reward: { tokens: 4, xp: 60 } },
  { id: 'fast90', target: 1, agg: 'sum', value: (e) => (e.won && e.kind !== 'marathon' && e.ms < 90_000 && e.d >= 2 ? 1 : 0), reward: { tokens: 4, xp: 50 } },
  { id: 'daily1', target: 1, agg: 'sum', value: (e) => (e.won && e.kind === 'daily' ? 1 : 0), reward: { tokens: 2, xp: 30 } },
];

export const QUEST_BONUS = { tokens: 4, booster: 'double' as BoosterId };

/** Trois quêtes par jour, les mêmes pour tous, dont toujours une facile. */
export function questsFor(day: string): QuestDef[] {
  const rng = rngFromSeed(`quests|${day}`);
  const easy = QUESTS.filter((q) => ['win3', 'words15', 'levels2', 'daily1'].includes(q.id));
  const hard = QUESTS.filter((q) => !easy.includes(q));
  const first = easy[Math.floor(rng() * easy.length)];
  return [first, ...shuffle(hard, rng).slice(0, 2)];
}

export interface QuestState {
  day: string | null;
  progress: Record<string, number>;
  claimed: string[];
  bonusClaimed: boolean;
}

export function freshQuests(day: string, q: QuestState): QuestState {
  return q.day === day ? q : { day, progress: {}, claimed: [], bonusClaimed: false };
}

export function applyQuests(q: QuestState, day: string, e: GameEvent): QuestState {
  const cur = freshQuests(day, q);
  const progress = { ...cur.progress };
  for (const def of questsFor(day)) {
    const v = def.value(e);
    const prev = progress[def.id] ?? 0;
    progress[def.id] = Math.min(def.target, def.agg === 'sum' ? prev + v : Math.max(prev, v));
  }
  return { ...cur, progress };
}

// ---------- Saison ----------

export const SEASON_DAYS = 28;
export const TIER_XP = 150;
export const SEASON_TIERS = 30;

/** La saison 1 commence le lundi 16 novembre 2026. */
const SEASON_EPOCH = dayIndex('2026-11-16');
const seasonDay = (day: string) => Math.max(0, dayIndex(day) - SEASON_EPOCH);

export function seasonOf(day: string): number {
  return Math.floor(seasonDay(day) / SEASON_DAYS) + 1;
}

export function seasonDaysLeft(day: string): number {
  return SEASON_DAYS - (seasonDay(day) % SEASON_DAYS);
}

export type SkinId = 'ivory' | 'slate' | 'brass' | 'jade' | 'pearl' | 'obsidian' | 'ruby' | 'frost' | 'gingerbread';
export const SKINS: SkinId[] = ['ivory', 'slate', 'brass', 'jade', 'pearl', 'obsidian', 'ruby', 'frost', 'gingerbread'];

export type Reward = { tokens?: number; booster?: BoosterId; skin?: SkinId };

/** Récompense d'un palier. Piste gratuite et piste premium. */
export function tierReward(tier: number, premium: boolean): Reward {
  if (!premium) {
    if (tier === 10) return { skin: 'slate' };
    if (tier === 20) return { skin: 'jade' };
    if (tier === 30) return { skin: 'obsidian' };
    if (tier % 5 === 0) return { booster: 'double' };
    if (tier % 3 === 0) return { booster: (['freeze', 'shield', 'reveal'] as BoosterId[])[(tier / 3) % 3] };
    return { tokens: 2 + Math.floor(tier / 6) };
  }
  if (tier === 5) return { skin: 'brass' };
  if (tier === 15) return { skin: 'pearl' };
  if (tier === 25) return { skin: 'ruby' };
  if (tier % 2 === 0) return { booster: (['shield', 'freeze', 'reveal', 'double'] as BoosterId[])[(tier / 2) % 4] };
  return { tokens: 4 + Math.floor(tier / 5) };
}

export interface SeasonState {
  id: number;
  xp: number;
  claimed: number[];
  claimedPremium: number[];
}

export function seasonTier(xp: number): number {
  return Math.min(SEASON_TIERS, Math.floor(xp / TIER_XP));
}

export function freshSeason(day: string, s: SeasonState): SeasonState {
  const id = seasonOf(day);
  return s.id === id ? s : { id, xp: 0, claimed: [], claimedPremium: [] };
}
