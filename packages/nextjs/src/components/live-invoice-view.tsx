// Live invoice detail, read from the testnet contract.
//
// Shown on the invoice route when live=1 is present. Demo lookup stays the
// default. Includes the wallet action row and links back to the demo record.

"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AddressChip } from "@/components/address-chip";
import { HashBadge } from "@/components/hash-badge";
import { LiveInvoiceActions } from "@/components/live-invoice-actions";
import { StateBadge } from "@/components/state-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/components/wallet-provider";
import {
  LIVE_CONTRACT_ADDRESS,
  getInvoice,
} from "@/lib/chain";
import { hashscanUrl } from "@/lib/hedera";
import { formatHbar, formatUsd } from "@/lib/format";
import { AlertCircle, ArrowLeft } from "lucide-react";

export function LiveInvoiceView({ id }: { id: number }) {
  const qc = useQueryClient();
  const { status } = useWallet();
  const q = useQuery({
    queryKey: ["live-invoice", id],
    queryFn: () => getInvoice(id),
    refetchInterval: 10_000,
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
        <p className="mt-2 text-xs text-muted-foreground">Reading the live contract</p>
      </div>
    );
  }

  if (q.isError || !q.data) {
    console.error("[live] invoice read failed", q.error);
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-medium">Live invoice not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The relay did not return an invoice for this id. It may not exist on the live contract
            yet.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link href={`/invoices/${id}`} className="text-sm font-medium text-primary hover:underline">
              View demo record
            </Link>
            <Link href="/history" className="text-sm font-medium text-primary hover:underline">
              History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inv = q.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/history"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> History
        </Link>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
          Live on testnet
        </span>
        <Link href={`/invoices/${id}`} className="text-xs font-medium text-primary hover:underline">
          View demo record instead
        </Link>
      </div>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live invoice
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <h1 className="font-display text-3xl font-medium tracking-tight text-foreground tabular-nums">
              #{inv.id}
            </h1>
            <StateBadge state={inv.state} />
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="tabular-nums">Pay by {new Date(inv.payBy * 1000).toLocaleString()}</p>
          <a
            href={hashscanUrl(`contracts/${LIVE_CONTRACT_ADDRESS}`)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Contract on Hashscan
          </a>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Amount">
                <span className="font-display text-lg font-medium text-foreground tabular-nums">
                  {formatUsd(inv.usdCents)}
                </span>
              </Field>
              <Field label="Review window">
                <span className="text-sm text-foreground">
                  {inv.reviewWindow === 0 ? "none" : `${inv.reviewWindow / 3600}h`}
                </span>
              </Field>
              <Field label="Seller">
                <AddressChip address={inv.seller} />
              </Field>
              <Field label="Buyer">
                <AddressChip address={inv.buyer} />
              </Field>
              <Field label="Held in escrow">
                <span className="text-sm text-foreground tabular-nums">{formatHbar(inv.amountHeldWei)}</span>
              </Field>
              <Field label="Metadata hash">
                <HashBadge hash={inv.metadataHash} />
              </Field>
              {inv.receiptSerial !== null && (
                <Field label="Receipt serial">
                  <span className="text-sm text-foreground tabular-nums">#{inv.receiptSerial}</span>
                </Field>
              )}
            </dl>
          </section>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {status === "connected" ? (
            <LiveInvoiceActions
              invoice={inv}
              onSettled={() => qc.invalidateQueries({ queryKey: ["live-invoice", id] })}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Connect a wallet to act on this live invoice. Reads above need no wallet.
            </div>
          )}
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
