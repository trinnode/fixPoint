// Small key value store used for monotonic counters: invoice reference
// numbers, NFT serials and the HCS topic sequence number. SQLite does the
// atomicity.

import { db } from "./db";

export async function getKv(key: string): Promise<string | null> {
  const row = await db.kv.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setKv(key: string, value: string): Promise<void> {
  await db.kv.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// Atomically increment a counter, returning the next value. The first call
// returns `start`.
export async function nextCounter(key: string, start: number): Promise<number> {
  const current = await getKv(key);
  const next = current === null ? start : Number(current) + 1;
  await setKv(key, String(next));
  return next;
}
