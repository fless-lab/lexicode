// Arbitre d'une partie à plusieurs, sans réseau : le serveur l'enveloppe dans une salle Colyseus.
// Toutes les décisions (départ, frappes, pièges, fin, classement) se prennent ici, avec l'heure
// du serveur, à partir du moteur commun. Le téléphone ne fait que proposer ses frappes.

import { PACKS } from '../content';
import { practicePuzzle } from '../engine/generator';
import { initGame, isCorrect, select, selFor, typeLetter, wordSolved } from '../engine/game';
import type { GameState } from '../engine/game';
import type { Difficulty, Lang, Puzzle } from '../engine/types';
import {
  MULTI_RULES, type Look, type Phase, type PlayerPub, type ResultRow, type RoomKind, type RoomOptions, type RoomState, type TrapKind,
} from './protocol';

/** Grille d'une partie à plusieurs : tout le monde la régénère à l'identique à partir de la graine. */
export function multiPuzzle(lang: Lang, d: Difficulty, seed: string): Puzzle {
  return practicePuzzle(PACKS[lang], d, `mp-${seed}`);
}

/** Grille d'un défi entre amis (graine tirée par le serveur). */
export function challengePuzzle(lang: Lang, d: Difficulty, nonce: string): Puzzle {
  return practicePuzzle(PACKS[lang], d, `ch-${nonce}`);
}

/** Lettres à trouver : celles de la phrase qui ne sont pas données au départ (la grille est finie quand elles le sont). */
export function lettersToFind(p: Puzzle): number[] {
  const set = new Set<number>();
  for (const c of p.phrase) if (c.kind === 'letter' && !p.given.includes(c.code)) set.add(c.code);
  return [...set].sort((a, b) => a - b);
}

/** En dessous de cet écart, aucune main humaine ne tape. */
export const MIN_GAP_MS = 60;

export interface Profile {
  id: string;
  name: string;
  place: string;
  rating: number;
  look: Look;
}

interface Seat extends Profile {
  color: number;
  host: boolean;
  ready: boolean;
  connected: boolean;
  game: GameState | null;
  /** Coop : lettres trouvées par ce joueur. */
  found: number;
  usedTraps: number;
  immuneUntil: number;
  lastMove: number;
  doneAt: number | null;
  rematch: boolean;
}

export type Event =
  | { t: 'move'; by: string; code: number; letter: string; ok: boolean }
  | { t: 'trapped'; by: string; target: string; kind: TrapKind; until: number }
  | { t: 'result'; ranking: ResultRow[] };

export class Match {
  phase: Phase = 'lobby';
  seats: Seat[] = [];
  seed: string | null = null;
  startAt: number | null = null;
  endAt: number | null = null;
  puzzle: Puzzle | null = null;
  /** Coop : une seule partie pour toute l'équipe. */
  shared: GameState | null = null;
  teamLives: number | null = null;
  clueOwner: string[] | null = null;
  round = 0;

  constructor(
    readonly kind: RoomKind,
    readonly code: string,
    public options: RoomOptions,
    private readonly now: () => number = Date.now,
    private readonly newSeed: () => string = () => Math.random().toString(36).slice(2, 10),
  ) {}

  get max() {
    return MULTI_RULES.maxPlayers[this.kind];
  }

  seat(id: string) {
    return this.seats.find((s) => s.id === id);
  }

  join(p: Profile): { ok: true } | { ok: false; reason: string } {
    const back = this.seat(p.id);
    if (back) {
      back.connected = true;
      return { ok: true };
    }
    if (this.phase !== 'lobby') return { ok: false, reason: 'partie en cours' };
    if (this.seats.length >= this.max) return { ok: false, reason: 'salon complet' };
    const used = new Set(this.seats.map((s) => s.color));
    const color = [0, 1, 2, 3, 4].find((c) => !used.has(c)) ?? 0;
    this.seats.push({
      ...p,
      color,
      host: this.seats.length === 0 && this.kind !== 'duel',
      ready: this.kind === 'duel',
      connected: true,
      game: null,
      found: 0,
      usedTraps: 0,
      immuneUntil: 0,
      lastMove: 0,
      doneAt: null,
      rematch: false,
    });
    return { ok: true };
  }

  /** Départ définitif (après le délai de reconnexion). */
  leave(id: string): Event[] {
    const s = this.seat(id);
    if (!s) return [];
    if (this.phase === 'lobby') {
      this.seats = this.seats.filter((x) => x.id !== id);
      if (s.host && this.seats[0]) this.seats[0].host = true;
      return [];
    }
    s.connected = false;
    if (s.host) {
      const next = this.seats.find((x) => x.connected);
      if (next) {
        s.host = false;
        next.host = true;
      }
    }
    return this.tick();
  }

