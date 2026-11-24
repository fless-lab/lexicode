// API HTTP du serveur Lexicode : comptes, parties classées vérifiées, classements, fantômes, événements.
import express, { type Request, type Response } from 'express';
import { q, tx } from './db';
import { tokenFor, requireAuth, rateLimit, type Authed } from './auth';
import { randomInt } from 'node:crypto';
import { LANGS, boardKey, checkMode, judge, judgeChallenge, arenaNonce, type Log } from './validate';
import { findRoom, roomCode } from './rooms';
import { matchMaker } from 'colyseus';
import type { Difficulty } from '../../src/engine/types';
import type { Lang } from '../../src/engine/types';
import type { Mode } from '../../src/modes';

const today = () => new Date().toISOString().slice(0, 10);
const isLang = (x: unknown): x is Lang => LANGS.includes(x as Lang);
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');
/** Un identifiant mal formé ferait échouer la requête SQL (erreur 500) : on le refuse avant. */
const isUuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

/** Code ami : 6 caractères sans les lettres et chiffres qu'on confond (0/O, 1/I/L). */
const FRIEND_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const MAX_FRIENDS = 100;
const isFriendCode = (x: unknown): x is string => typeof x === 'string' && /^[A-HJKMNP-Z2-9]{6}$/.test(x);

/** Code ami du joueur, créé à la première demande. */
async function friendCode(playerId: string): Promise<string> {
  const { rows } = await q<{ friend_code: string | null }>('select friend_code from players where id = $1', [playerId]);
  if (rows[0]?.friend_code) return rows[0].friend_code;
  for (let i = 0; i < 8; i++) {
    const code = Array.from({ length: 6 }, () => FRIEND_ALPHABET[randomInt(FRIEND_ALPHABET.length)]).join('');
    const r = await q<{ friend_code: string }>(
      `update players set friend_code = coalesce(friend_code, $2) where id = $1
       and not exists (select 1 from players where friend_code = $2) returning friend_code`,
      [playerId, code],
    ).catch(() => ({ rows: [] as { friend_code: string }[] }));
    if (r.rows[0]) return r.rows[0].friend_code;
  }
  throw new Error('code ami indisponible');
}

