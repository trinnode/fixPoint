import { cn } from "@/lib/utils";
import type { InvoiceState } from "@/lib/invoices";

const map: Record<InvoiceState, { label: string; cls: string; dot: string }> = {
  CREATED: { label: "Awaiting payment", cls: "text-warning-foreground bg-warning/25 border-warning/40", dot: "bg-warning" },
  PAID: { label: "In escrow", cls: "text-foreground bg-secondary border-border", dot: "bg-primary" },
  RELEASED: { label: "Released", cls: "text-success-foreground bg-success/15 border-success/40", dot: "bg-success" },
  REFUNDED: { label: "Refunded", cls: "text-foreground bg-secondary border-border", dot: "bg-muted-foreground" },
  EXPIRED: { label: "Expired", cls: "text-muted-foreground bg-muted border-border", dot: "bg-muted-foreground" },
};

export function StateBadge({ state, className }: { state: InvoiceState; className?: string }) {
  const s = map[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        s.cls,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
