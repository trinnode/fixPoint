// Seed the demo ledger. Idempotent: if an invoice already exists it leaves the
// database alone. Run with: npm run db:seed
//
// Seeds four invoices that together exercise the whole state machine: a created
// one awaiting payment, one in escrow, one released and one refunded. Each
// transition publishes an HCS audit message so the history view has agreement
// markers from the start.

import { PrismaClient } from "@prisma/client";
import { setKv } from "../src/lib/kv";
import {
  createInvoice,
  payInvoice,
  releaseInvoice,
  refundInvoice,
  publishAudit,
  listInvoices,
} from "../src/lib/invoices";

const db = new PrismaClient();

async function exists() {
  const count = await db.invoice.count();
  return count > 0;
}

async function auditAll(invoiceId: string) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { events: true },
  });
  if (!inv) return;
  for (const e of inv.events) {
    try {
      await publishAudit(e.txHash);
    } catch {
      // ignore duplicates
    }
  }
}

async function main() {
  if (await exists()) {
    console.log("Seed: data already present, skipping.");
    return;
  }
  await setKv("buyer_associated", "1");

  const day = 86_400;
  const now = Math.floor(Date.now() / 1000);

  // 1. Awaiting payment — the demo pay target on the landing page.
  const a = await createInvoice({
    usdCents: 2500,
    payByTs: now + day,
    reviewSec: day,
    memo: "Design sprint deliverable, March",
  });
  await auditAll(a.id);

  // 2. In escrow — paid, awaiting release.
  const b = await createInvoice({
    usdCents: 6000,
    payByTs: now + 2 * day,
    reviewSec: day,
    memo: "Brand audit report",
  });
  await payInvoice(b.id, { actor: "buyer" });
  await auditAll(b.id);

  // 3. Released — completed flow, receipt held by buyer.
  const c = await createInvoice({
    usdCents: 12000,
    payByTs: now + 2 * day,
    reviewSec: 3600,
    memo: "Smart contract review and advisory",
  });
  const cPaid = await payInvoice(c.id, { actor: "buyer" });
  await releaseInvoice(cPaid.id, { actor: "buyer" });
  await auditAll(c.id);

  // 4. Refunded by the seller voluntarily.
  const d = await createInvoice({
    usdCents: 4000,
    payByTs: now + 2 * day,
    reviewSec: day,
    deliveryTs: now + 3 * day,
    memo: "Workshop deposit, refunded after reschedule",
  });
  const dPaid = await payInvoice(d.id, { actor: "buyer" });
  await refundInvoice(dPaid.id, { actor: "seller" });
  await auditAll(d.id);

  const all = await listInvoices();
  console.log(`Seed: created ${all.length} invoices.`);
  for (const inv of all) {
    console.log(`  #${inv.numericId} ${inv.state.padEnd(8)} ${inv.memo}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