/** Fantômes gardés par langue, tableau et tranche de 100 points de cote : les plus récents. */
export const GHOSTS_PER_BUCKET = 50;

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

  app.post('/v1/auth/anon', rateLimit('anon', 10, 3_600_000), async (req, res) => {
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
  app.post('/v1/games', requireAuth, rateLimit('open', 120, 3_600_000), async (req, res) => {
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
  app.post('/v1/games/:id/finish', requireAuth, rateLimit('finish', 120, 3_600_000), async (req: Request, res: Response) => {
    const playerId = (req as Authed).playerId;
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'partie inconnue' });
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
    // Chaque écriture ne vaut que si la partie est encore ouverte : deux envois simultanés du même
    // journal ne peuvent pas être comptés deux fois (le second attend le verrou, puis ne trouve plus rien).
    if (!v.ok) {
      const r = await q("update games set status = 'rejected', finished_at = now() where id = $1 and status = 'open'", [g.id]);
      if (!r.rowCount) return res.status(409).json({ error: 'partie déjà terminée' });
      return res.status(422).json({ error: v.reason ?? 'partie refusée' });
    }
    const saved = await tx(async (c) => {
      const u = await c.query("update games set status = 'won', finished_at = now(), score = $2, ms = $3 where id = $1 and status = 'open'", [g.id, v.score, v.ms]);
      if (!u.rowCount) return false;
      await c.query(
        `insert into scores (player_id, lang, board_key, score, ms, game_id) values ($1, $2, $3, $4, $5, $6)
         on conflict (player_id, lang, board_key) do update set score = excluded.score, ms = excluded.ms, game_id = excluded.game_id, updated_at = now()
         where excluded.score > scores.score or (excluded.score = scores.score and excluded.ms < scores.ms)`,
        [playerId, g.lang, g.board_key, v.score, v.ms, g.id],
      );
      const { rows: pr } = await c.query<{ rating: number }>('select rating from players where id = $1', [playerId]);
      const rating = pr[0]?.rating ?? 1000;
      await c.query('insert into ghosts (game_id, player_id, lang, board_key, mode, rating, ms, log) values ($1, $2, $3, $4, $5, $6, $7, $8)', [g.id, playerId, g.lang, g.board_key, g.mode, rating, v.ms, JSON.stringify(logs)]);
      return rating;
    });
    if (saved === false) return res.status(409).json({ error: 'partie déjà terminée' });
    // Plafond des fantômes : les plus anciens de la même tranche de cote disparaissent. Hors de la
    // transaction et sans attendre : un retard ou un échec ici ne doit pas faire perdre la partie.
    const bucket = Math.floor(saved / 100) * 100;
    q(
      `delete from ghosts where id in (
         select id from ghosts where lang = $1 and board_key = $2 and rating >= $3 and rating < $3 + 100
         order by created_at desc offset $4 limit 20)`,
      [g.lang, g.board_key, bucket, GHOSTS_PER_BUCKET],
    ).catch((e) => console.error('plafond des fantômes', e));
    const rank = await myRank(g.lang, g.board_key, playerId);
    res.json({ score: v.score, ms: v.ms, grids: v.grids, rank });
  });

  // ---------- Classements ----------

  app.get('/v1/boards/:lang/:key', async (req, res) => {
    const { lang, key } = req.params;
    if (!isLang(lang)) return res.status(400).json({ error: 'langue inconnue' });
    const scope = String(req.query.scope ?? 'world');
    const place = clean(req.query.place, 40);
    const me = isUuid(req.query.me) ? req.query.me : null;
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
    const asked = Number(req.query.rating ?? 1000);
    const rating = Number.isFinite(asked) ? Math.round(Math.min(10_000, Math.max(0, asked))) : 1000;
    // Deux parcours d'index bornés autour de la cote (ghosts_pick), puis un tirage parmi 20 au plus :
    // la table entière n'est jamais lue ni triée.
    const { rows } = await q(
      `with c as (
         (select id from ghosts where lang = $1 and board_key = $2 and rating >= $4 and player_id <> $3 order by rating asc limit 10)
         union all
         (select id from ghosts where lang = $1 and board_key = $2 and rating < $4 and player_id <> $3 order by rating desc limit 10))
       select g.mode, g.ms, g.log, p.name, p.city, p.country, p.look, g.rating
       from ghosts g join players p on p.id = g.player_id
       where g.id = (select id from c order by random() limit 1)`,
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

  // ---------- Jeu à plusieurs ----------

  app.get('/v1/online', async (_req, res) => {
    const rooms = await matchMaker.query({});
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json({ online: rooms.reduce((n, r) => n + r.clients, 0) });
  });

  /** Salon ou enquête ouverts, retrouvés par leur code à 4 caractères. */
  app.get('/v1/rooms/:code', rateLimit('room', 120, 60_000), async (req, res) => {
    const code = String(req.params.code).toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) return res.status(400).json({ error: 'code invalide' });
    const r = await findRoom(code);
    if (!r) return res.status(404).json({ error: 'salon introuvable' });
    res.json(r);
  });

  /** Profil multijoueur : cote de duel et dernières parties. */
  app.get('/v1/me/multi', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    const { rows } = await q<{ duel_rating: number }>('select duel_rating from players where id = $1', [id]);
    const { rows: stats } = await q<{ kind: string; played: string; wins: string }>(
      `select m.kind, count(*) as played, count(*) filter (where mp.rank = 1) as wins
       from match_players mp join matches m on m.id = mp.match_id where mp.player_id = $1 group by m.kind`,
      [id],
    );
    res.json({ duelRating: rows[0]?.duel_rating ?? 1000, stats: Object.fromEntries(stats.map((s) => [s.kind, { played: Number(s.played), wins: Number(s.wins) }])) });
  });


  // ---------- Amis ----------

  /** Mon code, mes amis, les demandes reçues et envoyées. */
  app.get('/v1/friends', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    const code = await friendCode(id);
    const pub = "p.id, coalesce(nullif(p.name, ''), 'Anonyme') as name, coalesce(nullif(p.city, ''), p.country) as place, p.look";
    const [friends, incoming, outgoing] = await Promise.all([
      q(`select ${pub} from friendships f join players p on p.id = f.friend_id where f.player_id = $1 order by lower(p.name)`, [id]),
      q(`select ${pub} from friend_requests r join players p on p.id = r.from_id where r.to_id = $1 order by r.created_at desc limit 50`, [id]),
      q(`select ${pub} from friend_requests r join players p on p.id = r.to_id where r.from_id = $1 order by r.created_at desc limit 50`, [id]),
    ]);
    res.json({ code, friends: friends.rows, incoming: incoming.rows, outgoing: outgoing.rows });
  });

  /** Ajoute un ami par son code : la demande attend son accord, sauf s'il m'avait déjà demandé. */
  app.post('/v1/friends/add', requireAuth, rateLimit('friend', 30, 3_600_000), async (req, res) => {
    const id = (req as Authed).playerId;
    const code = String(req.body?.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!isFriendCode(code)) return res.status(400).json({ error: 'code invalide' });
    const { rows } = await q<{ id: string; name: string }>("select id, coalesce(nullif(name, ''), 'Anonyme') as name from players where friend_code = $1", [code]);
    const other = rows[0];
    if (!other) return res.status(404).json({ error: 'code inconnu' });
    if (other.id === id) return res.status(400).json({ error: 'c\'est ton propre code' });
    const out = await tx(async (c) => {
      const already = await c.query('select 1 from friendships where player_id = $1 and friend_id = $2', [id, other.id]);
      if (already.rowCount) return 'already';
      const { rows: n } = await c.query<{ n: string }>('select count(*) as n from friendships where player_id = $1', [id]);
      if (Number(n[0].n) >= MAX_FRIENDS) return 'full';
      const back = await c.query('delete from friend_requests where from_id = $1 and to_id = $2', [other.id, id]);
      if (back.rowCount) {
        await c.query('insert into friendships (player_id, friend_id) values ($1, $2), ($2, $1) on conflict do nothing', [id, other.id]);
        return 'accepted';
      }
      await c.query('insert into friend_requests (from_id, to_id) values ($1, $2) on conflict do nothing', [id, other.id]);
      return 'sent';
    });
    if (out === 'full') return res.status(409).json({ error: 'liste d\'amis pleine' });
    res.json({ status: out, name: other.name });
  });

  /** Accepte ou refuse une demande reçue, ou retire un ami (dans les deux sens). */
  app.post('/v1/friends/:id/:action', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    const other = req.params.id;
    const action = String(req.params.action);
    if (!isUuid(other) || !['accept', 'decline', 'remove'].includes(action)) return res.status(404).json({ error: 'action inconnue' });
    if (action === 'remove') {
      await q('delete from friendships where (player_id = $1 and friend_id = $2) or (player_id = $2 and friend_id = $1)', [id, other]);
      await q('delete from friend_requests where from_id = $1 and to_id = $2', [id, other]);
      return res.json({ ok: true });
    }
    const ok = await tx(async (c) => {
      const r = await c.query('delete from friend_requests where from_id = $1 and to_id = $2', [other, id]);
      if (!r.rowCount) return false;
      if (action === 'accept') {
        const { rows: n } = await c.query<{ n: string }>('select count(*) as n from friendships where player_id = $1', [id]);
        if (Number(n[0].n) >= MAX_FRIENDS) throw Object.assign(new Error('full'), { full: true });
        await c.query('insert into friendships (player_id, friend_id) values ($1, $2), ($2, $1) on conflict do nothing', [id, other]);
      }
      return true;
    }).catch((e) => (e.full ? 'full' : Promise.reject(e)));
    if (ok === 'full') return res.status(409).json({ error: 'liste d\'amis pleine' });
    if (!ok) return res.status(404).json({ error: 'demande introuvable' });
    res.json({ ok: true });
  });

  /** Classement entre amis : mes amis et moi sur un tableau. */
  app.get('/v1/friends/board/:lang/:key', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    const { lang, key } = req.params;
    if (!isLang(lang)) return res.status(400).json({ error: 'langue inconnue' });
    const { rows } = await q(
      `select p.id, p.name, coalesce(nullif(p.city, ''), p.country) as place, s.score, s.ms
       from scores s join players p on p.id = s.player_id
       where s.lang = $1 and s.board_key = $2 and (s.player_id = $3 or s.player_id in (select friend_id from friendships where player_id = $3))
       order by s.score desc, s.ms asc limit 101`,
      [lang, key, id],
    );
    res.json({ rows: rows.map((r) => ({ name: r.name || 'Anonyme', place: r.place, score: r.score, ms: r.ms, isYou: r.id === id })) });
  });

  // ---------- Défis entre amis ----------

  /** Crée un défi : le serveur tire la grille et lance le chrono du créateur. */
  app.post('/v1/challenges', requireAuth, rateLimit('challenge', 60, 3_600_000), async (req, res) => {
    const id = (req as Authed).playerId;
    const lang = req.body?.lang;
    const d = Number(req.body?.d);
    if (!isLang(lang) || !(d >= 1 && d <= 5)) return res.status(400).json({ error: 'défi invalide' });
    const nonce = arenaNonce();
    for (let i = 0; i < 5; i++) {
      const code = roomCode() + roomCode().slice(0, 2);
      const r = await q('insert into challenges (code, owner_id, lang, d, nonce) values ($1, $2, $3, $4, $5) on conflict do nothing returning code', [code, id, lang, d, nonce]);
      if (r.rowCount) return res.json({ code, lang, d, nonce });
    }
    res.status(503).json({ error: 'réessaie' });
  });

  /** Le créateur termine sa grille : elle devient le défi à battre. */
  app.post('/v1/challenges/:code/finish', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    const { rows } = await q<{ lang: Lang; d: Difficulty; nonce: string; status: string; wall: number }>(
      `select lang, d, nonce, status, extract(epoch from (now() - started_at)) * 1000 as wall from challenges where code = $1 and owner_id = $2`,
      [req.params.code, id],
    );
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'défi inconnu' });
    if (c.status !== 'open') return res.status(409).json({ error: 'défi déjà joué' });
    const log: Log = Array.isArray(req.body?.log) ? req.body.log.slice(0, 400) : [];
    const v = judgeChallenge(c.lang, c.d, c.nonce, log, Number(c.wall));
    if (!v.ok) {
      await q("update challenges set status = 'rejected' where code = $1", [req.params.code]);
      return res.status(422).json({ error: v.reason });
    }
    await q("update challenges set status = 'ready', score = $2, ms = $3, log = $4 where code = $1", [req.params.code, v.score, v.ms, JSON.stringify(log)]);
    res.json({ code: req.params.code, score: v.score, ms: v.ms });
  });

  /** Ce que voit l'ami qui ouvre le lien : la grille, le créateur et son fantôme, les autres tentatives. */
  app.get('/v1/challenges/:code', async (req, res) => {
    const { rows } = await q(
      `select c.code, c.lang, c.d, c.nonce, c.score, c.ms, c.log, p.id as owner_id, p.name, p.city, p.country, p.look
       from challenges c join players p on p.id = c.owner_id where c.code = $1 and c.status = 'ready'`,
      [req.params.code],
    );
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'défi introuvable' });
    const { rows: tries } = await q(
      `select p.name, a.score, a.ms from challenge_attempts a join players p on p.id = a.player_id
       where a.code = $1 and a.status = 'done' order by a.score desc, a.ms asc limit 20`,
      [req.params.code],
    );
    res.json({
      code: c.code, lang: c.lang, d: c.d, nonce: c.nonce, score: c.score, ms: c.ms, log: c.log,
      owner: { id: c.owner_id, name: c.name || 'Anonyme', place: c.city || c.country, look: c.look },
      attempts: tries,
    });
  });

  app.post('/v1/challenges/:code/start', requireAuth, rateLimit('attempt', 60, 3_600_000), async (req, res) => {
    const id = (req as Authed).playerId;
    const { rows } = await q<{ owner_id: string }>("select owner_id from challenges where code = $1 and status = 'ready'", [req.params.code]);
    if (!rows[0]) return res.status(404).json({ error: 'défi introuvable' });
    if (rows[0].owner_id === id) return res.status(409).json({ error: 'c\'est ton propre défi' });
    const { rows: a } = await q<{ id: string }>('insert into challenge_attempts (code, player_id) values ($1, $2) returning id', [req.params.code, id]);
    res.json({ attemptId: a[0].id });
  });

  app.post('/v1/challenges/attempts/:id/finish', requireAuth, async (req, res) => {
    const id = (req as Authed).playerId;
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'tentative inconnue' });
    const { rows } = await q<{ code: string; lang: Lang; d: Difficulty; nonce: string; status: string; wall: number; score: number; ms: number }>(
      `select a.code, c.lang, c.d, c.nonce, a.status, extract(epoch from (now() - a.started_at)) * 1000 as wall, c.score, c.ms
       from challenge_attempts a join challenges c on c.code = a.code where a.id = $1 and a.player_id = $2`,
      [req.params.id, id],
    );
    const a = rows[0];
    if (!a) return res.status(404).json({ error: 'tentative inconnue' });
    if (a.status !== 'open') return res.status(409).json({ error: 'tentative déjà terminée' });
    const log: Log = Array.isArray(req.body?.log) ? req.body.log.slice(0, 400) : [];
    const v = judgeChallenge(a.lang, a.d, a.nonce, log, Number(a.wall));
    if (!v.ok) {
      await q("update challenge_attempts set status = 'rejected' where id = $1", [req.params.id]);
      return res.status(422).json({ error: v.reason });
    }
    await q("update challenge_attempts set status = 'done', score = $2, ms = $3 where id = $1", [req.params.id, v.score, v.ms]);
    const won = v.score > a.score || (v.score === a.score && v.ms < a.ms);
    res.json({ score: v.score, ms: v.ms, ownerScore: a.score, ownerMs: a.ms, won });
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

/**
 * Ménage quotidien : parties jamais terminées, fantômes du défi du jour (jamais proposés en course),
 * fantômes au-delà du plafond par tranche de cote (ceux d'avant le plafond, ou d'un envoi concurrent).
 */
export async function purge(): Promise<{ games: number; ghosts: number }> {
  return tx(async (c) => {
    // La première passe sur une grosse table peut dépasser la limite des requêtes ordinaires.
    await c.query("set local statement_timeout = '5min'");
    const games = await c.query("delete from games where status = 'open' and started_at < now() - interval '2 days'");
    const daily = await c.query("delete from ghosts where board_key like 'daily:%' and created_at < now() - interval '7 days'");
    const extra = await c.query(
      `delete from ghosts g using (
         select id, row_number() over (partition by lang, board_key, rating / 100 order by created_at desc) as n from ghosts) x
       where g.id = x.id and x.n > $1`,
      [GHOSTS_PER_BUCKET],
    );
    return { games: games.rowCount ?? 0, ghosts: (daily.rowCount ?? 0) + (extra.rowCount ?? 0) };
  });
}
