// Test de bout en bout de l'API contre une vraie base PostgreSQL (DATABASE_URL) et un serveur lancé (API_URL).
import pg from 'pg';
import { PACKS } from '../../src/content/index';
import { puzzleFor, type Mode } from '../../src/modes';
import { initGame, select, typeLetter, selFor, computeScore, type GameState } from '../../src/engine/game';

const API = process.env.API_URL ?? 'http://localhost:2567';
let pass = 0, fail = 0;
const ok = (name: string, c: unknown) => { if (c) pass++; else fail++; console.log(`${c ? 'OK  ' : 'FAIL'} ${name}`); };
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Joue une grille parfaitement, une lettre toutes les `gap` ms ; `wrong` glisse une erreur. */
function play(mode: Mode, gap = 90, wrong = false): GameState {
  const pz = puzzleFor(PACKS.fr, mode);
  let g = initGame(pz, 0);
  let t = 0;
  const codes = [...new Set(pz.phrase.filter((c) => c.kind === 'letter').map((c) => (c as { code: number }).code))].filter((c) => !g.locked[c]);
  for (const c of codes) {
    t += gap;
    g = select(g, selFor(pz, c)!);
    if (wrong) { g = typeLetter(g, pz.codeToLetter[c] === 'Z' ? 'Y' : 'Z', t); t += gap; }
    g = typeLetter(g, pz.codeToLetter[c], t);
  }
  return g;
}

const day = new Date().toISOString().slice(0, 10);

const h = await call('GET', '/health');
ok('santé du serveur', h.status === 200 && h.json.ok);

const a = await call('POST', '/v1/auth/anon', { name: 'Ada', city: 'Lomé', country: 'Togo' });
ok('compte anonyme', a.status === 200 && a.json.token);
const tok = a.json.token as string;
const b = await call('POST', '/v1/auth/anon', { name: 'Loupi', city: 'Rabat', country: 'Maroc' });
const tok2 = b.json.token as string;

ok('jeton falsifié refusé', (await call('PATCH', '/v1/me', { name: 'X' }, tok.slice(0, -2) + 'xx')).status === 401);
const me = await call('PATCH', '/v1/me', { name: 'Ada<script>', city: 'Lomé', country: 'Togo' }, tok);
ok('profil nettoyé', me.status === 200 && !me.json.name.includes('<'));

// Défi du jour joué proprement
const s1 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: day } }, tok);
ok('ouverture du défi du jour', s1.status === 200 && s1.json.gameId);
const g1 = play(s1.json.mode);
await sleep(g1.elapsedMs + 200);
const f1 = await call('POST', `/v1/games/${s1.json.gameId}/finish`, { logs: [g1.log] }, tok);
ok('partie validée et score recalculé par le serveur', f1.status === 200 && f1.json.score === computeScore(g1));
ok('rang renvoyé', f1.json?.rank === 1);
ok('partie non rejouable', (await call('POST', `/v1/games/${s1.json.gameId}/finish`, { logs: [g1.log] }, tok)).status === 409);

// Tricheries
const s2 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: day } }, tok2);
const g2 = play(s2.json.mode, 400);
const f2 = await call('POST', `/v1/games/${s2.json.gameId}/finish`, { logs: [g2.log] }, tok2);
ok('temps plus court que le temps réel : refusé', f2.status === 422);

const s3 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: day } }, tok2);
const g3 = play(s3.json.mode, 10);
await sleep(g3.elapsedMs + 200);
ok('frappes inhumaines : refusé', (await call('POST', `/v1/games/${s3.json.gameId}/finish`, { logs: [g3.log] }, tok2)).status === 422);

const s4 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: day } }, tok2);
const half = play(s4.json.mode);
await sleep(300);
ok('grille incomplète : refusée', (await call('POST', `/v1/games/${s4.json.gameId}/finish`, { logs: [half.log.slice(0, 3)] }, tok2)).status === 422);

const s5 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: day } }, tok2);
const g5 = play(s5.json.mode);
await sleep(g5.elapsedMs + 200);
const withHint = [...g5.log.slice(0, 2), [g5.log[2][0], g5.log[2][1], '?'] as [number, number, string], ...g5.log.slice(3)];
ok('partie avec aide : hors classement', (await call('POST', `/v1/games/${s5.json.gameId}/finish`, { logs: [withHint] }, tok2)).status === 422);

ok('mode non classé refusé', (await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'zen', d: 2 } }, tok)).status === 400);
ok('défi d\'une autre date refusé', (await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: '2020-01-01' } }, tok)).status === 400);

