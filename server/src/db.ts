// Accès à PostgreSQL et migrations appliquées au démarrage.
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://lexicode:lexicode@localhost:5432/lexicode',
  max: Number(process.env.DB_POOL ?? 10),
  idleTimeoutMillis: 30_000,
  // Une requête bloquée ne doit pas retenir une connexion du pool indéfiniment.
  options: `-c statement_timeout=${Number(process.env.DB_STATEMENT_TIMEOUT ?? 5_000)}`,
});

// Un client inactif peut perdre sa connexion (redémarrage de la base, coupure réseau) : sans écouteur,
// l'erreur ferait tomber le processus et toutes les salles en cours. Le pool en ouvrira un autre.
pool.on('error', (e) => console.error('PostgreSQL : client inactif perdu', e.message));

export const q = <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) => pool.query<T>(text, params);

/** Exécute `fn` dans une transaction : tout est validé ensemble, ou rien. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Applique dans l'ordre les fichiers de migrations/ qui ne l'ont pas encore été. */
export async function migrate(): Promise<string[]> {
  await q('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
  const done = new Set((await q<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('begin');
      // Une migration (création d'index sur une grosse table) peut dépasser la limite des requêtes ordinaires.
      await client.query('set local statement_timeout = 0');
      await client.query(readFileSync(join(dir, f), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [f]);
      await client.query('commit');
      applied.push(f);
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  return applied;
}
