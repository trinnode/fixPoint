// The escrow state machine. This mirrors FixpointEscrow.sol function for
// function, including access control, the Pyth pricing maths, the HTS receipt
// mint and the overpayment refund. Every transition writes an InvoiceEvent so
// the history view can be rebuilt from the log, just as the mirror node would.

import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { EscrowError } from "./errors";
import {
  CONTRACT_ADDR,
  HCS_TOPIC_ID,
  RECEIPT_TOKEN_ID,
  SELLER_ADDR,
  actorAddress,
  type Actor,
} from "./hedera";
import { nextCounter, getKv } from "./kv";
import { computeQuote, getLatestPrice } from "./pyth";

export const INVOICES_START = 1001;
export const SERIALS_START = 1;

type InvoiceRow = Prisma.InvoiceGetPayload<{
  include: { events: true; receipt: true };
}>;

export type InvoiceState =
  | "CREATED"
  | "PAID"
  | "RELEASED"
  | "REFUNDED"
  | "EXPIRED";

export type EventKind =
  | "Created"
  | "Paid"
  | "Released"
  | "Refunded"
  | "Expired"
  | "RefundClaimed";

export interface InvoiceView {
  id: string;
  numericId: number;
  sellerAddr: string;
  buyerAddr: string | null;
  usdCents: number;
  usd: string;
  payByTs: number;
  reviewSec: number;
  deliveryTs: number | null;
  paidAt: number | null;
  amountWei: string | null;
  feeWei: string | null;
  refundWei: string | null;
  priceUsed: string | null;
  confUsed: string | null;
  expoUsed: number | null;
  publishTs: number | null;
  metaHash: string;
  memo: string;
  state: InvoiceState;
  receiptSerial: number | null;
  receiptTokenId: string | null;
  createdAt: number;
  updatedAt: number;
  events: EventView[];
}

export interface EventView {
  id: string;
  kind: EventKind;
  txHash: string;
  actor: string | null;
  counter: string | null;
  amountWei: string | null;
  blockTs: number;
}

export interface CreateInvoiceInput {
  sellerAddr?: string;
  usdCents: number;
  payByTs: number;
  reviewSec: number;
  deliveryTs?: number | null;
  memo: string;
  metaHash?: string;
}

function txHash(seed: string): string {
  return createHash("sha256")
    .update(`${seed}|${randomBytes(8).toString("hex")}`)
    .digest("hex");
}

function metaRef(numericId: number, memo: string): string {
  const h = createHash("sha256").update(memo || String(numericId)).digest("hex");
  return `fx:${numericId}:${h.slice(0, 16)}`;
}

function toView(row: InvoiceRow): InvoiceView {
  const events = (row.events ?? [])
    .slice()
    .sort((a, b) => a.blockTs - b.blockTs)
    .map((e) => ({
      id: e.id,
      kind: e.kind as EventKind,
      txHash: e.txHash,
      actor: e.actor,
      counter: e.counter,
      amountWei: e.amountWei,
      blockTs: e.blockTs,
    }));
  return {
    id: row.id,
    numericId: row.numericId,
    sellerAddr: row.sellerAddr,
    buyerAddr: row.buyerAddr,
    usdCents: row.usdCents,
    usd: (row.usdCents / 100).toFixed(2),
    payByTs: row.payByTs,
    reviewSec: row.reviewSec,
    deliveryTs: row.deliveryTs,
    paidAt: row.paidAt,
    amountWei: row.amountWei,
    feeWei: row.feeWei,
    refundWei: row.refundWei,
    priceUsed: row.priceUsed,
    confUsed: row.confUsed,
    expoUsed: row.expoUsed,
    publishTs: row.publishTs,
    metaHash: row.metaHash,
    memo: row.memo,
    state: row.state as InvoiceState,
    receiptSerial: row.receiptSerial,
    receiptTokenId: row.receiptSerial ? RECEIPT_TOKEN_ID : null,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
    updatedAt: Math.floor(row.updatedAt.getTime() / 1000),
    events,
  };
}

async function loadInvoice(id: string) {
  const row = await db.invoice.findUnique({
    where: { id },
    include: { events: true, receipt: true },
  });
  if (!row) throw new EscrowError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  return row;
}

