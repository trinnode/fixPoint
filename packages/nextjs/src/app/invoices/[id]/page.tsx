"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StateBadge } from "@/components/state-badge";
import { StateTimeline } from "@/components/state-timeline";
import { AddressChip } from "@/components/address-chip";
import { HashBadge } from "@/components/hash-badge";
import { InvoiceActions } from "@/components/invoice-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle } from "lucide-react";
import {
  CONTRACT_ADDR,
  RECEIPT_TOKEN_ID,
  RECEIPT_TOKEN_SYMBOL,
  hashscanUrl,
  shortAddr,
} from "@/lib/hedera";
import { formatHbar, formatPrice, formatUsd } from "@/lib/format";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const invoiceQ = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.invoice(id),
    enabled: Boolean(id),
    refetchInterval: 8_000,
  });
  const assocQ = useQuery({ queryKey: ["association"], queryFn: api.association });

  const invoice = invoiceQ.data?.invoice;
  const showQuote = invoice?.state === "CREATED";
  const quoteQ = useQuery({
    queryKey: ["quote", invoice?.usdCents ?? 0],
    queryFn: () => api.quote(invoice!.usdCents),
    enabled: showQuote && Boolean(invoice),
  });

  if (invoiceQ.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (invoiceQ.isError || !invoice) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-medium">Invoice not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            That invoice id does not exist, or the request failed. It never
            reached the ledger, so there is nothing to audit.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Back home
            </Link>
            <Link href="/history" className="text-sm font-medium text-primary hover:underline">
              Back to history
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> History
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Invoice
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-display text-3xl font-medium tracking-tight text-foreground tabular-nums">
              #{invoice.numericId}
            </h1>
            <StateBadge state={invoice.state} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{invoice.memo}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Created {new Date(invoice.createdAt * 1000).toLocaleString()}</p>
          <p className="tabular-nums">Pay by {new Date(invoice.payByTs * 1000).toLocaleString()}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Lifecycle</h2>
            <div className="mt-5">
              <StateTimeline invoice={invoice} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Amount">
                <span className="font-display text-lg font-medium tabular-nums text-foreground">{formatUsd(invoice.usdCents)}</span>
              </Field>
              <Field label="Review window">
                <span className="text-sm text-foreground">{invoice.reviewSec === 0 ? "none" : `${invoice.reviewSec / 3600}h`}</span>
              </Field>
              <Field label="Seller">
                <AddressChip address={invoice.sellerAddr} />
              </Field>
              <Field label="Buyer">
                <AddressChip address={invoice.buyerAddr} />
              </Field>
              <Field label="Metadata hash">
                <HashBadge hash={invoice.metaHash} />
              </Field>
              <Field label="Escrow contract">
                <AddressChip address={CONTRACT_ADDR} />
              </Field>
              {invoice.deliveryTs != null && (
                <Field label="Delivery deadline">
                  <span className="text-sm text-foreground">{new Date(invoice.deliveryTs * 1000).toLocaleString()}</span>
                </Field>
              )}
            </dl>
          </section>

          {invoice.state === "PAID" && invoice.amountWei && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">Settlement</h2>
              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Oracle price">
                  <span className="tabular-nums text-foreground">{formatPrice(invoice.priceUsed!, invoice.expoUsed!, 4)}</span>
                </Field>
                <Field label="Publish time">
                  <span className="tabular-nums text-foreground">{invoice.publishTs ? new Date(invoice.publishTs * 1000).toLocaleString() : "—"}</span>
                </Field>
                <Field label="Held in escrow">
                  <span className="tabular-nums text-foreground">{formatHbar(invoice.amountWei)}</span>
                </Field>
                <Field label="Oracle fee paid">
                  <span className="tabular-nums text-foreground">{formatHbar(invoice.feeWei)}</span>
                </Field>
                {invoice.refundWei && BigInt(invoice.refundWei) > 0n && (
                  <Field label="Refunded to buyer">
                    <span className="tabular-nums text-success">{formatHbar(invoice.refundWei)}</span>
                  </Field>
                )}
              </dl>
            </section>
          )}

          {invoice.receiptSerial != null && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">HTS receipt</h2>
              <div className="mt-4 flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.4" />
                    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </div>
                <div className="flex-1 space-y-1.5 text-sm">
                  <p className="font-medium text-foreground">
                    {RECEIPT_TOKEN_SYMBOL} #{invoice.receiptSerial}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Non-fungible receipt minted by the contract and held by the buyer as proof of payment.
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Token</dt>
                      <dd className="font-mono text-foreground">{RECEIPT_TOKEN_ID}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Owner</dt>
                      <dd className="font-mono text-foreground">{shortAddr(invoice.buyerAddr)}</dd>
                    </div>
                  </dl>
                  <a
                    href={hashscanUrl(`tokens/${RECEIPT_TOKEN_ID}/${invoice.receiptSerial}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block pt-1 text-xs font-medium text-primary hover:underline"
                  >
                    View on Hashscan ↗
                  </a>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <InvoiceActions
            invoice={invoice}
            quote={showQuote ? quoteQ.data ?? null : null}
            associated={assocQ.data?.associated ?? false}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
