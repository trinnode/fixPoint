"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type PriceInfo } from "@/lib/api";
import { formatPrice, confBps as confToBps, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const sourceLabel: Record<PriceInfo["source"], { text: string; cls: string }> = {
  hermes: { text: "Pyth Hermes · live", cls: "text-success" },
  cached: { text: "Pyth Hermes · cached", cls: "text-warning" },
  seed: { text: "Offline seed", cls: "text-warning" },
};

export function PriceCard({
  pollMs = 10_000,
  className,
  compact = false,
}: {
  pollMs?: number;
  className?: string;
  compact?: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["price"],
    queryFn: api.price,
    refetchInterval: pollMs,
  });

  if (isError) {
    return (
      <div className={cn("rounded-xl border border-destructive/40 bg-destructive/5 p-4", className)}>
        <p className="text-sm font-medium text-destructive">Price unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The Pyth Hermes API could not be reached. Retrying shortly.
        </p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const src = sourceLabel[data.source];
  const stale = data.stale;
  const confPct = (data.confBps / 100).toFixed(2);
  const offline = data.source !== "hermes";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          HBAR / USD
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <span className={cn("h-1.5 w-1.5 rounded-full", stale ? "bg-warning" : "bg-success", !stale && "animate-pulse")} />
          <span className={src.cls}>{src.text}</span>
        </span>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <p className="font-display text-3xl font-medium tracking-tight tabular-nums text-foreground">
          {formatPrice(data.price, data.expo, 4)}
        </p>
        {!compact && (
          <p className="mb-1 text-xs text-muted-foreground tabular-nums">
            conf ±{(confPct)}% · {relTime(data.publishTime)}
          </p>
        )}
      </div>

      {!compact && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground tabular-nums sm:grid-cols-3">
          <div className="flex justify-between gap-2">
            <dt>Publish</dt>
            <dd className="font-mono text-foreground">{new Date(data.publishTime * 1000).toLocaleTimeString()}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Confidence</dt>
            <dd className="font-mono text-foreground">{confToBps(BigInt(data.price), BigInt(data.conf))} bps</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Staleness</dt>
            <dd className="font-mono text-foreground">{data.ageSec}s / {data.stalenessLimitSec}s</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Exponent</dt>
            <dd className="font-mono text-foreground">{data.expo}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:col-span-2">
            <dt>Feed</dt>
            <dd className="truncate font-mono text-foreground">{data.feedId}</dd>
          </div>
        </dl>
      )}

      {offline && (
        <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
          Hermes returns a live VAA only with an API key. The contract maths
          still run against this documented fallback price. Set a key at deploy
          to settle at the live rate.
        </p>
      )}
    </div>
  );
}
