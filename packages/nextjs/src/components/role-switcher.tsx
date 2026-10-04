"use client";

import { useAppStore } from "@/lib/store";
import { actorAddress, shortAddr } from "@/lib/hedera";
import { cn } from "@/lib/utils";

const roles = [
  { key: "seller", label: "Seller" },
  { key: "buyer", label: "Buyer" },
] as const;

export function RoleSwitcher() {
  const actor = useAppStore((s) => s.actor);
  const setActor = useAppStore((s) => s.setActor);
  const address = actorAddress(actor);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setActor(r.key)}
            aria-pressed={actor === r.key}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              actor === r.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
        {shortAddr(address)}
      </span>
    </div>
  );
}
