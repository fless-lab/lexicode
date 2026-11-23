import type { Lang } from '../engine/types';
import type { Mode } from '../modes';

/**
 * Client du serveur Lexicode. Sans `VITE_API_URL`, tout reste local : le jeu fonctionne
 * hors ligne et les classements affichent la démonstration.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const KEY = 'lexicode.session';

export const apiEnabled = BASE !== '';

type Session = { id: string; token: string };
type Log = [number, number, string][];

let session: Session | null = null;
let pending: Promise<Session | null> | null = null;

function stored(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 4000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (session) headers.authorization = `Bearer ${session.token}`;
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Identité anonyme créée au premier appel puis gardée sur l'appareil. */
export async function ensureSession(profile: { name: string; city: string; country: string }): Promise<Session | null> {
  if (!apiEnabled) return null;
  if (session) return session;
  session = stored();
  if (session) return session;
  pending ??= call<Session>('/v1/auth/anon', { method: 'POST', body: JSON.stringify(profile) })
    .then((s) => {
      session = s;
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* stockage indisponible : la session vivra le temps de l'onglet */
      }
      return s;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function myId(): string | null {
  return session?.id ?? stored()?.id ?? null;
}

export async function syncProfile(profile: { name: string; city: string; country: string }): Promise<void> {
  if (!(await ensureSession(profile))) return;
  await call('/v1/me', { method: 'PATCH', body: JSON.stringify(profile) }).catch(() => undefined);
}

/** Ouvre une partie classée. Pour l'arène, le serveur choisit la graine. */
export async function openGame(lang: Lang, mode: Mode, profile: { name: string; city: string; country: string }): Promise<{ gameId: string; mode: Mode } | null> {
  if (!(await ensureSession(profile))) return null;
  try {
    return await call<{ gameId: string; mode: Mode }>('/v1/games', { method: 'POST', body: JSON.stringify({ lang, mode: { kind: mode.kind, d: mode.d, date: mode.date } }) }, 2500);
  } catch {
    return null;
  }
}

export type Verdict = { score: number; ms: number; grids?: number; rank: number | null } | { rejected: string };

/** Envoie le journal des coups ; le serveur rejoue la partie et recalcule le score. */
export async function finishGame(gameId: string, logs: Log[]): Promise<Verdict | null> {
  try {
    return await call<Verdict>(`/v1/games/${gameId}/finish`, { method: 'POST', body: JSON.stringify({ logs }) }, 8000);
  } catch (e) {
    const status = (e as { status?: number }).status;
    return status === 422 ? { rejected: (e as Error).message } : null;
  }
}

export type BoardRow = { name: string; place: string; score: number; ms: number; isYou?: boolean };

export async function fetchBoard(lang: Lang, key: string, scope: 'world' | 'country' | 'city', place: string): Promise<{ rows: BoardRow[]; rank: number | null }> {
  const qs = new URLSearchParams({ scope, place });
  const me = myId();
  if (me) qs.set('me', me);
  return call(`/v1/boards/${lang}/${encodeURIComponent(key)}?${qs}`);
}
