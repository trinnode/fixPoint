import type { InvoiceState } from "@/lib/invoices";
import { cn } from "@/lib/utils";
import styles from "./fx.module.css";

const META: Record<InvoiceState, { label: string; detail: string }> = {
  CREATED: { label: "Created", detail: "Awaiting buyer payment" },
  PAID: { label: "Paid", detail: "Funds held in escrow" },
  RELEASED: { label: "Released", detail: "Funds sent to the seller" },
  REFUNDED: { label: "Refunded", detail: "Funds returned to the buyer" },
  EXPIRED: { label: "Expired", detail: "Pay by date passed unpaid" },
};

const ORB: Record<InvoiceState, string> = {
  CREATED: styles.orbCreated,
  PAID: styles.orbPaid,
  RELEASED: styles.orbReleased,
  REFUNDED: styles.orbRefunded,
  EXPIRED: styles.orbExpired,
};

type StateOrbProps = {
  state: InvoiceState;
  className?: string;
};

/**
 * Canvas-free CSS 3D orb reflecting invoice state colour, with legend text.
 */
export function StateOrb({ state, className }: StateOrbProps) {
  const m = META[state];
  return (
    <div className={cn(styles.orbWrap, className)}>
      <div className={styles.orbScene} aria-hidden="true">
        <div className={cn(styles.orb, ORB[state])} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{m.label}</p>
        <p className="text-xs text-muted-foreground">{m.detail}</p>
      </div>
    </div>
  );
}
