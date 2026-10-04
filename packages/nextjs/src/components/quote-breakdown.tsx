"use client";

import type { QuoteInfo } from "@/lib/api";
import { formatHbar, formatHbarPlain, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function QuoteBreakdown({ quote }: { quote: QuoteInfo }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">USD to settle</span>
          <span className="font-display text-2xl font-medium tabular-nums text-foreground">
            ${quote.usd}
          </span>
        </div>
      </div>

      {!quote.accepted ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive">Quote rejected</p>
          <p className="mt-1 text-xs text-muted-foreground">{quote.rejection}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The contract would revert. Adjust the amount or wait for a fresher
            oracle update.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <Row label="Oracle price" value={formatPrice(quote.price, quote.expo, 4)} hint={`expo ${quote.expo}`} />
          <Row
            label="Confidence"
            value={`${quote.confBps} bps`}
            hint={`limit ${quote.confBpsLimit} bps`}
            ok={quote.confBps <= quote.confBpsLimit}
          />
          <Row
            label="Staleness"
            value={`${quote.ageSec}s`}
            hint={`limit ${quote.stalenessLimitSec}s`}
            ok={quote.ageSec <= quote.stalenessLimitSec}
          />
          <div className="hairline h-px" />
          <Row label="HBAR held in escrow" value={formatHbar(quote.hbarWei)} strong hint="rounded up" />
          <Row label="Oracle fee" value={formatHbar(quote.feeWei)} />
          <div className="hairline h-px" />
          <Row label="Buyer sends" value={formatHbar(quote.totalWei)} strong />
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        The held amount is computed as{" "}
        <span className="font-mono text-foreground">
          ⌈usdCents × 10
          <sup>{18 - quote.expo}</sup> ÷ (100 × price)⌉
        </span>{" "}
        weibar, rounded up in favour of the seller. Stale or loose prices revert.
        Excess sent is refunded to the buyer.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
  ok,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        {hint && (
          <span
            className={cn(
              "text-[10.5px] tabular-nums",
              ok === false ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {hint}
          </span>
        )}
        <span
          className={cn(
            "tabular-nums text-foreground",
            strong ? "font-medium font-display text-base" : ""
          )}
        >
          {value}
        </span>
      </span>
    </div>
  );
}
