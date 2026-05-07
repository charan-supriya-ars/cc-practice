import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL ?? 'file:inventory.db',
    });
  }
  return client;
}

export function setClient(c: Client): void {
  client = c;
}
