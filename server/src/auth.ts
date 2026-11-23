// Jetons de session signés (HMAC) : pas de mot de passe, un compte anonyme par appareil au départ.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const SECRET = process.env.SERVER_SECRET ?? 'dev-secret-change-me';
if (process.env.NODE_ENV === 'production' && SECRET === 'dev-secret-change-me') {
  throw new Error('SERVER_SECRET doit être défini en production');
}

const sign = (id: string) => createHmac('sha256', SECRET).update(id).digest('base64url');

export const tokenFor = (playerId: string) => `${playerId}.${sign(playerId)}`;

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [id, sig] = token.split('.');
  if (!id || !sig) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

export interface Authed extends Request { playerId: string }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const id = verifyToken(h?.startsWith('Bearer ') ? h.slice(7) : undefined);
  if (!id) return res.status(401).json({ error: 'non authentifié' });
  (req as Authed).playerId = id;
  next();
}

/**
 * Limite de débit nommée. La clé ne contient jamais le chemin (qui porte souvent un identifiant de
 * partie ou un code) : derrière `requireAuth`, on compte par joueur, sinon par adresse.
 */
export function rateLimit(name: string, max: number, windowMs: number) {
  const hits = new Map<string, { n: number; until: number }>();
  // Les entrées expirées sont balayées régulièrement pour que la table ne grossisse pas sans fin.
  setInterval(() => {
    const now = Date.now();
    for (const [k, h] of hits) if (h.until < now) hits.delete(k);
  }, Math.min(windowMs, 60_000)).unref();
  return (req: Request, res: Response, next: NextFunction) => {
    // Les tests de bout en bout créent beaucoup de comptes depuis la même adresse.
    if (process.env.NODE_ENV === 'test') return next();
    const who = (req as Partial<Authed>).playerId ?? `ip:${req.ip}`;
    const key = `${who}|${name}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.until < now) hits.set(key, { n: 1, until: now + windowMs });
    else if (++h.n > max) return res.status(429).json({ error: 'trop de requêtes' });
    next();
  };
}
