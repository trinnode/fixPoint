"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { api } from "@/lib/api";
import { formatHbar, formatPrice } from "@/lib/format";
import { StateOrb } from "@/components/fx/state-orb";

/** Demo quote for 500 dollars, read live from the quote API. */
export function MiniQuoteVisual() {
  const q = useQuery({
    queryKey: ["home-mini-quote"],
    queryFn: () => api.quote(50000),
    refetchInterval: 15_000,
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-3" aria-label="Loading quote">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-7 w-36 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (q.isError || !q.data.accepted) {
    return (
      <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        Quote unavailable right now. Open a live invoice to see the exact HBAR maths.
      </p>
    );
  }

  const quote = q.data;
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">500 dollars settles as</span>
        <span className="font-display text-xl font-semibold tabular-nums text-foreground">
          {formatHbar(quote.hbarWei)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
        <span>Rate {formatPrice(quote.price, quote.expo, 4)}</span>
        <span>Fee {formatHbar(quote.feeWei)}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Rounded up for the seller, via {quote.source}.
      </p>
    </div>
  );
}

/** First chain event with a matching HCS audit message, read live. */
export function AgreementVisual() {
  const q = useQuery({
    queryKey: ["home-agreement"],
    queryFn: api.history,
    refetchInterval: 15_000,
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-3" aria-label="Loading audit proof">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        Audit proof unavailable right now. Open the history view to compare chain and topic directly.
      </p>
    );
  }

  const agreed = q.data.events.find((e) => e.audited);
  if (!agreed) {
    return (
      <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        No audited events yet. Publish an audit from the history view and this
        row turns into proof.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-success/15 text-success">
        <BadgeCheck className="h-5 w-5" />
      </span>
      <div className="text-xs leading-relaxed">
        <p className="font-semibold text-foreground">
          Chain event and audit message agree
        </p>
        <p className="tabular-nums text-muted-foreground">
          Invoice #{agreed.invoiceNumericId} {agreed.kind}, audit seq {agreed.auditSeq}
        </p>
      </div>
    </div>
  );
}

/** Compact agreement line for the proof band. */
export function AgreementLine() {
  const q = useQuery({
    queryKey: ["history"],
    queryFn: api.history,
    refetchInterval: 10_000,
  });

  if (q.isLoading || !q.data) {
    return <p className="text-sm text-muted-foreground">Checking the audit topic…</p>;
  }
  if (q.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Audit count unavailable.{" "}
        <Link href="/history" className="font-medium text-primary hover:underline">
          Open the history
        </Link>{" "}
        to compare directly.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold tabular-nums text-foreground">{q.data.agreedCount}</span> of{" "}
      <span className="tabular-nums text-foreground">{q.data.totalCount}</span> chain events carry a
      matching HCS audit message.{" "}
      <Link href="/history" className="font-medium text-primary hover:underline">
        Open the history
      </Link>{" "}
      to verify each one.
    </p>
  );
}

/** Small PAID orb visual for the receipts card. */
export function PaidOrbVisual() {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <StateOrb state="PAID" />
    </div>
  );
}

/** Static three state strip: Created, Paid, Released. */
export function MiniStatesVisual() {
  const states = ["Created", "Paid", "Released"];
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3" aria-label="Escrow states: created, paid, released">
      <ol className="flex items-center gap-1">
        {states.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1 last:flex-none">
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={
                  i === 0
                    ? "h-2.5 w-2.5 rounded-full bg-warning"
                    : i === 1
                      ? "h-2.5 w-2.5 rounded-full bg-primary"
                      : "h-2.5 w-2.5 rounded-full bg-success"
                }
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium text-foreground">{s}</span>
            </span>
            {i < states.length - 1 && (
              <span className="mx-1 mb-5 h-px flex-1 bg-border" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