// Joueur 2 joue honnêtement, avec des erreurs : il doit être classé derrière
const s6 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'daily', d: 2, date: day } }, tok2);
const g6 = play(s6.json.mode, 90, true);
await sleep(g6.elapsedMs + 200);
const f6 = await call('POST', `/v1/games/${s6.json.gameId}/finish`, { logs: [g6.log] }, tok2);
ok('partie avec erreurs validée, score plus bas', f6.status === 200 && f6.json.score < f1.json.score && f6.json.rank === 2);

// Arène : la graine vient du serveur
const s7 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'timeattack', d: 3, nonce: 'facile' } }, tok);
ok('graine d\'arène imposée par le serveur', s7.status === 200 && s7.json.mode.nonce && s7.json.mode.nonce !== 'facile');
const g7 = play(s7.json.mode);
await sleep(g7.elapsedMs + 200);
const f7 = await call('POST', `/v1/games/${s7.json.gameId}/finish`, { logs: [g7.log] }, tok);
ok('contre-la-montre validé avec bonus de temps', f7.status === 200 && f7.json.score > computeScore(g7));

// Classements et fantômes
const board = await call('GET', `/v1/boards/fr/daily:${day}?scope=world&me=${a.json.id}`);
ok('classement mondial', board.status === 200 && board.json.rows.length === 2 && board.json.rows[0].isYou && board.json.rank === 1);
const city = await call('GET', `/v1/boards/fr/daily:${day}?scope=city&place=Rabat`);
ok('classement par ville', city.status === 200 && city.json.rows.length === 1 && city.json.rows[0].name === 'Loupi');
const ghost = await call('GET', `/v1/ghosts/fr/daily:${day}?rating=1000`, undefined, tok2);
ok('fantôme d\'un autre joueur', ghost.status === 200 && ghost.json.name.startsWith('Ada') && Array.isArray(ghost.json.log[0]));

// Fin de partie atomique : deux envois simultanés du même journal ne comptent qu'une fois.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const c = await call('POST', '/v1/auth/anon', { name: 'Cléo', city: 'Dakar', country: 'Sénégal' });
const tok3 = c.json.token as string;
const c3id = c.json.id as string;
const s8 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'timeattack', d: 1 } }, tok3);
const g8 = play(s8.json.mode);
await sleep(g8.elapsedMs + 200);
// Connexions ouvertes à l'avance : sans cela, les envois suivants arrivent après la fin du premier.
const N = 6;
await Promise.all(Array.from({ length: N }, () => call('GET', '/health')));
const twice = await Promise.all(Array.from({ length: N }, () => call('POST', `/v1/games/${s8.json.gameId}/finish`, { logs: [g8.log] }, tok3)));
const codes = twice.map((r) => r.status);
const ghosts8 = await db.query('select count(*)::int as n from ghosts where game_id = $1', [s8.json.gameId]);
const scores8 = await db.query('select count(*)::int as n from scores where game_id = $1', [s8.json.gameId]);
ok('envois simultanés : un seul accepté, les autres en conflit', codes.filter((x) => x === 200).length === 1 && codes.filter((x) => x === 409).length === N - 1);
ok('envois simultanés : un seul fantôme et un seul score', ghosts8.rows[0].n === 1 && scores8.rows[0].n === 1);

// Plafond des fantômes par tableau et tranche de cote : les plus anciens disparaissent.
await db.query(
  `insert into ghosts (player_id, lang, board_key, mode, rating, ms, log, created_at)
   select $1::uuid, 'fr', 'timeattack:1', $2::jsonb, 1000 + (i % 100), 1000, '[]', now() - i * interval '1 hour' from generate_series(1, 60) i`,
  [a.json.id, s8.json.mode],
);
const s9 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'timeattack', d: 1 } }, tok3);
const g9 = play(s9.json.mode);
await sleep(g9.elapsedMs + 200);
const f9 = await call('POST', `/v1/games/${s9.json.gameId}/finish`, { logs: [g9.log] }, tok3);
await sleep(300);
const kept = await db.query("select count(*)::int as n, count(*) filter (where game_id = $1)::int as mine from ghosts where lang = 'fr' and board_key = 'timeattack:1' and rating >= 1000 and rating < 1100", [s9.json.gameId]);
ok('plafond des fantômes : 50 gardés, le plus récent compris', f9.status === 200 && kept.rows[0].n === 50 && kept.rows[0].mine === 1);
const near = await call('GET', '/v1/ghosts/fr/timeattack:1?rating=pas-un-nombre', undefined, tok3);
ok('tirage d\'un fantôme proche, jamais le sien', near.status === 200 && !near.json.name.startsWith('Cl'));

