"use client";

import { shortAddr } from "@/lib/hedera";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

export function AddressChip({
  address,
  label,
  className,
}: {
  address: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!address) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-mono text-xs tabular-nums text-foreground">
        {shortAddr(address)}
      </span>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <CopyButton value={address} label="address" />
    </span>
  );
}
