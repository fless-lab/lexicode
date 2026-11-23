// Point d'entrée : API HTTP et serveur de jeu temps réel (Colyseus) sur le même port.
import { createServer } from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createApp } from './app';
import { LexiRoom, QueueRoom } from './rooms';
import { migrate, pool } from './db';

const PORT = Number(process.env.PORT ?? 2567);

async function main() {
  const applied = await migrate();
  if (applied.length) console.log(`migrations appliquées : ${applied.join(', ')}`);

  const app = createApp();
  const http = createServer(app);
  const game = new Server({ transport: new WebSocketTransport({ server: http }), greet: false } as ConstructorParameters<typeof Server>[0]);
  // Jeu à plusieurs : file d'attente par langue, puis duel ; salons et enquêtes rejoints par code.
  game.define('queue', QueueRoom).filterBy(['lang']);
  game.define('duel', LexiRoom, { kind: 'duel' });
  game.define('party', LexiRoom, { kind: 'party' });
  game.define('coop', LexiRoom, { kind: 'coop' });

  await game.listen(PORT);
  console.log(`Lexicode serveur prêt sur le port ${PORT}`);

  const stop = async () => {
    await game.gracefullyShutdown(false);
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
