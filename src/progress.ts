import { rngFromSeed } from './engine/rng';
import type { Save } from './storage';
import type { ModeKind } from './modes';

// ---------- Niveau du joueur ----------

/** XP totale nécessaire pour atteindre un niveau : 120, 360, 720, 1200… */
export function xpForLevel(level: number): number {
  return 60 * level * (level - 1);
}

export function playerLevel(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export function levelProgress(xp: number): { level: number; cur: number; need: number } {
  const level = playerLevel(xp);
  const base = xpForLevel(level);
  return { level, cur: xp - base, need: xpForLevel(level + 1) - base };
}

/** Index du titre (traduit dans i18n.titles). */
export function titleIndex(level: number): number {
  return Math.min(9, Math.floor((level - 1) / 4));
}

export interface GameEvent {
  kind: ModeKind;
  won: boolean;
  score: number;
  ms: number;
  stars: number;
  hints: number;
  mistakes: number;
  d: number;
  /** Grilles résolues (marathon). */
  run?: number;
  boss?: boolean;
  maxCombo?: number;
  /** Mots résolus pendant la partie. */
  words?: number;
}

export function xpFor(e: GameEvent): number {
  if (e.kind === 'marathon') return 20 + (e.run ?? 0) * 35;
  if (!e.won) return 8;
  const base = Math.round(e.score / 18) + e.d * 6;
  const bonus: Partial<Record<ModeKind, number>> = { daily: 40, sudden: 25, hardcore: 80, timeattack: 15, survival: 10 };
  return base + (bonus[e.kind] ?? 0) + (e.boss ? 40 : 0) + (e.stars === 3 ? 15 : 0);
}

// ---------- Ligues hebdomadaires ----------

export const LEAGUE_SIZE = 30;
export const PROMOTE = 5;
export const DEMOTE = 5;
export const TIERS = ['🥉', '🥈', '🥇', '💠', '♦️', '💚', '💎'];

export function weekKey(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Part de la semaine écoulée (0 à 1). */
export function weekFraction(d = new Date()): number {
  const day = (d.getDay() + 6) % 7;
  return Math.min(1, (day + (d.getHours() + d.getMinutes() / 60) / 24) / 7);
}

const BOT_NAMES = ['Alex', 'Sam', 'Nina', 'Léo', 'Maya', 'Omar', 'Yuki', 'Ana', 'Kofi', 'Lina', 'Hugo', 'Zoé', 'Ravi', 'Inès', 'Tom', 'Aya', 'Max', 'Eva', 'Noah', 'Sara', 'Iris', 'Malik', 'Jade', 'Theo', 'Emma', 'Diego', 'Lucia', 'Kenji', 'Amara'];

export interface LeagueRow {
  name: string;
  xp: number;
  isYou?: boolean;
}

/** Adversaires simulés de la ligue (remplacés par de vrais joueurs une fois le serveur branché). */
export function leagueRows(week: string, tier: number, myXp: number, myName: string, frac: number): LeagueRow[] {
  const rng = rngFromSeed(`league|${week}|${tier}`);
  const strength = 250 + tier * 180;
  const rows: LeagueRow[] = BOT_NAMES.slice(0, LEAGUE_SIZE - 1).map((n) => {
    const target = strength * (0.25 + rng() * 1.9);
    const pace = 0.6 + rng() * 0.8;
    return { name: `${n}${Math.floor(rng() * 90 + 10)}`, xp: Math.round(target * Math.min(1, Math.pow(frac, pace))) };
  });
  rows.push({ name: myName, xp: myXp, isYou: true });
  return rows.sort((a, b) => b.xp - a.xp);
}

/** À l'ouverture d'une nouvelle semaine : clôture la précédente et applique montée ou descente. */
export function rollLeague(s: Save, now = new Date()): { save: Save; result: 'up' | 'down' | 'stay' | null } {
  const wk = weekKey(now);
  if (!s.league.week) return { save: { ...s, league: { ...s.league, week: wk } }, result: null };
  if (s.league.week === wk) return { save: s, result: null };
  const rows = leagueRows(s.league.week, s.league.tier, s.league.xp, 'me', 1);
  const rank = rows.findIndex((r) => r.isYou) + 1;
  let tier = s.league.tier;
  let result: 'up' | 'down' | 'stay' = 'stay';
  if (s.league.xp > 0 && rank <= PROMOTE && tier < TIERS.length - 1) {
    tier++;
    result = 'up';
  } else if ((rank > LEAGUE_SIZE - DEMOTE || s.league.xp === 0) && tier > 0) {
    tier--;
    result = 'down';
  }
  const reward = result === 'up' ? 10 + tier * 5 : rank <= 10 ? 3 : 0;
  return {
    save: { ...s, tokens: s.tokens + reward, league: { week: wk, tier, xp: 0, last: result, lastRank: rank } },
    result,
  };
}

// ---------- Succès ----------

export interface Achievement {
  id: string;
  icon: string;
  /** Condition évaluée après chaque partie. */
  test: (s: Save, e: GameEvent | null) => boolean;
}

const wins = (s: Save, prefix: string) =>
  Object.values(s.records).reduce(
    (n, byKey) => n + Object.entries(byKey).filter(([k]) => k.startsWith(prefix)).reduce((m, [, r]) => m + r.wins, 0),
    0,
  );
const best = (s: Save, key: string) => Math.max(0, ...Object.values(s.records).map((r) => r[key]?.best ?? 0));
const albumSize = (s: Save) => Object.values(s.album).reduce((n, a) => n + a.length, 0);
const maxLevel = (s: Save) => Math.max(1, ...Object.values(s.campaign).map((c) => c.level - 1));

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', icon: '🎉', test: (s) => s.stats.won >= 1 },
  { id: 'wins_25', icon: '🏅', test: (s) => s.stats.won >= 25 },
  { id: 'wins_100', icon: '🏆', test: (s) => s.stats.won >= 100 },
  { id: 'wins_500', icon: '👑', test: (s) => s.stats.won >= 500 },
  { id: 'perfect', icon: '⭐', test: (_, e) => !!e && e.won && e.stars === 3 },
  { id: 'flawless_d4', icon: '💫', test: (_, e) => !!e && e.won && e.d >= 4 && e.mistakes === 0 && e.hints === 0 },
  { id: 'speed_60', icon: '⚡', test: (_, e) => !!e && e.won && e.kind !== 'marathon' && e.ms < 60_000 },
  { id: 'speed_30', icon: '🚀', test: (_, e) => !!e && e.won && e.kind !== 'marathon' && e.ms < 30_000 && e.d >= 2 },
  { id: 'streak_3', icon: '🔥', test: (s) => s.streak.best >= 3 },
  { id: 'streak_7', icon: '📅', test: (s) => s.streak.best >= 7 },
  { id: 'streak_30', icon: '🗓', test: (s) => s.streak.best >= 30 },
  { id: 'streak_100', icon: '💯', test: (s) => s.streak.best >= 100 },
  { id: 'ta_win', icon: '⏱', test: (s) => wins(s, 'timeattack') >= 1 },
  { id: 'ta_expert', icon: '⌛', test: (s) => wins(s, 'timeattack:5') >= 1 },
  { id: 'survival_win', icon: '❤️', test: (s) => wins(s, 'survival') >= 1 },
  { id: 'survival_expert', icon: '🩹', test: (s) => wins(s, 'survival:5') >= 1 },
  { id: 'sudden_win', icon: '💀', test: (s) => wins(s, 'sudden') >= 1 },
  { id: 'sudden_10', icon: '☠️', test: (s) => wins(s, 'sudden') >= 10 },
  { id: 'marathon_5', icon: '🏃', test: (s) => best(s, 'marathon') >= 5 },
  { id: 'marathon_10', icon: '🏃‍♂️', test: (s) => best(s, 'marathon') >= 10 },
  { id: 'marathon_20', icon: '🦾', test: (s) => best(s, 'marathon') >= 20 },
  { id: 'hardcore_win', icon: '🌋', test: (s) => wins(s, 'hardcore') >= 1 },
  { id: 'hardcore_5', icon: '🐉', test: (s) => wins(s, 'hardcore') >= 5 },
  { id: 'boss_1', icon: '👹', test: (_, e) => !!e && e.won && !!e.boss },
  { id: 'world_1', icon: '🗺', test: (s) => maxLevel(s) >= 12 },
  { id: 'world_3', icon: '🧭', test: (s) => maxLevel(s) >= 36 },
  { id: 'world_6', icon: '🌍', test: (s) => maxLevel(s) >= 72 },
  { id: 'album_10', icon: '📖', test: (s) => albumSize(s) >= 10 },
  { id: 'album_50', icon: '📚', test: (s) => albumSize(s) >= 50 },
  { id: 'polyglot', icon: '🌐', test: (s) => Object.values(s.album).filter((a) => a.length > 0).length >= 3 },
  { id: 'rating_1200', icon: '🧠', test: (s) => s.rating >= 1200 },
  { id: 'rating_1500', icon: '🧬', test: (s) => s.rating >= 1500 },
  { id: 'league_gold', icon: '🥇', test: (s) => s.league.tier >= 2 },
  { id: 'league_diamond', icon: '💎', test: (s) => s.league.tier >= 6 },
  { id: 'no_hint_10', icon: '🎯', test: (s) => s.counters.noHintWins >= 10 },
  { id: 'comeback', icon: '🔁', test: (_, e) => !!e && e.won && e.mistakes >= 5 },
  { id: 'combo_20', icon: 'c', test: (_, e) => !!e && (e.maxCombo ?? 0) >= 20 },
  { id: 'combo_40', icon: 'c', test: (_, e) => !!e && (e.maxCombo ?? 0) >= 40 },
  { id: 'crypto_win', icon: 'k', test: (s) => wins(s, 'cryptogram') >= 1 },
  { id: 'crypto_expert', icon: 'k', test: (s) => wins(s, 'cryptogram:5') >= 1 },
  { id: 'quests_all', icon: 'q', test: (s) => s.counters.questDays >= 1 },
  { id: 'quests_7', icon: 'q', test: (s) => s.counters.questDays >= 7 },
  { id: 'season_10', icon: 's', test: (s) => Math.floor(s.season.xp / 150) >= 10 },
  { id: 'season_30', icon: 's', test: (s) => Math.floor(s.season.xp / 150) >= 30 },
  { id: 'skins_3', icon: 'p', test: (s) => s.skins.length >= 3 },
];

export const ACH_REWARD = 4;

export function newAchievements(s: Save, e: GameEvent | null): string[] {
  const have = new Set(s.achievements);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(s, e)).map((a) => a.id);
}
