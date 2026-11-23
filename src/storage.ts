import type { Lang } from './engine/types';
import type { BoosterId, QuestState, SeasonState, SkinId } from './meta';

export interface DayResult {
  score: number;
  ms: number;
  mistakes: number;
  hints: number;
}

export interface Save {
  v: 1;
  lang: Lang | null;
  name: string;
  city: string;
  country: string;
  tokens: number;
  premium: boolean;
  rating: number;
  streak: { count: number; best: number; lastDay: string | null; freezes: number };
  daily: Record<string, Record<string, DayResult>>; // langue -> date -> résultat
  campaign: Record<string, { level: number; stars: Record<number, number> }>;
  album: Record<string, number[]>; // langue -> index des phrases trouvées
  stats: { played: number; won: number; totalMs: number; bestScore: number };
  lastChest: string | null;
  xp: number;
  /** langue -> clé de mode -> record */
  records: Record<string, Record<string, ModeRecord>>;
  achievements: string[];
  league: { week: string | null; tier: number; xp: number; last: 'up' | 'down' | 'stay' | null; lastRank: number | null };
  settings: { sound: boolean; haptics: boolean };
  tutorialDone: boolean;
  counters: { noHintWins: number; fails: number; bossWins: number; questDays: number };
  boosters: Record<BoosterId, number>;
  /** Double XP armé pour la prochaine partie. */
  doubleArmed: boolean;
  quests: QuestState;
  season: SeasonState;
  skins: SkinId[];
  skin: SkinId;
  /** Chapitres dont l'ouverture a été lue. */
  seenChapters: number[];
  /** Expédition du jour : profondeur atteinte par date. */
  expDaily: Record<string, number>;
}

export interface ModeRecord {
  best: number;
  bestMs: number | null;
  played: number;
  wins: number;
}

const KEY = 'lexicode.save.v1';

export function emptySave(): Save {
  return {
    v: 1,
    lang: null,
    name: '',
    city: '',
    country: '',
    tokens: 10,
    premium: false,
    rating: 1000,
    streak: { count: 0, best: 0, lastDay: null, freezes: 1 },
    daily: {},
    campaign: {},
    album: {},
    stats: { played: 0, won: 0, totalMs: 0, bestScore: 0 },
    lastChest: null,
    xp: 0,
    records: {},
    achievements: [],
    league: { week: null, tier: 0, xp: 0, last: null, lastRank: null },
    settings: { sound: true, haptics: true },
    tutorialDone: false,
    counters: { noHintWins: 0, fails: 0, bossWins: 0, questDays: 0 },
    boosters: { freeze: 1, shield: 1, reveal: 1, double: 0 },
    doubleArmed: false,
    quests: { day: null, progress: {}, claimed: [], bonusClaimed: false },
    season: { id: 0, xp: 0, claimed: [], claimedPremium: [] },
    skins: ['ivory'],
    skin: 'ivory',
    seenChapters: [],
    expDaily: {},
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const d = emptySave();
    const p = JSON.parse(raw);
    return { ...d, ...p, settings: { ...d.settings, ...p.settings }, counters: { ...d.counters, ...p.counters }, league: { ...d.league, ...p.league }, boosters: { ...d.boosters, ...p.boosters } };
  } catch {
    return emptySave();
  }
}

export function persist(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible (aperçu, navigation privée) : la partie continue en mémoire
  }
}

export function today(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000,
  );
}

/** Met à jour la série après un défi du jour réussi. Les protections couvrent les jours manqués. */
export function bumpStreak(s: Save, day: string): Save {
  const st = { ...s.streak };
  if (st.lastDay === day) return s;
  if (!st.lastDay) st.count = 1;
  else {
    const gap = daysBetween(st.lastDay, day);
    const missed = gap - 1;
    if (gap <= 0) return s;
    if (missed === 0) st.count += 1;
    else if (missed <= st.freezes) {
      st.freezes -= missed;
      st.count += 1;
    } else st.count = 1;
  }
  st.lastDay = day;
  st.best = Math.max(st.best, st.count);
  // Une protection offerte tous les 7 jours de série (max 3).
  if (st.count % 7 === 0) st.freezes = Math.min(3, st.freezes + 1);
  return { ...s, streak: st };
}

/** La série affichée retombe à zéro si le joueur a manqué trop de jours. */
export function liveStreak(s: Save, day: string): number {
  if (!s.streak.lastDay) return 0;
  const gap = daysBetween(s.streak.lastDay, day);
  if (gap <= 1) return s.streak.count;
  return gap - 1 <= s.streak.freezes ? s.streak.count : 0;
}

export function bumpRecord(s: Save, lang: string, key: string, won: boolean, score: number, ms: number): Save {
  const byLang = s.records[lang] ?? {};
  const r = byLang[key] ?? { best: 0, bestMs: null, played: 0, wins: 0 };
  const better = won && (score > r.best || (score === r.best && (r.bestMs === null || ms < r.bestMs)));
  const next: ModeRecord = {
    best: better ? score : r.best,
    bestMs: better ? ms : r.bestMs,
    played: r.played + 1,
    wins: r.wins + (won ? 1 : 0),
  };
  return { ...s, records: { ...s.records, [lang]: { ...byLang, [key]: next } } };
}

/** Indice de réflexion façon Elo : gagner une grille difficile rapporte plus. */
export function updateRating(rating: number, puzzleRating: number, score: number): number {
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
  const perf = Math.min(1, score / 1000);
  return Math.round(rating + 40 * (perf - expected));
}
