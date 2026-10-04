import { db } from "@/lib/db";
import { HCS_TOPIC_ID, RECEIPT_TOKEN_ID } from "@/lib/hedera";

export async function GET() {
  const events = await db.invoiceEvent.findMany({
    include: { invoice: true },
    orderBy: { blockTs: "desc" },
  });
  const audits = await db.auditMessage.findMany({
    where: { topicId: HCS_TOPIC_ID },
    orderBy: { seq: "asc" },
  });

  const auditByTx = new Map(audits.map((a) => [a.txHash, a]));

  const eventRows = events.map((e) => {
    const audit = auditByTx.get(e.txHash);
    return {
      id: e.id,
      txHash: e.txHash,
      kind: e.kind,
      blockTs: e.blockTs,
      actor: e.actor,
      counter: e.counter,
      amountWei: e.amountWei,
      invoiceId: e.invoiceId,
      invoiceNumericId: e.invoice.numericId,
      invoiceState: e.invoice.state,
      usdCents: e.invoice.usdCents,
      sellerAddr: e.invoice.sellerAddr,
      buyerAddr: e.invoice.buyerAddr,
      audited: Boolean(audit),
      auditSeq: audit?.seq ?? null,
    };
  });

  return Response.json({
    events: eventRows,
    audit: audits.map((a) => ({
      id: a.id,
      topicId: a.topicId,
      seq: a.seq,
      txHash: a.txHash,
      payload: a.payload,
      sig: a.sig,
      createdAt: Math.floor(a.createdAt.getTime() / 1000),
    })),
    topicId: HCS_TOPIC_ID,
    receiptTokenId: RECEIPT_TOKEN_ID,
    agreedCount: eventRows.filter((e) => e.audited).length,
    totalCount: eventRows.length,
  });
}