  setConnected(id: string, on: boolean) {
    const s = this.seat(id);
    if (s) s.connected = on;
  }

  setReady(id: string, ready: boolean) {
    const s = this.seat(id);
    if (s && this.phase === 'lobby') s.ready = ready;
  }

  setOptions(id: string, o: Partial<RoomOptions>) {
    const s = this.seat(id);
    if (!s?.host || this.phase !== 'lobby') return;
    if (o.d && [1, 2, 3, 4, 5].includes(o.d)) this.options.d = o.d;
    if (typeof o.traps === 'boolean' && this.kind === 'party') this.options.traps = o.traps;
  }

  canStart(): boolean {
    const here = this.seats.filter((s) => s.connected);
    return this.phase === 'lobby' && here.length >= MULTI_RULES.minPlayers[this.kind] && here.every((s) => s.ready || s.host);
  }

  /** L'hôte lance (le duel se lance seul quand les deux joueurs sont là). */
  start(by: string | null): boolean {
    if (by !== null && !this.seat(by)?.host) return false;
    if (!this.canStart()) return false;
    this.seats = this.seats.filter((s) => s.connected);
    this.round++;
    this.seed = `${this.newSeed()}-${this.round}`;
    this.puzzle = multiPuzzle(this.options.lang, this.options.d, this.seed);
    const t = this.now();
    this.startAt = t + MULTI_RULES.countdownMs;
    this.endAt = this.startAt + MULTI_RULES.timeMs;
    this.phase = 'countdown';
    for (const s of this.seats) {
      s.game = initGame(this.puzzle, this.startAt, null);
      s.found = 0;
      s.usedTraps = 0;
      s.immuneUntil = 0;
      s.lastMove = 0;
      s.doneAt = null;
      s.rematch = false;
    }
    if (this.kind === 'coop') {
      this.shared = initGame(this.puzzle, this.startAt, null);
      this.teamLives = MULTI_RULES.coopLives;
      // Les indices sont répartis à tour de rôle : chacun en voit une partie seulement.
      this.clueOwner = this.puzzle.words.map((_, i) => this.seats[i % this.seats.length].id);
    } else {
      this.shared = null;
      this.teamLives = null;
      this.clueOwner = null;
    }
    return true;
  }

  private gameOf(s: Seat): GameState | null {
    return this.kind === 'coop' ? this.shared : s.game;
  }

  private letters(g: GameState | null): number {
    if (!g || !this.puzzle) return 0;
    return lettersToFind(this.puzzle).filter((c) => isCorrect(g, c)).length;
  }

  private words(g: GameState | null): number {
    if (!g || !this.puzzle) return 0;
    return this.puzzle.words.filter((_, i) => wordSolved(g, i)).length;
  }

  private doneMs(s: Seat): number | null {
    if (s.doneAt === null || this.startAt === null) return null;
    const g = this.gameOf(s);
    const penalty = this.kind === 'coop' ? 0 : (g?.mistakes ?? 0) * MULTI_RULES.mistakePenaltyMs;
    return s.doneAt - this.startAt + penalty;
  }

  /** Une frappe proposée par un joueur. */
  move(id: string, code: number, letter: string): Event[] {
    const s = this.seat(id);
    const t = this.now();
    // Le départ peut tomber entre deux battements de l'horloge de la salle.
    if (this.phase === 'countdown' && t >= (this.startAt ?? Infinity)) this.phase = 'play';
    if (!s || !this.puzzle || this.phase !== 'play' || t < (this.startAt ?? 0) || s.doneAt !== null) return [];
    if (!Number.isInteger(code) || code < 1 || code > this.puzzle.maxCode || typeof letter !== 'string' || !/^[A-Z]$/.test(letter)) return [];
    if (t - s.lastMove < MIN_GAP_MS) return [];
    s.lastMove = t;
    const sel = selFor(this.puzzle, code);
    if (!sel) return [];
    const g = this.gameOf(s)!;
    if (isCorrect(g, code)) return [];
    const next = typeLetter(select(g, sel), letter, t);
    const ok = isCorrect(next, code);
    if (this.kind === 'coop') {
      this.shared = next;
      if (ok) s.found++;
      else if (next.mistakes > g.mistakes) this.teamLives = Math.max(0, (this.teamLives ?? 0) - 1);
      if (next.finished) for (const x of this.seats) x.doneAt = t;
    } else {
      s.game = next;
      if (next.finished) s.doneAt = t;
    }
    return [{ t: 'move', by: id, code, letter, ok }, ...this.tick()];
  }

