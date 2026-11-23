// Connexion aux salles temps réel du serveur Lexicode (Colyseus).
// L'interface ne voit que l'état de salle et les messages du protocole (multi/protocol.ts).

import { Client, type Room } from '@colyseus/sdk';
import type { Lang, Difficulty } from '../engine/types';
import type { ClientMsg, Look, RoomKind, RoomState, ServerMsg } from '../multi/protocol';
import { API_BASE, apiEnabled, ensureSession, findRoomByCode, sessionToken } from './api';

let client: Client | null = null;
const sdk = () => (client ??= new Client(API_BASE));

export type Profile = { name: string; city: string; country: string };

async function auth(profile: Profile, look: Look) {
  if (!apiEnabled) throw new Error('offline');
  await ensureSession(profile);
  const token = sessionToken();
  if (!token) throw new Error('offline');
  return { token, look };
}

/** Une salle de jeu ouverte : état courant, messages, envoi. */
export class Conn {
  state: RoomState | null = null;
  readonly meId: string;
  private listeners = new Set<(m: ServerMsg) => void>();

  constructor(
    private readonly room: Room,
    meId: string,
  ) {
    this.meId = meId;
    room.onMessage('m', (m: ServerMsg) => {
      if (m.t === 'state') this.state = m.s;
      for (const l of this.listeners) l(m);
    });
    room.onLeave(() => {
      for (const l of this.listeners) l({ t: 'error', reason: 'left' });
    });
    // Abonné : on demande l'état complet (les premiers messages ont pu partir avant).
    this.send({ t: 'sync' });
  }

  on(fn: (m: ServerMsg) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  send(m: ClientMsg) {
    try {
      this.room.send('m', m);
    } catch {
      /* connexion en cours de reprise : le serveur renverra l'état */
    }
  }

  leave() {
    this.listeners.clear();
    void this.room.leave().catch(() => undefined);
  }
}

function meId(): string {
  const t = sessionToken();
  return t ? t.split('.')[0] : '';
}

/** File d'attente du duel classé : appelle onQueue pour l'affichage, puis résout avec la salle de duel. */
export function findDuel(lang: Lang, profile: Profile, look: Look, onQueue: (q: { waiting: number; online: number }) => void): { promise: Promise<Conn>; cancel: () => void } {
  let queue: Room | null = null;
  let cancelled = false;
  const promise = (async () => {
    const opts = await auth(profile, look);
    queue = await sdk().joinOrCreate('queue', { lang, ...opts });
    if (cancelled) {
      void queue.leave();
      throw new Error('cancelled');
    }
    return await new Promise<Conn>((resolve, reject) => {
      queue!.onMessage('m', async (m: { t: string; waiting?: number; online?: number; reservation?: unknown }) => {
        if (m.t === 'queue') onQueue({ waiting: m.waiting ?? 0, online: m.online ?? 0 });
        if (m.t === 'match') {
          try {
            const room = await sdk().consumeSeatReservation(m.reservation as never);
            void queue!.leave();
            resolve(new Conn(room, meId()));
          } catch (e) {
            reject(e);
          }
        }
      });
      queue!.onLeave(() => {
        if (cancelled) reject(new Error('cancelled'));
      });
    });
  })();
  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (queue) void queue.leave();
    },
  };
}

export async function createRoom(kind: Exclude<RoomKind, 'duel'>, lang: Lang, d: Difficulty, profile: Profile, look: Look): Promise<Conn> {
  const opts = await auth(profile, look);
  const room = await sdk().create(kind, { lang, d, ...opts });
  return new Conn(room, meId());
}

export async function joinByCode(code: string, profile: Profile, look: Look): Promise<Conn> {
  const opts = await auth(profile, look);
  const found = await findRoomByCode(code.toUpperCase());
  const room = await sdk().joinById(found.roomId, opts);
  return new Conn(room, meId());
}

/** Nombre de joueurs connectés aux salles, pour l'accueil. */
export async function onlineCount(): Promise<number | null> {
  if (!apiEnabled) return null;
  try {
    const res = await fetch(`${API_BASE}/v1/online`);
    return res.ok ? ((await res.json()) as { online: number }).online : null;
  } catch {
    return null;
  }
}
