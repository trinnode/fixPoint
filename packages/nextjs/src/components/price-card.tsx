"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type PriceInfo } from "@/lib/api";
import { formatPrice, confBps as confToBps, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const sourceLabel: Record<PriceInfo["source"], { text: string; live: boolean }> = {
  hermes: { text: "Hermes live", live: true },
  cached: { text: "Cached", live: false },
  seed: { text: "Labelled seed", live: false },
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
      <div className={cn("rounded-xl border border-white/15 bg-white/5 p-5", className)}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
          Oracle live
        </p>
        <p className="mt-3 text-sm font-medium text-white">Price unavailable</p>
        <p className="mt-1 text-xs leading-relaxed text-white/60">
          The Pyth Hermes API could not be reached. Retrying shortly.
        </p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className={cn("rounded-xl border border-white/15 bg-white/5 p-5", className)}>
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-12 w-44 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  const src = sourceLabel[data.source];
  const stale = data.stale;
  const bps = confToBps(BigInt(data.price), BigInt(data.conf));
  const withinConf = data.confBps <= data.confBpsLimit;
  const healthy = !stale && withinConf;

  return (
    <div className={cn("rounded-xl border border-white/15 bg-white/5 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
          Oracle live
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white">
          <span className="lum-dot" aria-hidden="true" />
          {src.text}
        </span>
      </div>

      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
        HBAR USD
      </p>
      <p className="font-display mt-1 text-5xl font-semibold tracking-tight tabular-nums text-white">
        {formatPrice(data.price, data.expo, 4)}
      </p>
      <p className="mt-2 text-xs tabular-nums text-white/60">
        Published {relTime(data.publishTime)}
      </p>

      {!compact && (
        <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
          <li className="flex items-center justify-between gap-3">
            <span className="text-white/60">Staleness</span>
            <span className={cn("font-mono tabular-nums", stale ? "text-amber-200" : "text-white")}>
              {stale ? "Stale" : "Fresh"} {data.ageSec}s, bound {data.stalenessLimitSec}s
            </span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-white/60">Confidence</span>
            <span className={cn("font-mono tabular-nums", withinConf ? "text-white" : "text-amber-200")}>
              {bps} bps, bound {data.confBpsLimit} bps
            </span>
          </li>
        </ul>
      )}

      <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/60">
        {healthy
          ? "Price is fresh and inside the confidence bound, ready to settle."
          : "Price is outside the safety bounds, the buyer retries on a fresh quote."}
      </p>

      {data.source === "seed" && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          Hermes returns a live price only with an API key. The contract maths
          still run against this documented fallback. Set a key at deploy to
          settle at the live rate.
        </p>
      )}
    </div>
  );
}
