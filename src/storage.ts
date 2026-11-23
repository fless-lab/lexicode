import type { Lang } from './engine/types';
import { BOOSTERS, SKINS, type BoosterId, type QuestState, type SeasonState, type SkinId } from './meta';
import { item } from './catalog';

export interface DayResult {
  score: number;
  ms: number;
  mistakes: number;
  hints: number;
}

export interface Save {
  v: typeof SAVE_VERSION;
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
  /** Objets de la boutique possédés (hors tuiles, rangées dans skins). */
  owned: string[];
  /** Ce qui est équipé : tenue de Loupi et habillages. */
  equip: { hat?: string; neck: string; loupe: string; back?: string; keyboard: string; effect: string; frame?: string; decor: string; title?: string };
  /** Progression des événements : messages déchiffrés et monnaie gagnée. */
  events: Record<string, { done: number; currency: number; claimed: number[] }>;
  /** Packs de grilles : étoiles par grille. */
  packs: Record<string, Record<number, number>>;
  /** Pack de démarrage déjà acheté (proposé une seule fois). */
  starterBought: boolean;
  /** Jeu à plusieurs : jetons gagnés limités à quelques parties par jour (pas de ferme à jetons). */
  multi: { day: string; paid: number };
}

export interface ModeRecord {
  best: number;
  bestMs: number | null;
  played: number;
  wins: number;
}

const KEY = 'lexicode.save.v1';
/** Version du format, à augmenter avec une entrée dans MIGRATIONS à chaque changement incompatible. */
export const SAVE_VERSION = 1;

export function emptySave(): Save {
  return {
    v: SAVE_VERSION,
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
    owned: [],
    equip: { neck: 'scarf', loupe: 'gold', keyboard: 'classic', effect: 'letters', decor: 'home' },
    events: {},
    packs: {},
    starterBought: false,
    multi: { day: '', paid: 0 },
  };
}

// ---------- Lecture sûre ----------
// Une sauvegarde abîmée (écriture interrompue, ancienne version, objet retiré du catalogue) ne doit
// ni planter l'affichage ni effacer la progression : chaque champ est vérifié contre emptySave(),
// la valeur brute est copiée à part avant tout écrasement, et une copie de secours du jour sert de repli.

const LANGS: Lang[] = ['fr', 'en', 'es'];
const BAK = `${KEY}.bak`;
const CORRUPT = 'lexicode.save.corrupt.';
const KEEP_CORRUPT = 3;

type Obj = Record<string, unknown>;

/** Changements de format, appliqués dans l'ordre : MIGRATIONS[n] passe de la version n à n + 1. */
const MIGRATIONS: Record<number, (p: Obj) => Obj> = {};

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';

/**
 * Vérifie une sauvegarde lue, champ par champ, contre emptySave() : une valeur du mauvais type
 * reprend la valeur par défaut, un objet inconnu du catalogue est retiré. `fixes` compte les
 * valeurs présentes mais remplacées. `strict` remet aussi à zéro ce qui n'est que passager.
 */