export async function getInvoice(id: string): Promise<InvoiceView> {
  return toView(await loadInvoice(id));
}

export async function getInvoiceByNumeric(numeric: number): Promise<InvoiceView> {
  const row = await db.invoice.findUnique({
    where: { numericId: numeric },
    include: { events: true, receipt: true },
  });
  if (!row) throw new EscrowError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  return toView(row);
}

export async function listInvoices(): Promise<InvoiceView[]> {
  const rows = await db.invoice.findMany({
    include: { events: true, receipt: true },
    orderBy: { numericId: "desc" },
  });
  return rows.map((r) => toView(r));
}

async function appendEvent(
  invoiceId: string,
  kind: EventKind,
  blockTs: number,
  opts: { actor?: string; counter?: string; amountWei?: string; txHash?: string } = {}
) {
  const hash = opts.txHash ?? txHash(`${invoiceId}|${kind}|${blockTs}`);
  await db.invoiceEvent.create({
    data: {
      invoiceId,
      kind,
      txHash: hash,
      actor: opts.actor ?? null,
      counter: opts.counter ?? null,
      amountWei: opts.amountWei ?? null,
      blockTs,
    },
  });
  return hash;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceView> {
  if (input.usdCents <= 0) {
    throw new EscrowError("BAD_INPUT", "Amount must be greater than zero");
  }
  if (input.usdCents > 1_000_000_00) {
    throw new EscrowError("BAD_INPUT", "Amount exceeds the demo limit of $1,000,000");
  }
  if (input.payByTs <= Math.floor(Date.now() / 1000)) {
    throw new EscrowError("BAD_INPUT", "Pay by date must be in the future");
  }
  if (input.reviewSec < 0 || input.reviewSec > 86_400 * 30) {
    throw new EscrowError("BAD_INPUT", "Review window must be between 0 seconds and 30 days");
  }
  const seller = input.sellerAddr ?? SELLER_ADDR;
  const metaHash =
    input.metaHash && input.metaHash.length > 0
      ? input.metaHash
      : createHash("sha256").update(input.memo || String(input.usdCents)).digest("hex").slice(0, 32);

  const numericId = await nextCounter("invoice_counter", INVOICES_START);
  const now = Math.floor(Date.now() / 1000);
  const hash = txHash(`create|${numericId}`);

  const row = await db.invoice.create({
    data: {
      numericId,
      sellerAddr: seller,
      usdCents: input.usdCents,
      payByTs: input.payByTs,
      reviewSec: input.reviewSec,
      deliveryTs: input.deliveryTs ?? null,
      metaHash,
      memo: input.memo,
      state: "CREATED",
      events: {
        create: {
          kind: "Created",
          txHash: hash,
          actor: seller,
          blockTs: now,
        },
      },
    },
    include: { events: true, receipt: true },
  });
  return toView(row);
}

export async function payInvoice(
  id: string,
  opts: { actor: Actor; amountWei?: string }
): Promise<InvoiceView> {
  const actor = actorAddress(opts.actor);
  let row = await loadInvoice(id);

  if (row.state !== "CREATED") {
    throw new EscrowError("INVOICE_ALREADY_PAID", "Invoice is not in a payable state");
  }
  if (actor === row.sellerAddr) {
    throw new EscrowError("SELLER_CANNOT_PAY", "The seller cannot pay their own invoice");
  }
  const now = Math.floor(Date.now() / 1000);
  if (now > row.payByTs) {
    throw new EscrowError("INVOICE_EXPIRED", "The pay by date has passed");
  }

  const associated = await getKv("buyer_associated");
  if (associated !== "1") {
    throw new EscrowError(
      "RECEIPT_NOT_ASSOCIATED",
      "Buyer is not associated with the receipt token. Associate first."
    );
  }

  const snap = await getLatestPrice();
  const quote = computeQuote({
    usdCents: row.usdCents,
    price: snap.price,
    conf: snap.conf,
    expo: snap.expo,
    publishTime: snap.publishTime,
  });
  if (!quote.accepted) {
    throw new EscrowError("PRICE_REJECTED", quote.rejection ?? "Price rejected");
  }

  const sent = opts.amountWei ? BigInt(opts.amountWei) : quote.totalWei;
  if (sent < quote.totalWei) {
    throw new EscrowError(
      "INSUFFICIENT_PAYMENT",
      `Sent ${sent.toString()} wei is less than the required ${quote.totalWei.toString()} wei`
    );
  }
  const refund = sent - quote.totalWei;

  const serial = await nextCounter("receipt_serial", SERIALS_START);
  const ref = metaRef(row.numericId, row.memo);
  const mintHash = txHash(`mint|${id}|${serial}`);

  const paidAt = Math.floor(Date.now() / 1000);
  const payHash = txHash(`pay|${id}|${paidAt}`);

  const updated = await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        state: "PAID",
        buyerAddr: actor,
        paidAt,
        amountWei: quote.hbarWei.toString(),
        feeWei: quote.feeWei.toString(),
        refundWei: refund.toString(),
        priceUsed: snap.price,
        confUsed: snap.conf,
        expoUsed: snap.expo,
        publishTs: snap.publishTime,
        receiptSerial: serial,
      },
    });
    await tx.receipt.create({
      data: {
        invoiceId: id,
        tokenId: RECEIPT_TOKEN_ID,
        serial,
        owner: actor,
        metaRef: ref,
        mintTx: mintHash,
      },
    });
    await tx.invoiceEvent.createMany({
      data: [
        {
          invoiceId: id,
          kind: "Paid",
          txHash: payHash,
          actor,
          counter: CONTRACT_ADDR,
          amountWei: quote.hbarWei.toString(),
          blockTs: paidAt,
        },
        {
          invoiceId: id,
          kind: "Paid",
          txHash: mintHash,
          actor: CONTRACT_ADDR,
          counter: actor,
          amountWei: "0",
          blockTs: paidAt,
        },
      ],
    });
    return tx.invoice.findUnique({
      where: { id },
      include: { events: true, receipt: true },
    });
  });

  if (!updated) throw new EscrowError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  row = updated;
  return toView(row);
}

