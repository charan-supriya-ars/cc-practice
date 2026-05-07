import { type Client } from '@libsql/client';
import { getClient } from './client.js';
import { SCHEMA } from './schema.js';

export async function runMigrations(client: Client): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
  for (const sql of SCHEMA) {
    await client.execute(sql);
  }
}

async function main() {
  const client = getClient();
  await runMigrations(client);
  console.log('Migrations completed successfully.');
}

const isMain = process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');
if (isMain) {
  main().catch(console.error);
}