// Entrées mal formées : refusées proprement, sans erreur 500.
ok('identifiant de partie mal formé : 404', (await call('POST', '/v1/games/pas-un-uuid/finish', { logs: [] }, tok3)).status === 404);
ok('paramètre me mal formé ignoré', (await call('GET', `/v1/boards/fr/daily:${day}?me=nimporte`)).status === 200);
const s10 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'timeattack', d: 1 } }, tok3);
const huge = Array.from({ length: 7000 }, (_, i) => [i * 100, 1, 'A']);
ok('journal démesuré : refusé avant rejeu', (await call('POST', `/v1/games/${s10.json.gameId}/finish`, { logs: [huge] }, tok3)).status === 422);
const s11 = await call('POST', '/v1/games', { lang: 'fr', mode: { kind: 'timeattack', d: 1 } }, tok3);
ok('coups mal formés : refusés', (await call('POST', `/v1/games/${s11.json.gameId}/finish`, { logs: [[1, 2, 3]] }, tok3)).status === 422);
// Amis : code, demande, acceptation, demande croisée, classement entre amis, retrait.
const fa = await call('GET', '/v1/friends', undefined, tok);
const fb = await call('GET', '/v1/friends', undefined, tok2);
ok('code ami attribué et stable', fa.status === 200 && /^[A-Z2-9]{6}$/.test(fa.json.code) && (await call('GET', '/v1/friends', undefined, tok)).json.code === fa.json.code);
ok('son propre code refusé', (await call('POST', '/v1/friends/add', { code: fa.json.code }, tok)).status === 400);
ok('code inconnu : 404', (await call('POST', '/v1/friends/add', { code: 'ZZZZZZ' }, tok)).status === 404);
const sent = await call('POST', '/v1/friends/add', { code: fb.json.code.toLowerCase() }, tok);
ok('demande envoyée', sent.status === 200 && sent.json.status === 'sent' && sent.json.name === 'Loupi');
const inbox = await call('GET', '/v1/friends', undefined, tok2);
ok('demande reçue visible', inbox.json.incoming.length === 1 && inbox.json.incoming[0].name.startsWith('Ada') && inbox.json.friends.length === 0);
ok('demande en attente côté expéditeur', (await call('GET', '/v1/friends', undefined, tok)).json.outgoing.length === 1);
ok('accepter : 200', (await call('POST', `/v1/friends/${a.json.id}/accept`, {}, tok2)).status === 200);
ok('accepter deux fois : 404', (await call('POST', `/v1/friends/${a.json.id}/accept`, {}, tok2)).status === 404);
const both = [await call('GET', '/v1/friends', undefined, tok), await call('GET', '/v1/friends', undefined, tok2)];
ok('amitié dans les deux sens', both.every((x) => x.json.friends.length === 1 && x.json.incoming.length === 0 && x.json.outgoing.length === 0));
ok('déjà amis', (await call('POST', '/v1/friends/add', { code: fb.json.code }, tok)).json.status === 'already');
const fboard = await call('GET', `/v1/friends/board/fr/daily:${day}`, undefined, tok);
ok('classement entre amis : moi et mes amis seulement', fboard.status === 200 && fboard.json.rows.some((r: { isYou: boolean }) => r.isYou) && fboard.json.rows.every((r: { name: string }) => ['Ada', 'Loupi'].some((n) => r.name.startsWith(n))));
ok('retirer un ami', (await call('POST', `/v1/friends/${b.json.id}/remove`, {}, tok)).status === 200 && (await call('GET', '/v1/friends', undefined, tok2)).json.friends.length === 0);
const fc = await call('GET', '/v1/friends', undefined, tok3);
await call('POST', '/v1/friends/add', { code: fc.json.code }, tok);
const cross = await call('POST', '/v1/friends/add', { code: fa.json.code }, tok3);
ok('demande croisée : acceptée d\'office', cross.json.status === 'accepted' && (await call('GET', '/v1/friends', undefined, tok3)).json.friends.length === 1);
await call('POST', '/v1/friends/add', { code: fb.json.code }, tok3);
ok('refuser une demande', (await call('POST', `/v1/friends/${c3id}/decline`, {}, tok2)).status === 200 && (await call('GET', '/v1/friends', undefined, tok2)).json.incoming.length === 0);
ok('action inconnue : 404', (await call('POST', `/v1/friends/${b.json.id}/hack`, {}, tok)).status === 404);
await db.end();
const ev = await call('GET', '/v1/events');
ok('événements à distance', ev.status === 200 && Array.isArray(ev.json));

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