type SettleKind = "Released" | "Refunded" | "RefundClaimed";

interface SettleOpts {
  actor: Actor;
  kind: SettleKind;
  // Who must call this function.
  actorRole: "seller" | "buyer";
  // Where the held funds go.
  recipientRole: "seller" | "buyer";
  reviewWindowRequired?: boolean;
  deliveryDeadlineRequired?: boolean;
}

async function settle(id: string, opts: SettleOpts): Promise<InvoiceView> {
  const actor = actorAddress(opts.actor);
  let row = await loadInvoice(id);
  if (row.state !== "PAID") {
    throw new EscrowError("INVOICE_NOT_PAYABLE", "Invoice is not in a paid state");
  }
  const now = Math.floor(Date.now() / 1000);

  const expectedActor = opts.actorRole === "seller" ? row.sellerAddr : row.buyerAddr;
  if (actor !== expectedActor) {
    throw new EscrowError(
      opts.actorRole === "seller" ? "NOT_SELLER" : "NOT_BUYER",
      opts.actorRole === "seller"
        ? "Only the seller can perform this action"
        : "Only the buyer can perform this action"
    );
  }

  if (opts.reviewWindowRequired && row.paidAt && now < row.paidAt + row.reviewSec) {
    throw new EscrowError(
      "REVIEW_WINDOW_NOT_PASSED",
      "The review window has not yet passed"
    );
  }

  if (opts.deliveryDeadlineRequired) {
    if (!row.deliveryTs) {
      throw new EscrowError("BAD_INPUT", "No delivery deadline was set on this invoice");
    }
    if (now <= row.deliveryTs) {
      throw new EscrowError(
        "INVOICE_NOT_EXPIRED",
        "The delivery deadline has not yet passed"
      );
    }
  }

  const recipient = opts.recipientRole === "seller" ? row.sellerAddr : row.buyerAddr ?? actor;
  const amount = row.amountWei ?? "0";
  const hash = txHash(`${opts.kind}|${id}|${now}`);
  const finalState = opts.kind === "Released" ? "RELEASED" : "REFUNDED";

  const updated = await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: { state: finalState },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId: id,
        kind: opts.kind,
        txHash: hash,
        actor,
        counter: recipient,
        amountWei: amount,
        blockTs: now,
      },
    });
    return tx.invoice.findUnique({
      where: { id },
      include: { events: true, receipt: true },
    });
  });
  if (!updated) throw new EscrowError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  row = updated;
  return toView(row);
}

