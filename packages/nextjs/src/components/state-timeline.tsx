"use client";

import type { InvoiceView, EventView } from "@/lib/invoices";
import { HashBadge } from "./hash-badge";
import { AddressChip } from "./address-chip";
import { formatHbar, relTime } from "@/lib/format";
import { hashscanUrl } from "@/lib/hedera";
import { cn } from "@/lib/utils";

const kindLabel: Record<EventView["kind"], string> = {
  Created: "Invoice created",
  Paid: "Payment settled",
  Released: "Funds released",
  Refunded: "Funds refunded",
  Expired: "Invoice expired",
  RefundClaimed: "Refund claimed",
};

export function StateTimeline({ invoice }: { invoice: InvoiceView }) {
  const events = invoice.events;
  return (
    <ol className="relative space-y-5 pl-6">
      <span className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-border" aria-hidden />
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                isLast ? "bg-primary" : "bg-muted-foreground/40"
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-foreground">{kindLabel[e.kind]}</p>
              <time className="text-xs text-muted-foreground tabular-nums" dateTime={new Date(e.blockTs * 1000).toISOString()}>
                {relTime(e.blockTs)} · {new Date(e.blockTs * 1000).toLocaleString()}
              </time>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <HashBadge hash={e.txHash} href={hashscanUrl(`transactions/${e.txHash}`)} />
              {e.actor && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground/70">from</span>
                  <AddressChip address={e.actor} />
                </span>
              )}
              {e.counter && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground/70">to</span>
                  <AddressChip address={e.counter} />
                </span>
              )}
              {e.amountWei && e.amountWei !== "0" && (
                <span className="tabular-nums">{formatHbar(e.amountWei)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
