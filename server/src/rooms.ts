// Salles temps réel : file d'attente du duel classé, duel, salon entre amis, enquête à plusieurs.
// Chaque salle enveloppe un arbitre (src/multi/match.ts) qui tient l'état avec l'heure du serveur.

import { randomBytes } from 'node:crypto';
import { Room, matchMaker, type Client } from 'colyseus';
import { q } from './db';
import { verifyToken } from './auth';
import { LANGS } from './validate';
import { Match, eloDelta, type Event, type Profile } from '../../src/multi/match';
import { MULTI_RULES, type ResultRow, type ClientMsg, type Look, type RoomKind, type ServerMsg, type TrapKind } from '../../src/multi/protocol';
import type { Difficulty, Lang } from '../../src/engine/types';

const LOOK_KEYS = ['hat', 'neck', 'loupe', 'back', 'title', 'frame'] as const;
const word = /^[a-z_]{1,24}$/;

/** La tenue n'est que décorative : on garde des identifiants courts, rien d'autre. */
export function cleanLook(raw: unknown): Look {
  const out: Look = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of LOOK_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && (k === 'title' ? v.length <= 24 : word.test(v))) out[k] = k === 'title' ? v.replace(/[<>]/g, '') : v;
  }
  return out;
}

/** Codes de salon lisibles : pas de 0/O ni de 1/I. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(): string {
  const b = randomBytes(4);
  return [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
}

const seed = () => randomBytes(6).toString('base64url');

/** Niveau du duel selon la cote moyenne des deux joueurs. */
export function duelDifficulty(rating: number): Difficulty {
  return rating < 950 ? 2 : rating < 1100 ? 3 : rating < 1250 ? 4 : 5;
}

async function profileFor(options: Record<string, unknown>): Promise<Profile> {
  const id = verifyToken(typeof options?.token === 'string' ? options.token : undefined);
  if (!id) throw new Error('non authentifié');
  const look = cleanLook(options.look);
  const { rows } = await q<{ name: string; city: string; country: string; duel_rating: number }>(
    'update players set look = $2, last_seen = now() where id = $1 returning name, city, country, duel_rating',
    [id, JSON.stringify(look)],
  );
  if (!rows[0]) throw new Error('joueur inconnu');
  const r = rows[0];
  return { id, name: r.name || 'Anonyme', place: r.city || r.country, rating: r.duel_rating, look };
}

interface Auth {
  profile: Profile;
}

// ---------------- Salle de jeu ----------------

export class LexiRoom extends Room {
  autoDispose = true;
  maxMessagesPerSecond = 30;
  private match!: Match;
  private kind!: RoomKind;
  private allowed: string[] | null = null;
  private recorded = 0;

  onCreate(options: Record<string, unknown>) {
    const kind = options.kind as RoomKind;
    if (!['duel', 'party', 'coop'].includes(kind)) throw new Error('type de salle inconnu');
    const lang = (LANGS.includes(options.lang as Lang) ? options.lang : 'fr') as Lang;
    const d = ([1, 2, 3, 4, 5].includes(Number(options.d)) ? Number(options.d) : 2) as Difficulty;
    this.kind = kind;
    this.maxClients = MULTI_RULES.maxPlayers[kind];
    this.allowed = Array.isArray(options.allowed) ? (options.allowed as string[]) : null;
    const code = kind === 'duel' ? 'DUEL' : roomCode();
    this.match = new Match(kind, code, { lang, d, traps: kind === 'party' && options.traps !== false }, Date.now, seed);
    this.setMetadata({ code, kind, lang });
    // Personne n'entre par hasard : duel par la file d'attente, salons par leur code.
    this.setPrivate(true);

    this.onMessage('m', (client, msg: ClientMsg) => this.handle(client, msg));
    this.clock.setInterval(() => this.emit(this.match.tick()), 250);
  }

  async onAuth(_client: Client, options: Record<string, unknown>): Promise<Auth> {
    const profile = await profileFor(options);
    if (this.allowed && !this.allowed.includes(profile.id)) throw new Error('place réservée');
    return { profile };
  }

  onJoin(client: Client) {
    const { profile } = client.auth as Auth;
    const r = this.match.join(profile);
    if (!r.ok) {
      client.send('m', { t: 'error', reason: r.reason } satisfies ServerMsg);
      client.leave();
      return;
    }
    client.userData = { id: profile.id };
    if (this.kind === 'duel' && this.match.seats.length === 2 && this.match.phase === 'lobby') {
      this.match.start(null);
      this.lock();
    }
    this.sync();
  }

