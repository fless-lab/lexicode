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

/** Limite simple par adresse : protège la création de comptes et l'envoi de parties. */
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; until: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}|${req.path}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.until < now) hits.set(key, { n: 1, until: now + windowMs });
    else if (++h.n > max) return res.status(429).json({ error: 'trop de requêtes' });
    next();
  };
}
