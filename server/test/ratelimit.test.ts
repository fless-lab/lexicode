// Limite de débit : comptée par joueur (ou par adresse sans compte), jamais par chemin.
import type { Request, Response } from 'express';
import { rateLimit } from '../src/auth';

let pass = 0, fail = 0;
const ok = (name: string, c: unknown) => { if (c) pass++; else fail++; console.log(`${c ? 'OK  ' : 'FAIL'} ${name}`); };

// Le serveur de test désactive la limite (NODE_ENV=test) ; ici on la veut active.
delete process.env.NODE_ENV;

/** Passe une requête dans le middleware et renvoie le code obtenu (200 si elle continue). */
function hit(mw: ReturnType<typeof rateLimit>, req: { path: string; ip: string; playerId?: string }): number {
  let status = 200;
  const res = { status(c: number) { status = c; return this; }, json() { return this; } } as unknown as Response;
  mw(req as unknown as Request, res, () => {});
  return status;
}

const finish = rateLimit('finish', 3, 60_000);
// Un identifiant de partie différent à chaque envoi : avec l'ancienne clé (adresse + chemin), rien n'était limité.
const codes = [1, 2, 3, 4].map((i) => hit(finish, { path: `/v1/games/game-${i}/finish`, ip: '1.2.3.4', playerId: 'ada' }));
ok('fin de partie : limitée par joueur, quel que soit l\'identifiant de partie', codes.join() === '200,200,200,429');
ok('un autre joueur derrière la même adresse garde son quota', hit(finish, { path: '/v1/games/game-9/finish', ip: '1.2.3.4', playerId: 'loupi' }) === 200);
ok('le même joueur depuis une autre adresse reste limité', hit(finish, { path: '/v1/games/game-10/finish', ip: '5.6.7.8', playerId: 'ada' }) === 429);

const room = rateLimit('room', 2, 60_000);
const rooms = ['AAAA', 'BBBB', 'CCCC'].map((c) => hit(room, { path: `/v1/rooms/${c}`, ip: '9.9.9.9' }));
ok('sans compte : limité par adresse, quel que soit le code essayé', rooms.join() === '200,200,429');

const other = rateLimit('open', 3, 60_000);
ok('chaque limite a son propre compteur', hit(other, { path: '/v1/games', ip: '1.2.3.4', playerId: 'ada' }) === 200);

const short = rateLimit('short', 1, 50);
hit(short, { path: '/x', ip: '1.1.1.1', playerId: 'eve' });
const blocked = hit(short, { path: '/x', ip: '1.1.1.1', playerId: 'eve' });
await new Promise((r) => setTimeout(r, 80));
ok('la fenêtre expirée libère le joueur', blocked === 429 && hit(short, { path: '/x', ip: '1.1.1.1', playerId: 'eve' }) === 200);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
