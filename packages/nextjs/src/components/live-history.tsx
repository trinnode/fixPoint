// Live contract tab for the history page.
//
// Reads invoiceCount and the latest 10 invoices straight from the relay.
// Needs no wallet. Honest empty and error states, Hashscan links per row.

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AddressChip } from "@/components/address-chip";
import { StateBadge } from "@/components/state-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LIVE_CONTRACT_ADDRESS,
  LIVE_HCS_TOPIC_ID,
  getInvoice,
  getInvoiceCount,
  hashscanTx,
  hasReceiptToken,
  type LiveInvoice,
} from "@/lib/chain";
import { hashscanUrl, shortAddr } from "@/lib/hedera";
import { formatUsd } from "@/lib/format";

async function latestTen(): Promise<{ count: number; invoices: LiveInvoice[] }> {
  const count = await getInvoiceCount();
  const ids: number[] = [];
  for (let i = Math.max(0, count - 10); i < count; i += 1) ids.push(i);
  ids.reverse();
  const invoices = await Promise.all(ids.map((id) => getInvoice(id)));
  return { count, invoices };
}

function toBadgeState(state: LiveInvoice["state"]): "CREATED" | "PAID" | "RELEASED" | "REFUNDED" | "EXPIRED" {
  return state;
}

export function LiveHistory() {
  const q = useQuery({
    queryKey: ["live-history"],
    queryFn: latestTen,
    refetchInterval: 15_000,
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
        <p className="text-xs text-muted-foreground">Reading the live contract</p>
      </div>
    );
  }

  if (q.isError || !q.data) {
    console.error("[live] history read failed", q.error);
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">The relay did not answer</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Live reads need the testnet relay. The demo tabs above keep working.
        </p>
      </div>
    );
  }

  const { count, invoices } = q.data;

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Live invoices</p>
          <p className="mt-1 font-display text-2xl font-medium text-foreground tabular-nums">{count}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Contract</p>
          <p className="mt-1 font-mono text-sm text-foreground tabular-nums">
            {shortAddr(LIVE_CONTRACT_ADDRESS)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Audit topic</p>
          <p className="mt-1 font-mono text-sm text-foreground tabular-nums">{LIVE_HCS_TOPIC_ID}</p>
        </div>
      </div>

      {!hasReceiptToken() && (
        <p className="mb-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          Receipt token: not set on the deployment yet, so live pay stays paused. Minting needs the
          receipt token set on chain.
        </p>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No live invoices yet. Create one with a connected wallet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto scroll-quiet">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Seller</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Hashscan</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}?live=1`}
                        className="font-medium text-primary hover:underline tabular-nums"
                      >
                        #{inv.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={toBadgeState(inv.state)} />
                    </td>
                    <td className="px-4 py-3">
                      <AddressChip address={inv.seller} />
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      {formatUsd(inv.usdCents)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={hashscanTx(LIVE_CONTRACT_ADDRESS)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Contract
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Contract reads via the testnet relay, refreshed every 15 seconds. Full event log at{" "}
            <a
              href={hashscanUrl(`contracts/${LIVE_CONTRACT_ADDRESS}`)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Hashscan
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