// release: the buyer releases the held funds to the seller.
export async function releaseInvoice(id: string, opts: { actor: Actor }) {
  return settle(id, {
    ...opts,
    kind: "Released",
    actorRole: "buyer",
    recipientRole: "seller",
  });
}

// claimAfterReview: the seller claims after the review window passes.
export async function claimAfterReview(id: string, opts: { actor: Actor }) {
  return settle(id, {
    ...opts,
    kind: "Released",
    actorRole: "seller",
    recipientRole: "seller",
    reviewWindowRequired: true,
  });
}

// refund: the seller voluntarily refunds the buyer.
export async function refundInvoice(id: string, opts: { actor: Actor }) {
  return settle(id, {
    ...opts,
    kind: "Refunded",
    actorRole: "seller",
    recipientRole: "buyer",
  });
}

// claimRefundIfExpired: the buyer reclaims if a delivery deadline was missed.
export async function claimRefundIfExpired(id: string, opts: { actor: Actor }) {
  return settle(id, {
    ...opts,
    kind: "RefundClaimed",
    actorRole: "buyer",
    recipientRole: "buyer",
    deliveryDeadlineRequired: true,
  });
}

export async function expireInvoice(id: string): Promise<InvoiceView> {
  let row = await loadInvoice(id);
  if (row.state !== "CREATED") {
    throw new EscrowError("INVOICE_NOT_PAYABLE", "Only a created invoice can be expired");
  }
  const now = Math.floor(Date.now() / 1000);
  if (now <= row.payByTs) {
    throw new EscrowError("INVOICE_NOT_EXPIRED", "The pay by date has not yet passed");
  }
  const hash = txHash(`Expired|${id}|${now}`);
  const updated = await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { state: "EXPIRED" } });
    await tx.invoiceEvent.create({
      data: {
        invoiceId: id,
        kind: "Expired",
        txHash: hash,
        blockTs: now,
      },
    });
    return tx.invoice.findUnique({
      where: { id },
      include: { events: true, receipt: true },
    });
  });
  if (!updated) throw new EscrowError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  row = updated;
  return toView(row);
}

// Idempotent HCS audit publish. The relayer verifies the event exists (the
// mirror node equivalent) before publishing, and deduplicates by tx hash.
export async function publishAudit(txHash: string): Promise<{
  topicId: string;
  seq: number;
  published: boolean;
}> {
  const existing = await db.auditMessage.findUnique({ where: { txHash } });
  if (existing) {
    return { topicId: existing.topicId, seq: existing.seq, published: false };
  }
  const event = await db.invoiceEvent.findFirst({ where: { txHash } });
  if (!event) {
    throw new EscrowError("INVOICE_NOT_FOUND", "No chain event matches that transaction hash", 404);
  }
  const invoice = await db.invoice.findUnique({ where: { id: event.invoiceId } });
  if (!invoice) {
    throw new EscrowError("INVOICE_NOT_FOUND", "Invoice for that event not found", 404);
  }
  const seq = await nextCounter(`hcs_seq_${HCS_TOPIC_ID}`, 0);
  const payload = JSON.stringify({
    v: 1,
    type: event.kind,
    invoiceRef: invoice.numericId,
    invoiceId: invoice.id,
    state: invoice.state,
    from: event.actor,
    to: event.counter,
    amountWei: event.amountWei,
    txHash: event.txHash,
    blockTs: event.blockTs,
  });
  // Simulated operator signature. In the deployed template this is an Ed25519
  // signature over the payload using the relayer operator key.
  const sig = createHash("sha256")
    .update(`${HCS_TOPIC_ID}|${seq}|${payload}`)
    .digest("hex");
  await db.auditMessage.create({
    data: {
      topicId: HCS_TOPIC_ID,
      seq,
      txHash,
      payload,
      sig,
    },
  });
  return { topicId: HCS_TOPIC_ID, seq, published: true };
}
