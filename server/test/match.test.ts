// Tests de l'arbitre multijoueur, sans réseau : horloge et graines contrôlées.
import assert from 'node:assert/strict';
import { Match, lettersToFind, eloDelta } from '../../src/multi/match';
import { MULTI_RULES } from '../../src/multi/protocol';

let clock = 1_000_000;
const now = () => clock;
let pass = 0;
let fail = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`OK   ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}
const prof = (id: string, rating = 1000) => ({ id, name: id.toUpperCase(), place: 'Lomé', rating, look: {} });

/** Joue toutes les bonnes lettres pour un joueur, à 100 ms d'intervalle. */
function solve(m: Match, id: string, upto = Infinity) {
  const p = m.puzzle!;
  let n = 0;
  for (const c of lettersToFind(p)) {
    if (n++ >= upto) break;
    clock += 100;
    m.move(id, c, p.codeToLetter[c]);
  }
}
function begin(m: Match, by: string | null) {
  assert.ok(m.start(by), 'départ refusé');
  clock = m.startAt! + 10;
  m.tick();
  assert.equal(m.phase, 'play');
}

test('duel : le premier qui finit gagne', () => {
  const m = new Match('duel', 'D1', { lang: 'fr', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  begin(m, null);
  solve(m, 'b');
  assert.equal(m.phase, 'play');
  const ev = (() => { solve(m, 'a'); return m.phase; })();
  assert.equal(ev, 'done');
  const r = m.ranking();
  assert.equal(r[0].id, 'b');
  assert.equal(r[1].id, 'a');
  assert.ok(r[0].ms! > 0);
});

test('frappes refusées avant le départ et trop rapprochées', () => {
  const m = new Match('duel', 'D2', { lang: 'fr', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  m.start(null);
  const p = m.puzzle!;
  const c = lettersToFind(p)[0];
  assert.equal(m.move('a', c, p.codeToLetter[c]).length, 0, 'avant le départ');
  clock = m.startAt! + 10;
  m.tick();
  assert.equal(m.move('a', c, p.codeToLetter[c]).length, 1);
  const c2 = lettersToFind(p)[1];
  clock += 10;
  assert.equal(m.move('a', c2, p.codeToLetter[c2]).length, 0, 'trop rapide');
});

test('une erreur coûte 3 s au temps final', () => {
  const m = new Match('duel', 'D3', { lang: 'fr', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  begin(m, null);
  const p = m.puzzle!;
  const c = lettersToFind(p)[0];
  clock += 100;
  m.move('a', c, p.codeToLetter[c] === 'Z' ? 'Y' : 'Z');
  solve(m, 'a');
  const a = m.state().players.find((x) => x.id === 'a')!;
  assert.equal(a.mistakes, 1);
  assert.equal(a.doneMs, clock - m.startAt! + MULTI_RULES.mistakePenaltyMs);
});

test('abandon en duel : l\'autre gagne', () => {
  const m = new Match('duel', 'D4', { lang: 'fr', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  begin(m, null);
  solve(m, 'a', 3);
  const ev = m.leave('b');
  assert.equal(m.phase, 'done');
  assert.equal(ev[0].t, 'result');
  assert.equal(m.ranking()[0].id, 'a');
});

test('salon : seul l\'hôte lance, il faut que les autres soient prêts', () => {
  const m = new Match('party', 'P1', { lang: 'en', d: 1, traps: true }, now);
  m.join(prof('h'));
  m.join(prof('x'));
  m.join(prof('y'));
  assert.equal(m.start('x'), false);
  assert.equal(m.start('h'), false, 'pas prêts');
  m.setReady('x', true);
  m.setReady('y', true);
  m.setOptions('x', { d: 5 });
  assert.equal(m.options.d, 1, 'seul l\'hôte règle');
  m.setOptions('h', { d: 3 });
  assert.equal(m.options.d, 3);
  begin(m, 'h');
  assert.equal(m.seats.length, 3);
});

test('salon plein et partie en cours fermés', () => {
  const m = new Match('party', 'P2', { lang: 'fr', d: 1, traps: false }, now);
  for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(m.join(prof(id)).ok, true);
  assert.equal(m.join(prof('f')).ok, false);
  for (const id of ['b', 'c', 'd', 'e']) m.setReady(id, true);
  begin(m, 'a');
  m.leave('e');
  assert.equal(m.join(prof('g')).ok, false);
});

test('pièges : gagnés en trouvant des mots, protection après coup', () => {
  const m = new Match('party', 'P3', { lang: 'fr', d: 1, traps: true }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  m.join(prof('c'));
  m.setReady('b', true);
  m.setReady('c', true);
  begin(m, 'a');
  assert.equal(m.trap('a', 'b', 'ink').length, 0, 'aucune charge');
  // Résoudre deux mots entiers pour gagner une charge.
  const p = m.puzzle!;
  for (const w of p.words.slice(0, 2)) for (const c of w.codes) { clock += 100; m.move('a', c, p.codeToLetter[c]); }
  const a = m.state().players.find((x) => x.id === 'a')!;
  assert.ok(a.traps >= 1, `charges ${a.traps}`);
  const ev = m.trap('a', 'b', 'ink');
  assert.equal(ev[0]?.t, 'trapped');
  assert.equal(m.trap('a', 'b', 'freeze').length, 0, 'b est protégé');
});

test('coop : grille partagée, indices répartis, cœurs communs', () => {
  const m = new Match('coop', 'C1', { lang: 'es', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  m.setReady('b', true);
  begin(m, 'a');
  const s = m.state();
  assert.equal(s.clueOwner!.length, m.puzzle!.words.length);
  assert.ok(s.clueOwner!.includes('a') && s.clueOwner!.includes('b'));
  const p = m.puzzle!;
  const codes = lettersToFind(p);
  const wrong = (c: number) => (p.codeToLetter[c] === 'Z' ? 'Y' : 'Z');
  clock += 100;
  m.move('b', codes[0], wrong(codes[0]));
  assert.equal(m.state().teamLives, MULTI_RULES.coopLives - 1);
  codes.forEach((c, i) => { clock += 100; m.move(i % 2 ? 'b' : 'a', c, p.codeToLetter[c]); });
  assert.equal(m.phase, 'done');
  const st = m.state();
  assert.ok(st.players.every((x) => x.doneMs !== null));
  assert.equal(st.players.reduce((n, x) => n + x.letters, 0), codes.length);
});

test('coop : plus de cœurs, enquête perdue', () => {
  const m = new Match('coop', 'C2', { lang: 'fr', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  m.setReady('b', true);
  begin(m, 'a');
  const p = m.puzzle!;
  const codes = lettersToFind(p);
  let k = 0;
  for (const c of codes) for (const l of 'ZYXWVUTS') {
    if (m.phase === 'done' || l === p.codeToLetter[c]) continue;
    clock += 100;
    m.move('a', c, l);
    k++;
  }
  assert.equal(m.phase, 'done');
  assert.equal(m.state().teamLives, 0);
});

test('fin au temps imparti, classement par lettres', () => {
  const m = new Match('party', 'P4', { lang: 'fr', d: 1, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  m.setReady('b', true);
  begin(m, 'a');
  solve(m, 'b', 4);
  solve(m, 'a', 2);
  clock = m.endAt! + 1;
  const ev = m.tick();
  assert.equal(ev[0].t, 'result');
  assert.equal(m.ranking()[0].id, 'b');
});

test('revanche quand tout le monde la demande', () => {
  const m = new Match('duel', 'D5', { lang: 'fr', d: 2, traps: false }, now);
  m.join(prof('a'));
  m.join(prof('b'));
  begin(m, null);
  const seed = m.seed;
  solve(m, 'a');
  solve(m, 'b');
  assert.equal(m.rematch('a'), false);
  assert.equal(m.rematch('b'), true);
  assert.equal(m.phase, 'countdown');
  assert.notEqual(m.seed, seed);
});

test('cote Elo', () => {
  assert.equal(eloDelta(1000, 1000), 12);
  assert.ok(eloDelta(1400, 1000) < 12);
  assert.ok(eloDelta(1000, 1400) > 12);
});

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
