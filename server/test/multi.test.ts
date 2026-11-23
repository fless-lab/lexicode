// Tests de bout en bout du jeu à plusieurs : de vrais clients Colyseus contre le serveur lancé.
// API_URL=http://localhost:2567 DATABASE_URL=... npx tsx test/multi.test.ts
import assert from 'node:assert/strict';
import pg from 'pg';
import { Client, type Room } from '@colyseus/sdk';
import { multiPuzzle, lettersToFind, challengePuzzle } from '../../src/multi/match';
import type { RoomState, ServerMsg } from '../../src/multi/protocol';
import type { Lang } from '../../src/engine/types';

const API = process.env.API_URL ?? 'http://localhost:2567';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass++;
    console.log(`OK   ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}

async function http<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(API + path, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

async function player(name: string, city = 'Lomé') {
  const { body } = await http<{ id: string; token: string }>('/v1/auth/anon', { method: 'POST', body: { name, city, country: 'Togo' } });
  return { ...body, name };
}

/** Garde le dernier état et la file des messages reçus par un client. */
function watch(room: Room) {
  const box = { state: null as RoomState | null, msgs: [] as ServerMsg[] };
  room.onMessage('m', (m: ServerMsg) => {
    box.msgs.push(m);
    if (m.t === 'state') box.state = m.s;
  });
  return box;
}
async function until(cond: () => boolean, ms = 8000, what = 'condition') {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`délai dépassé : ${what}`);
    await sleep(40);
  }
}

/** Tape toutes les bonnes lettres (ou les n premières) à un rythme humain. */
async function play(room: Room, s: RoomState, n = Infinity, gap = 80) {
  const p = multiPuzzle(s.options.lang as Lang, s.options.d, s.seed!);
  let k = 0;
  for (const c of lettersToFind(p)) {
    if (k++ >= n) break;
    room.send('m', { t: 'move', code: c, letter: p.codeToLetter[c] });
    await sleep(gap);
  }
}

const client = new Client(API);

await test('duel classé : file d\'attente, partie, cote mise à jour', async () => {
  const a = await player('Ama');
  const b = await player('Bilal');
  const qa = await client.joinOrCreate('queue', { lang: 'fr', token: a.token, look: { hat: 'beret' } });
  const qb = await client.joinOrCreate('queue', { lang: 'fr', token: b.token, look: { hat: 'tophat', neck: '<script>' } });
  const got: Record<string, unknown> = {};
  qa.onMessage('m', (m: { t: string; reservation?: unknown }) => { if (m.t === 'match') got.a = m.reservation; });
  qb.onMessage('m', (m: { t: string; reservation?: unknown }) => { if (m.t === 'match') got.b = m.reservation; });
  await until(() => !!got.a && !!got.b, 6000, 'appariement');
  const ra = await client.consumeSeatReservation(got.a as never);
  const rb = await client.consumeSeatReservation(got.b as never);
  await qa.leave();
  await qb.leave();
  const wa = watch(ra);
  const wb = watch(rb);
  ra.send('m', { t: 'sync' });
  rb.send('m', { t: 'sync' });
  await until(() => wa.state?.players.length === 2 && !!wa.state.seed && !!wb.state, 5000, 'départ');
  assert.ok(['countdown', 'play'].includes(wa.state!.phase));
  const look = wa.state!.players.find((p) => p.id === b.id)!.look;
  assert.equal(look.hat, 'tophat');
  assert.equal(look.neck, undefined, 'tenue nettoyée');
  await until(() => Date.now() >= wa.state!.startAt!, 5000, 'fin du compte à rebours');
  await sleep(100);
  await Promise.all([play(ra, wa.state!, Infinity, 70), (async () => { await sleep(300); await play(rb, wb.state!, Infinity, 120); })()]);
  await until(() => wa.msgs.some((m) => m.t === 'result'), 8000, 'résultat');
  const res = wa.msgs.find((m) => m.t === 'result') as Extract<ServerMsg, { t: 'result' }>;
  assert.equal(res.ranking[0].id, a.id);
  assert.ok(res.ratingDelta![a.id] > 0 && res.ratingDelta![b.id] < 0);
  await sleep(300);
  const { rows } = await db.query('select id, duel_rating from players where id = any($1)', [[a.id, b.id]]);
  const r = Object.fromEntries(rows.map((x) => [x.id, x.duel_rating]));
  assert.ok(r[a.id] > 1000 && r[b.id] < 1000, JSON.stringify(r));
  await ra.leave();
  await rb.leave();
});

await test('salon à 3 : code, prêt, lancement, pièges, podium', async () => {
  const [h, x, y] = await Promise.all([player('Hôte'), player('Xavi'), player('Yaa')]);
  const rh = await client.create('party', { lang: 'en', token: h.token });
  const wh = watch(rh);
  await until(() => !!wh.state, 3000, 'état du salon');
  const code = wh.state!.code;
  assert.match(code, /^[A-Z0-9]{4}$/);
  const found = await http<{ roomId: string; kind: string }>(`/v1/rooms/${code}`);
  assert.equal(found.status, 200);
  assert.equal(found.body.kind, 'party');
  assert.equal((await http(`/v1/rooms/ZZZZ`)).status, 404);
  const rx = await client.joinById(found.body.roomId, { token: x.token });
  const ry = await client.joinById(found.body.roomId, { token: y.token });
  const wx = watch(rx);
  watch(ry);
  await until(() => wh.state?.players.length === 3, 3000, 'trois joueurs');
  rh.send('m', { t: 'options', options: { d: 1, traps: true } });
  rh.send('m', { t: 'start' });
  await sleep(200);
  assert.equal(wh.state!.phase, 'lobby', 'refusé tant que tous ne sont pas prêts');
  rx.send('m', { t: 'ready', ready: true });
  ry.send('m', { t: 'ready', ready: true });
  await sleep(150);
  rx.send('m', { t: 'start' });
  await sleep(150);
  assert.equal(wh.state!.phase, 'lobby', 'seul l\'hôte lance');
  rh.send('m', { t: 'start' });
  await until(() => wh.state?.phase === 'countdown', 3000, 'compte à rebours');
  assert.equal(wh.state!.options.d, 1);
  // Un salon lancé n'accepte plus personne.
  const late = await player('Tard');
  await assert.rejects(client.joinById(found.body.roomId, { token: late.token }));
  await until(() => Date.now() >= wh.state!.startAt! + 50, 5000);
  // L'hôte trouve deux mots entiers pour gagner un piège, puis le lance sur Xavi.
  const p = multiPuzzle('en', 1, wh.state!.seed!);
  for (const w of p.words.slice(0, 2)) for (const c of w.codes) { rh.send('m', { t: 'move', code: c, letter: p.codeToLetter[c] }); await sleep(70); }
  await until(() => (wh.state!.players.find((q) => q.id === h.id)!.traps ?? 0) >= 1, 3000, 'piège gagné');
  rh.send('m', { t: 'trap', target: x.id, kind: 'ink' });
  await until(() => wx.msgs.some((m) => m.t === 'trapped'), 3000, 'piège reçu');
  await Promise.all([play(rh, wh.state!, Infinity, 70), play(ry, wh.state!, Infinity, 90), play(rx, wh.state!, 5, 90)]);
  rx.leave();
  await until(() => wh.msgs.some((m) => m.t === 'result'), 8000, 'résultat');
  const res = wh.msgs.find((m) => m.t === 'result') as Extract<ServerMsg, { t: 'result' }>;
  assert.equal(res.ranking.length, 3);
  assert.equal(res.ranking[2].id, x.id, 'celui qui part est dernier');
  assert.equal(res.ratingDelta, undefined, 'pas de cote hors duel');
  await rh.leave();
  await ry.leave();
});

await test('enquête à 2 : indices répartis, lettres partagées', async () => {
  const [a, b] = await Promise.all([player('Awa'), player('Badu')]);
  const ra = await client.create('coop', { lang: 'es', d: 2, token: a.token });
  const wa = watch(ra);
  await until(() => !!wa.state, 3000);
  const { body } = await http<{ roomId: string }>(`/v1/rooms/${wa.state!.code}`);
  const rb = await client.joinById(body.roomId, { token: b.token });
  const wb = watch(rb);
  await until(() => wa.state?.players.length === 2, 3000);
  rb.send('m', { t: 'ready', ready: true });
  await sleep(100);
  ra.send('m', { t: 'start' });
  await until(() => wa.state?.phase === 'countdown', 3000);
  const owners = wa.state!.clueOwner!;
  assert.ok(owners.includes(a.id) && owners.includes(b.id), 'chacun ses indices');
  await until(() => Date.now() >= wa.state!.startAt! + 50, 5000);
  const p = multiPuzzle('es', 2, wa.state!.seed!);
  const codes = lettersToFind(p);
  ra.send('m', { t: 'move', code: codes[0], letter: p.codeToLetter[codes[0]] });
  await sleep(400);
  if (!wb.msgs.some((m) => m.t === 'move')) console.log('     debug', JSON.stringify(wa.state!.players.map((q) => [q.letters, q.mistakes])), wa.state!.phase, Date.now() - wa.state!.startAt!);
  await until(() => wb.msgs.some((m) => m.t === 'move' && m.by === a.id && m.ok), 3000, 'lettre transmise au coéquipier');
  assert.ok(!wa.msgs.some((m) => m.t === 'move'), 'on ne reçoit pas ses propres lettres');
  for (const [i, c] of codes.slice(1).entries()) {
    (i % 2 ? ra : rb).send('m', { t: 'move', code: c, letter: p.codeToLetter[c] });
    await sleep(70);
  }
  await until(() => wa.msgs.some((m) => m.t === 'result'), 5000, 'enquête résolue');
  assert.ok(wa.state!.players.every((q) => q.doneMs !== null));
  await ra.leave();
  await rb.leave();
});

await test('défi entre amis : créé, joué, relevé', async () => {
  const [o, f] = await Promise.all([player('Olu'), player('Fifi')]);
  const c = await http<{ code: string; lang: Lang; d: 1; nonce: string }>('/v1/challenges', { method: 'POST', token: o.token, body: { lang: 'fr', d: 2 } });
  assert.equal(c.status, 200);
  const p = challengePuzzle('fr', 2, c.body.nonce);
  const log = (gap: number): [number, number, string][] => lettersToFind(p).map((code, i) => [300 + i * gap, code, p.codeToLetter[code]]);
  assert.equal((await http(`/v1/challenges/${c.body.code}`)).status, 404, 'pas visible avant d\'être joué');
  await sleep(1500);
  const done = await http<{ score: number }>(`/v1/challenges/${c.body.code}/finish`, { method: 'POST', token: o.token, body: { log: log(90) } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const seen = await http<{ owner: { name: string }; log: unknown[]; nonce: string }>(`/v1/challenges/${c.body.code}`);
  assert.equal(seen.body.owner.name, 'Olu');
  assert.ok(seen.body.log.length > 0, 'fantôme fourni');
  assert.equal((await http(`/v1/challenges/${c.body.code}/start`, { method: 'POST', token: o.token })).status, 409, 'pas contre soi-même');
  const st = await http<{ attemptId: string }>(`/v1/challenges/${c.body.code}/start`, { method: 'POST', token: f.token });
  await sleep(1500);
  const cheat = await http(`/v1/challenges/attempts/${st.body.attemptId}/finish`, { method: 'POST', token: f.token, body: { log: log(10) } });
  assert.equal(cheat.status, 422, 'frappes trop rapides refusées');
  const st2 = await http<{ attemptId: string }>(`/v1/challenges/${c.body.code}/start`, { method: 'POST', token: f.token });
  await sleep(1400);
  const r = await http<{ won: boolean; score: number; ownerScore: number }>(`/v1/challenges/attempts/${st2.body.attemptId}/finish`, { method: 'POST', token: f.token, body: { log: log(70) } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(typeof r.body.won, 'boolean');
  const after = await http<{ attempts: { name: string }[] }>(`/v1/challenges/${c.body.code}`);
  assert.equal(after.body.attempts[0].name, 'Fifi');
});

await test('salle refusée sans jeton', async () => {
  await assert.rejects(client.create('party', { lang: 'fr' }));
  await assert.rejects(client.join('queue', { lang: 'fr', token: 'faux.jeton' }));
});

console.log(`\n${pass} réussis, ${fail} échoués`);
await db.end();
process.exit(fail ? 1 : 0);