  trapsLeft(s: Seat): number {
    if (!this.options.traps || this.kind === 'coop') return 0;
    return Math.floor(this.words(s.game) / MULTI_RULES.wordsPerTrap) - s.usedTraps;
  }

  trap(id: string, target: string, kind: TrapKind): Event[] {
    const s = this.seat(id);
    const v = this.seat(target);
    const t = this.now();
    if (!s || !v || s === v || this.phase !== 'play' || this.trapsLeft(s) <= 0) return [];
    if (!(kind in MULTI_RULES.trapMs) || v.doneAt !== null || !v.connected || t < v.immuneUntil) return [];
    s.usedTraps++;
    const until = t + MULTI_RULES.trapMs[kind];
    v.immuneUntil = until + MULTI_RULES.trapImmunityMs;
    return [{ t: 'trapped', by: id, target, kind, until }];
  }

  /** Avance les phases ; à appeler régulièrement et après chaque événement. */
  tick(): Event[] {
    const t = this.now();
    if (this.phase === 'countdown' && t >= (this.startAt ?? 0)) this.phase = 'play';
    if (this.phase !== 'play') return [];
    const here = this.seats.filter((s) => s.connected);
    const running = here.filter((s) => s.doneAt === null);
    const over =
      t >= (this.endAt ?? Infinity) ||
      running.length === 0 ||
      (this.kind === 'coop' && (this.teamLives ?? 1) <= 0) ||
      // Seul en lice : en duel, l'autre a abandonné ; à plusieurs, il n'y a plus de course.
      (this.kind !== 'coop' && here.length <= 1 && this.seats.length > 1);
    if (!over) return [];
    this.phase = 'done';
    return [{ t: 'result', ranking: this.ranking() }];
  }

  ranking(): ResultRow[] {
    const rows = this.seats.map((s) => {
      const g = this.gameOf(s);
      return {
        id: s.id,
        rank: 0,
        ms: this.doneMs(s),
        letters: this.kind === 'coop' ? s.found : this.letters(g),
        words: this.words(g),
        mistakes: g?.mistakes ?? 0,
        gone: !s.connected,
      };
    });
    rows.sort(
      (a, b) =>
        Number(a.gone) - Number(b.gone) ||
        (a.ms ?? Infinity) - (b.ms ?? Infinity) ||
        b.letters - a.letters ||
        a.mistakes - b.mistakes,
    );
    return rows.map(({ gone: _gone, ...r }, i) => ({ ...r, rank: i + 1 }));
  }

  /** Revanche : quand tous les joueurs encore là l'ont demandée, on repart du salon. */
  rematch(id: string): boolean {
    const s = this.seat(id);
    if (!s || this.phase !== 'done') return false;
    s.rematch = true;
    const here = this.seats.filter((x) => x.connected);
    if (!here.every((x) => x.rematch)) return false;
    this.seats = here;
    this.phase = 'lobby';
    for (const x of this.seats) x.ready = this.kind === 'duel';
    if (!this.seats.some((x) => x.host) && this.kind !== 'duel') this.seats[0].host = true;
    if (this.kind === 'duel') return this.start(null);
    return true;
  }

  pub(s: Seat): PlayerPub {
    const g = this.gameOf(s);
    return {
      id: s.id,
      name: s.name,
      place: s.place,
      rating: s.rating,
      look: s.look,
      color: s.color,
      host: s.host,
      ready: s.ready,
      connected: s.connected,
      letters: this.kind === 'coop' ? s.found : this.letters(g),
      words: this.words(g),
      mistakes: g?.mistakes ?? 0,
      doneMs: this.doneMs(s),
      traps: this.trapsLeft(s),
    };
  }

  state(): RoomState {
    return {
      kind: this.kind,
      code: this.code,
      phase: this.phase,
      options: this.options,
      players: this.seats.map((s) => this.pub(s)),
      total: this.puzzle ? lettersToFind(this.puzzle).length : 0,
      seed: this.seed,
      startAt: this.startAt,
      endAt: this.endAt,
      clueOwner: this.clueOwner,
      teamLives: this.teamLives,
    };
  }
}

/** Cote de duel (Elo, K = 24). */
export function eloDelta(winner: number, loser: number, k = 24): number {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  return Math.round(k * (1 - expected));
}