export function sanitize(input: unknown, strict = false): { save: Save; fixes: number } {
  const d = emptySave();
  let fixes = 0;
  const bad = <T,>(fallback: T): T => {
    fixes++;
    return fallback;
  };
  const num = (v: unknown, fb: number) => (v === undefined ? fb : isNum(v) ? v : bad(fb));
  const str = (v: unknown, fb: string) => (v === undefined ? fb : isStr(v) ? v : bad(fb));
  const bool = (v: unknown, fb: boolean) => (v === undefined ? fb : typeof v === 'boolean' ? v : bad(fb));
  const strOrNull = (v: unknown, fb: string | null) => (v === undefined ? fb : v === null || isStr(v) ? v : bad(fb));
  const numOrNull = (v: unknown, fb: number | null) => (v === undefined ? fb : v === null || isNum(v) ? v : bad(fb));
  const obj = (v: unknown): Obj => (v === undefined ? {} : isObj(v) ? v : bad({}));
  const list = <T,>(v: unknown, fb: T[], keep: (x: unknown) => x is T): T[] => {
    if (v === undefined) return fb;
    if (!Array.isArray(v)) return bad(fb);
    const out = v.filter(keep);
    if (out.length !== v.length) fixes++;
    return out;
  };
  /** Dictionnaire dont chaque valeur passe par `each` ; une valeur rejetée (undefined) est retirée. */
  const dict = <T,>(v: unknown, each: (x: unknown) => T | undefined): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [k, x] of Object.entries(obj(v))) {
      const y = each(x);
      if (y === undefined) fixes++;
      else out[k] = y;
    }
    return out;
  };
  const numOrDrop = (x: unknown) => (isNum(x) ? x : undefined);
  const objOr = <T,>(f: (o: Obj) => T) => (x: unknown) => (isObj(x) ? f(x) : undefined);

  const p = isObj(input) ? input : bad<Obj>({});
  const streak = obj(p.streak);
  const stats = obj(p.stats);
  const league = obj(p.league);
  const settings = obj(p.settings);
  const counters = obj(p.counters);
  const boosters = obj(p.boosters);
  const quests = obj(p.quests);
  const season = obj(p.season);
  const equip = obj(p.equip);
  const multi = obj(p.multi);

  const lang = p.lang === undefined || p.lang === null ? null : LANGS.includes(p.lang as Lang) ? (p.lang as Lang) : bad(null);
  const skins = list(p.skins, d.skins, (x): x is SkinId => SKINS.includes(x as SkinId));
  if (!skins.includes('ivory')) skins.unshift('ivory');
  const skin = p.skin === undefined ? d.skin : skins.includes(p.skin as SkinId) ? (p.skin as SkinId) : bad(d.skin);
  const owned = list(p.owned, d.owned, (x): x is string => isStr(x) && !!item(x) && item(x)!.kind !== 'skin');
  // Objet équipé : il doit exister dans le catalogue pour cet emplacement, sinon valeur par défaut.
  const slot = <K extends Exclude<keyof Save['equip'], 'title'>>(k: K): Save['equip'][K] => {
    const v = equip[k];
    const fb = d.equip[k];
    if (v === undefined || v === null) return fb;
    return isStr(v) && item(`${k}:${v}`) ? (v as Save['equip'][K]) : bad(fb);
  };
  const title = equip.title === undefined ? undefined : isStr(equip.title) ? equip.title : bad(undefined);
  const last = league.last === undefined ? d.league.last : league.last === null || ['up', 'down', 'stay'].includes(league.last as string) ? (league.last as Save['league']['last']) : bad(d.league.last);

  const save: Save = {
    v: SAVE_VERSION,
    lang,
    name: str(p.name, d.name),
    city: str(p.city, d.city),
    country: str(p.country, d.country),
    tokens: num(p.tokens, d.tokens),
    premium: bool(p.premium, d.premium),
    rating: num(p.rating, d.rating),
    streak: {
      count: num(streak.count, d.streak.count),
      best: num(streak.best, d.streak.best),
      lastDay: strOrNull(streak.lastDay, d.streak.lastDay),
      freezes: num(streak.freezes, d.streak.freezes),
    },
    daily: dict(p.daily, objOr((byLang) => dict(byLang, objOr((r) => ({ score: num(r.score, 0), ms: num(r.ms, 0), mistakes: num(r.mistakes, 0), hints: num(r.hints, 0) }))))),
    campaign: dict(p.campaign, objOr((c) => ({ level: num(c.level, 1), stars: dict(c.stars, numOrDrop) }))),
    album: dict(p.album, (x) => (Array.isArray(x) ? list(x, [], isNum) : undefined)),
    stats: {
      played: num(stats.played, d.stats.played),
      won: num(stats.won, d.stats.won),
      totalMs: num(stats.totalMs, d.stats.totalMs),
      bestScore: num(stats.bestScore, d.stats.bestScore),
    },
    lastChest: strOrNull(p.lastChest, d.lastChest),
    xp: num(p.xp, d.xp),
    records: dict(p.records, objOr((byLang) => dict(byLang, objOr((r) => ({ best: num(r.best, 0), bestMs: numOrNull(r.bestMs, null), played: num(r.played, 0), wins: num(r.wins, 0) }))))),
    achievements: list(p.achievements, d.achievements, isStr),
    league: {
      week: strOrNull(league.week, d.league.week),
      tier: num(league.tier, d.league.tier),
      xp: num(league.xp, d.league.xp),
      last,
      lastRank: numOrNull(league.lastRank, d.league.lastRank),
    },
    settings: { sound: bool(settings.sound, d.settings.sound), haptics: bool(settings.haptics, d.settings.haptics) },
    tutorialDone: bool(p.tutorialDone, d.tutorialDone),
    counters: {
      noHintWins: num(counters.noHintWins, d.counters.noHintWins),
      fails: num(counters.fails, d.counters.fails),
      bossWins: num(counters.bossWins, d.counters.bossWins),
      questDays: num(counters.questDays, d.counters.questDays),
    },
    boosters: Object.fromEntries(BOOSTERS.map((b) => [b, num(boosters[b], d.boosters[b])])) as Save['boosters'],
    doubleArmed: bool(p.doubleArmed, d.doubleArmed),
    quests: strict
      ? d.quests
      : {
          day: strOrNull(quests.day, d.quests.day),
          progress: dict(quests.progress, numOrDrop),
          claimed: list(quests.claimed, d.quests.claimed, isStr),
          bonusClaimed: bool(quests.bonusClaimed, d.quests.bonusClaimed),
        },
    season: {
      id: num(season.id, d.season.id),
      xp: num(season.xp, d.season.xp),
      claimed: list(season.claimed, d.season.claimed, isNum),
      claimedPremium: list(season.claimedPremium, d.season.claimedPremium, isNum),
    },
    skins,
    skin,
    seenChapters: list(p.seenChapters, d.seenChapters, isNum),
    expDaily: dict(p.expDaily, numOrDrop),
    owned,
    equip: strict
      ? d.equip
      : {
          hat: slot('hat'),
          neck: slot('neck'),
          loupe: slot('loupe'),
          back: slot('back'),
          keyboard: slot('keyboard'),
          effect: slot('effect'),
          frame: slot('frame'),
          decor: slot('decor'),
          title,
        },
    events: dict(p.events, objOr((e) => ({ done: num(e.done, 0), currency: num(e.currency, 0), claimed: list(e.claimed, [], isNum) }))),
    packs: dict(p.packs, objOr((x) => dict(x, numOrDrop))),
    starterBought: bool(p.starterBought, d.starterBought),
    multi: strict ? d.multi : { day: str(multi.day, d.multi.day), paid: num(multi.paid, d.multi.paid) },
  };
  // Emplacements facultatifs : absents plutôt qu'à undefined, comme dans une sauvegarde d'origine.
  for (const k of ['hat', 'back', 'frame', 'title'] as const) if (save.equip[k] === undefined) delete save.equip[k];
  return { save, fixes };
}

