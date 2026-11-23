// API HTTP du serveur Lexicode : comptes, parties classées vérifiées, classements, fantômes, événements.
import express, { type Request, type Response } from 'express';
import { q } from './db';
import { tokenFor, requireAuth, rateLimit, type Authed } from './auth';
import { LANGS, boardKey, checkMode, judge, arenaNonce, type Log } from './validate';
import type { Lang } from '../../src/engine/types';
import type { Mode } from '../../src/modes';

const today = () => new Date().toISOString().slice(0, 10);
const isLang = (x: unknown): x is Lang => LANGS.includes(x as Lang);
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    // L'application (Capacitor) et la version web appellent l'API depuis d'autres origines.
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      await q('select 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // ---------- Comptes ----------

  app.post('/v1/auth/anon', rateLimit(10, 3_600_000), async (req, res) => {
    const name = clean(req.body?.name, 16);
    const { rows } = await q<{ id: string }>('insert into players (name, city, country) values ($1, $2, $3) returning id', [name, clean(req.body?.city, 40), clean(req.body?.country, 40)]);
    res.json({ id: rows[0].id, token: tokenFor(rows[0].id) });
  });

  app.patch('/v1/me', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    const name = clean(req.body?.name, 16);
    const { rows } = await q('update players set name = coalesce(nullif($2, \'\'), name), city = $3, country = $4, last_seen = now() where id = $1 returning id, name, city, country, rating', [id, name, clean(req.body?.city, 40), clean(req.body?.country, 40)]);
    if (!rows[0]) return res.status(404).json({ error: 'joueur inconnu' });
    res.json(rows[0]);
  });

  // ---------- Parties classées ----------

  /** Ouvre une partie : le serveur note l'heure et, pour l'arène, tire la graine. */
  app.post('/v1/games', requireAuth, rateLimit(120, 3_600_000), async (req, res) => {
    const id = (req as Authed).playerId;
    const lang = req.body?.lang;
    const base = checkMode(req.body?.mode, today());
    if (!isLang(lang) || !base) return res.status(400).json({ error: 'mode non classé' });
    const mode: Mode = base.kind === 'daily' ? base : { ...base, nonce: arenaNonce() };
    const key = boardKey(mode)!;
    const { rows } = await q<{ id: string }>('insert into games (player_id, lang, mode, board_key) values ($1, $2, $3, $4) returning id', [id, lang, mode, key]);
    res.json({ gameId: rows[0].id, mode });
  });

  /** Termine une partie : le journal est rejoué, le score recalculé et enregistré s'il est meilleur. */
  app.post('/v1/games/:id/finish', requireAuth, rateLimit(120, 3_600_000), async (req: Request, res: Response) => {
    const playerId = (req as Authed).playerId;
    const { rows } = await q<{ id: string; lang: Lang; mode: Mode; board_key: string; status: string; wall: number }>(
      `select id, lang, mode, board_key, status, extract(epoch from (now() - started_at)) * 1000 as wall
       from games where id = $1 and player_id = $2`,
      [req.params.id, playerId],
    );
    const g = rows[0];
    if (!g) return res.status(404).json({ error: 'partie inconnue' });
    if (g.status !== 'open') return res.status(409).json({ error: 'partie déjà terminée' });

    const logs: Log[] = Array.isArray(req.body?.logs) ? req.body.logs.slice(0, 200) : [];
    const v = judge(g.lang, g.mode, logs, Number(g.wall));
    if (!v.ok) {
      await q("update games set status = 'rejected', finished_at = now() where id = $1", [g.id]);
      return res.status(422).json({ error: v.reason ?? 'partie refusée' });
    }
    await q("update games set status = 'won', finished_at = now(), score = $2, ms = $3 where id = $1", [g.id, v.score, v.ms]);
    await q(
      `insert into scores (player_id, lang, board_key, score, ms, game_id) values ($1, $2, $3, $4, $5, $6)
       on conflict (player_id, lang, board_key) do update set score = excluded.score, ms = excluded.ms, game_id = excluded.game_id, updated_at = now()
       where excluded.score > scores.score or (excluded.score = scores.score and excluded.ms < scores.ms)`,
      [playerId, g.lang, g.board_key, v.score, v.ms, g.id],
    );
    const { rows: pr } = await q<{ rating: number }>('select rating from players where id = $1', [playerId]);
    await q('insert into ghosts (game_id, player_id, lang, board_key, mode, rating, ms, log) values ($1, $2, $3, $4, $5, $6, $7, $8)', [g.id, playerId, g.lang, g.board_key, g.mode, pr[0]?.rating ?? 1000, v.ms, JSON.stringify(logs)]);
    const rank = await myRank(g.lang, g.board_key, playerId);
    res.json({ score: v.score, ms: v.ms, grids: v.grids, rank });
  });

  // ---------- Classements ----------

  app.get('/v1/boards/:lang/:key', async (req, res) => {
    const { lang, key } = req.params;
    if (!isLang(lang)) return res.status(400).json({ error: 'langue inconnue' });
    const scope = String(req.query.scope ?? 'world');
    const place = clean(req.query.place, 40);
    const me = typeof req.query.me === 'string' ? req.query.me : null;
    const filter = scope === 'country' ? 'and p.country = $3' : scope === 'city' ? 'and p.city = $3' : '';
    const params: unknown[] = [lang, key];
    if (filter) params.push(place);
    const { rows } = await q(
      `select p.id, p.name, case when $${params.length + 1}::text = 'world' then p.country else p.city end as place, s.score, s.ms
       from scores s join players p on p.id = s.player_id
       where s.lang = $1 and s.board_key = $2 ${filter}
       order by s.score desc, s.ms asc limit 100`,
      [...params, scope],
    );
    const out = rows.map((r) => ({ name: r.name || 'Anonyme', place: r.place, score: r.score, ms: r.ms, isYou: r.id === me }));
    const rank = me ? await myRank(lang, key, me) : null;
    res.json({ rows: out, rank });
  });

  // ---------- Fantômes ----------

  /** Une partie enregistrée d'un joueur de niveau proche, pour courir contre elle. */
  app.get('/v1/ghosts/:lang/:key', requireAuth, async (req, res) => {
    const { lang, key } = req.params;
    const rating = Number(req.query.rating ?? 1000);
    const { rows } = await q(
      `select g.mode, g.ms, g.log, p.name, g.rating from ghosts g join players p on p.id = g.player_id
       where g.lang = $1 and g.board_key = $2 and g.player_id <> $3
       order by abs(g.rating - $4), random() limit 1`,
      [lang, key, (req as Authed).playerId, rating],
    );
    if (!rows[0]) return res.status(404).json({ error: 'aucun fantôme' });
    res.json(rows[0]);
  });

  // ---------- Événements à distance ----------

  app.get('/v1/events', async (_req, res) => {
    const { rows } = await q('select data from events where enabled and ends >= current_date - 1 order by starts');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(rows.map((r) => r.data));
  });

  return app;
}

async function myRank(lang: string, key: string, playerId: string): Promise<number | null> {
  const { rows } = await q<{ rank: string }>(
    `select 1 + count(*) as rank from scores s, (select score, ms from scores where lang = $1 and board_key = $2 and player_id = $3) me
     where s.lang = $1 and s.board_key = $2 and (s.score > me.score or (s.score = me.score and s.ms < me.ms))`,
    [lang, key, playerId],
  );
  return rows[0] ? Number(rows[0].rank) : null;
}