  async onDrop(client: Client) {
    const id = (client.userData as { id: string } | undefined)?.id;
    if (!id) return;
    this.match.setConnected(id, false);
    this.sync();
    this.allowReconnection(client, 20);
  }

  onReconnect(client: Client) {
    const id = (client.userData as { id: string }).id;
    this.match.setConnected(id, true);
    this.sync();
  }

  onLeave(client: Client) {
    const id = (client.userData as { id: string } | undefined)?.id;
    if (!id) return;
    this.emit(this.match.leave(id));
    if (this.match.phase === 'lobby' && this.kind !== 'duel') this.unlock();
    this.sync();
  }

  private handle(client: Client, msg: ClientMsg) {
    const id = (client.userData as { id: string } | undefined)?.id;
    if (!id || !msg || typeof msg !== 'object') return;
    const m = this.match;
    switch (msg.t) {
      case 'move':
        return this.emit(m.move(id, Number(msg.code), String(msg.letter)), client);
      case 'trap':
        return this.emit(m.trap(id, String(msg.target), msg.kind as TrapKind));
      case 'sync':
        return client.send('m', { t: 'state', s: m.state() } satisfies ServerMsg);
      case 'ready':
        m.setReady(id, !!msg.ready);
        return this.sync();
      case 'options':
        m.setOptions(id, msg.options ?? {});
        return this.sync();
      case 'start':
        if (m.start(id)) this.lock();
        return this.sync();
      case 'rematch':
        if (m.rematch(id)) {
          this.recorded = 0;
          if (m.phase === 'lobby') this.unlock();
        }
        return this.sync();
      case 'ping':
        if (m.phase === 'play' && this.kind === 'coop') this.broadcast('m', { t: 'ping', by: id, word: Number(msg.word) } satisfies ServerMsg);
        return;
      case 'emote':
        if (['wow', 'gg', 'think', 'hurry'].includes(msg.e)) this.broadcast('m', { t: 'emote', by: id, e: msg.e } satisfies ServerMsg);
        return;
    }
  }

  private sync() {
    this.broadcast('m', { t: 'state', s: this.match.state() } satisfies ServerMsg);
  }

  private lastPhase = 'lobby';

  private emit(events: Event[], from?: Client) {
    if (!events.length) {
      if (this.match.phase === 'play' && this.lastPhase !== 'play') this.sync();
      this.lastPhase = this.match.phase;
      return;
    }
    this.lastPhase = this.match.phase;
    for (const e of events) {
      if (e.t === 'move') {
        // En coop, chacun reçoit les lettres des autres ; en course, seule la progression circule.
        if (this.kind === 'coop') this.broadcast('m', e satisfies ServerMsg, from ? { except: from } : undefined);
      } else if (e.t === 'trapped') {
        this.broadcast('m', e satisfies ServerMsg);
      } else if (e.t === 'result') {
        void this.finish(e.ranking);
      }
    }
    this.sync();
  }

  /** Enregistre la partie et, en duel, met à jour les cotes. */
  private async finish(ranking: ResultRow[]) {
    const round = this.match.round;
    if (this.recorded === round) return;
    this.recorded = round;
    const deltas: Record<string, number> = {};
    const players = this.match.state().players;
    if (this.kind === 'duel' && ranking.length === 2) {
      const [a, b] = ranking;
      const tie = a.ms === null && b.ms === null && a.letters === b.letters && a.mistakes === b.mistakes;
      if (!tie) {
        const ra = players.find((p) => p.id === a.id)!.rating;
        const rb = players.find((p) => p.id === b.id)!.rating;
        const d = eloDelta(ra, rb);
        deltas[a.id] = d;
        deltas[b.id] = -d;
      }
    }
    this.broadcast('m', { t: 'result', ranking, ratingDelta: this.kind === 'duel' ? deltas : undefined } satisfies ServerMsg);
    try {
      const { rows } = await q<{ id: string }>(
        'insert into matches (kind, lang, code, seed, ranking) values ($1, $2, $3, $4, $5) returning id',
        [this.kind, this.match.options.lang, this.match.code, this.match.seed, JSON.stringify(ranking)],
      );
      for (const r of ranking) {
        await q('insert into match_players (match_id, player_id, rank, rating_delta) values ($1, $2, $3, $4)', [rows[0].id, r.id, r.rank, deltas[r.id] ?? 0]);
        if (deltas[r.id]) await q('update players set duel_rating = greatest(100, duel_rating + $2) where id = $1', [r.id, deltas[r.id]]);
      }
    } catch (e) {
      console.error('enregistrement de la partie impossible', e);
    }
  }
}

