// Test de bout en bout de l'API contre une vraie base PostgreSQL (DATABASE_URL) et un serveur lancé (API_URL).
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
const ev = await call('GET', '/v1/events');
ok('événements à distance', ev.status === 200 && Array.isArray(ev.json));

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
