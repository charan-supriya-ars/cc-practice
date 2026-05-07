import { createClient } from '@libsql/client';
import { runMigrations } from '../src/db/migrate.js';
import { setClient } from '../src/db/client.js';

export async function setupTestDb() {
  const client = createClient({ url: ':memory:' });
  await client.execute('PRAGMA foreign_keys = ON');
  await runMigrations(client);
  setClient(client);
  return client;
}