// ---------------- File d'attente du duel classé ----------------

interface Waiting {
  client: Client;
  profile: Profile;
  token: string;
  look: Look;
  since: number;
}

/** Écart de cote accepté : il s'élargit avec l'attente pour que personne n'attende indéfiniment. */
export function tolerance(waitedMs: number): number {
  return 100 + Math.floor(waitedMs / 1000) * 20;
}

export class QueueRoom extends Room {
  autoDispose = true;
  maxClients = 500;
  private waiting: Waiting[] = [];
  private lang: Lang = 'fr';
  private busy = false;

  onCreate(options: Record<string, unknown>) {
    this.lang = (LANGS.includes(options.lang as Lang) ? options.lang : 'fr') as Lang;
    this.clock.setInterval(() => void this.pair(), 1000);
    this.clock.setInterval(() => void this.announce(), 3000);
  }

  async onAuth(_client: Client, options: Record<string, unknown>): Promise<{ profile: Profile; token: string }> {
    return { profile: await profileFor(options), token: String(options.token) };
  }

  onJoin(client: Client) {
    const { profile, token } = client.auth as { profile: Profile; token: string };
    // Un joueur ne peut pas être deux fois dans la file (deux onglets).
    for (const w of this.waiting.filter((x) => x.profile.id === profile.id)) w.client.leave();
    this.waiting = this.waiting.filter((x) => x.profile.id !== profile.id);
    this.waiting.push({ client, profile, token, look: profile.look, since: Date.now() });
    void this.announce();
  }

  onLeave(client: Client) {
    this.waiting = this.waiting.filter((w) => w.client !== client);
  }

  private async announce() {
    try {
      const rooms = await matchMaker.query({});
      const online = rooms.reduce((n, r) => n + r.clients, 0);
      this.broadcast('m', { t: 'queue', waiting: this.waiting.length, online });
    } catch (e) {
      console.error('file d\'attente : annonce impossible', e);
    }
  }

  private async pair() {
    if (this.busy || this.waiting.length < 2) return;
    this.busy = true;
    try {
      const now = Date.now();
      const list = [...this.waiting].sort((a, b) => a.since - b.since);
      const taken = new Set<Waiting>();
      for (const a of list) {
        if (taken.has(a)) continue;
        let best: Waiting | null = null;
        for (const b of list) {
          if (b === a || taken.has(b)) continue;
          const gap = Math.abs(a.profile.rating - b.profile.rating);
          if (gap > tolerance(now - Math.min(a.since, b.since))) continue;
          if (!best || gap < Math.abs(a.profile.rating - best.profile.rating)) best = b;
        }
        if (!best) continue;
        taken.add(a);
        taken.add(best);
        try {
          await this.launch(a, best);
        } catch (e) {
          // Salle non créée ou place non réservée : les deux joueurs restent dans la file et seront
          // appariés au prochain tour, au lieu d'un rejet non rattrapé qui ferait tomber le serveur.
          console.error('file d\'attente : lancement du duel impossible', e);
          taken.delete(a);
          taken.delete(best);
        }
      }
      this.waiting = this.waiting.filter((w) => !taken.has(w));
    } finally {
      this.busy = false;
    }
  }

  private async launch(a: Waiting, b: Waiting) {
    const d = duelDifficulty((a.profile.rating + b.profile.rating) / 2);
    const room = await matchMaker.createRoom('duel', { kind: 'duel', lang: this.lang, d, allowed: [a.profile.id, b.profile.id] });
    for (const w of [a, b]) {
      const reservation = await matchMaker.reserveSeatFor(room, { token: w.token, look: w.look }, { profile: w.profile });
      w.client.send('m', { t: 'match', reservation });
    }
  }
}

/** Trouve un salon ouvert par son code. */
export async function findRoom(code: string): Promise<{ roomId: string; kind: RoomKind } | null> {
  const rooms = await matchMaker.query({ private: true });
  const r = rooms.find((x) => (x.metadata as { code?: string } | undefined)?.code === code && x.name !== 'duel');
  return r ? { roomId: r.roomId, kind: (r.metadata as { kind: RoomKind }).kind } : null;
}
