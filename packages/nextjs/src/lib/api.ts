// Typed client for the Fixpoint API. Used from React components with TanStack
// Query. Errors carry the contract error code so the UI can show a precise
// message.

import type { InvoiceView } from "./invoices";
import type { Actor } from "./hedera";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data?.error?.code ?? "UNKNOWN";
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(code, message, res.status);
  }
  return data as T;
}

export interface PriceInfo {
  source: "hermes" | "cached" | "seed";
  feedId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  fetchedAt: number;
  ageSec: number;
  stale: boolean;
  confBps: number;
  confBpsLimit: number;
  stalenessLimitSec: number;
}

export interface QuoteInfo {
  source: PriceInfo["source"];
  feedId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  ageSec: number;
  confBps: number;
  confBpsLimit: number;
  stalenessLimitSec: number;
  usdCents: number;
  usd: string;
  hbarWei: string;
  feeWei: string;
  totalWei: string;
  accepted: boolean;
  rejection: string | null;
}

export interface AssociationInfo {
  associated: boolean;
  account: string;
  tokenId: string;
  tokenAddr: string;
  symbol: string;
  txHash?: string;
}

export interface AuditResult {
  topicId: string;
  seq: number;
  published: boolean;
}

export interface HistoryRow {
  id: string;
  txHash: string;
  kind: string;
  blockTs: number;
  actor: string | null;
  counter: string | null;
  amountWei: string | null;
  invoiceId: string;
  invoiceNumericId: number;
  invoiceState: string;
  usdCents: number;
  sellerAddr: string;
  buyerAddr: string | null;
  audited: boolean;
  auditSeq: number | null;
}

export interface AuditRow {
  id: string;
  topicId: string;
  seq: number;
  txHash: string;
  payload: string;
  sig: string;
  createdAt: number;
}

export interface HistoryInfo {
  events: HistoryRow[];
  audit: AuditRow[];
  topicId: string;
  receiptTokenId: string;
  agreedCount: number;
  totalCount: number;
}

export const api = {
  price: () => call<PriceInfo>("/api/price"),
  quote: (usdCents: number) =>
    call<QuoteInfo>(`/api/quote?usdCents=${encodeURIComponent(usdCents)}`),
  invoices: () => call<{ invoices: InvoiceView[] }>("/api/invoices"),
  invoice: (id: string) => call<{ invoice: InvoiceView }>(`/api/invoices/${id}`),
  createInvoice: (body: {
    usdCents: number;
    payByTs: number;
    reviewSec: number;
    deliveryTs?: number | null;
    memo: string;
    metaHash?: string;
  }) => call<{ invoice: InvoiceView }>("/api/invoices", { method: "POST", body: JSON.stringify(body) }),
  pay: (id: string, actor: Actor, amountWei?: string) =>
    call<{ invoice: InvoiceView }>(`/api/invoices/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ actor, amountWei }),
    }),
  release: (id: string, actor: Actor) =>
    call<{ invoice: InvoiceView }>(`/api/invoices/${id}/release`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),
  claim: (id: string, actor: Actor) =>
    call<{ invoice: InvoiceView }>(`/api/invoices/${id}/claim`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),
  refund: (id: string, actor: Actor) =>
    call<{ invoice: InvoiceView }>(`/api/invoices/${id}/refund`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),
  claimRefund: (id: string, actor: Actor) =>
    call<{ invoice: InvoiceView }>(`/api/invoices/${id}/claim-refund`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),
  expire: (id: string) =>
    call<{ invoice: InvoiceView }>(`/api/invoices/${id}/expire`, { method: "POST", body: "{}" }),
  association: () => call<AssociationInfo>("/api/association"),
  associate: () => call<AssociationInfo>("/api/association", { method: "POST" }),
  audit: (txHash: string) =>
    call<AuditResult>("/api/audit", { method: "POST", body: JSON.stringify({ txHash }) }),
  history: () => call<HistoryInfo>("/api/history"),
};