/** Applique les migrations de format. Une sauvegarde sans numéro est traitée comme une version 1. */
function migrate(p: Obj): Obj {
  let v = typeof p.v === 'number' && Number.isInteger(p.v) && p.v >= 1 ? p.v : 1;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (step) p = step(p);
    v++;
  }
  return p;
}

function parse(raw: string | null): Obj | null {
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(raw);
    return isObj(p) ? p : null;
  } catch {
    return null;
  }
}

/** Met de côté une valeur brute avant de la remplacer ; seules les dernières copies sont gardées. */
function keepCorrupt(raw: string): void {
  try {
    localStorage.setItem(CORRUPT + new Date().toISOString().replace(/[:.]/g, '-'), raw);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CORRUPT)) keys.push(k);
    }
    keys.sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_CORRUPT))) localStorage.removeItem(k);
  } catch {
    // stockage plein ou indisponible : rien de plus à faire
  }
}

let bakDay: string | null = null;

/** Copie de secours, une fois par jour, d'une sauvegarde lue ou écrite sans erreur. */
function backupDaily(json: string): void {
  const day = today();
  if (bakDay === day) return;
  try {
    if (bakDay === null && parse(localStorage.getItem(BAK))?.day === day) {
      bakDay = day;
      return;
    }
    localStorage.setItem(BAK, `{"day":"${day}","save":${json}}`);
    bakDay = day;
  } catch {
    // copie impossible : on réessaiera à la prochaine écriture
  }
}

function readBackup(): Obj | null {
  const b = parse(localStorage.getItem(BAK));
  return b && isObj(b.save) ? b.save : null;
}

export function loadSave(): Save {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return emptySave();
  }
  if (!raw) return emptySave();
  const p = parse(raw);
  if (!p) {
    // Illisible : on garde la valeur telle quelle, puis on repart de la copie de secours si elle existe.
    keepCorrupt(raw);
    const b = readBackup();
    return b ? sanitize(migrate(b)).save : emptySave();
  }
  const newer = isNum(p.v) && p.v > SAVE_VERSION; // écrite par une version plus récente du jeu
  const { save, fixes } = sanitize(migrate(p));
  if (fixes > 0 || newer) keepCorrupt(raw);
  else backupDaily(raw);
  return save;
}

/**
 * Réparation demandée après un plantage : garde une copie de la valeur actuelle, revérifie tout,
 * et remet à zéro ce qui n'est que passager (quêtes du jour, objets équipés).
 */
export function repairSave(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) keepCorrupt(raw);
    const p = parse(raw) ?? readBackup();
    if (p) localStorage.setItem(KEY, JSON.stringify(sanitize(migrate(p), true).save));
    else localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible : le rechargement repartira d'une partie en mémoire
  }
}

/** Langue de la sauvegarde, lue sans rien supposer de son état (pour l'écran d'erreur). */
export function savedLang(): Lang | null {
  try {
    const l = parse(localStorage.getItem(KEY))?.lang;
    return LANGS.includes(l as Lang) ? (l as Lang) : null;
  } catch {
    return null;
  }
}

export function persist(s: Save): void {
  try {
    const json = JSON.stringify(s);
    localStorage.setItem(KEY, json);
    backupDaily(json);
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
