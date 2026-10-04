import Link from "next/link";
import { HCS_TOPIC_ID, CONTRACT_ADDR, RECEIPT_TOKEN_ID, EXPLORER_URL } from "@/lib/hedera";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="font-display text-base font-medium">Fixpoint</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Price in dollars. Settle in HBAR. Prove it on HCS. A scaffold-hbar
              external template.
            </p>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-foreground">Deployed objects</p>
            <dl className="space-y-1 text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Contract</dt>
                <dd className="font-mono truncate">{CONTRACT_ADDR.slice(0, 10)}…{CONTRACT_ADDR.slice(-4)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Receipt token</dt>
                <dd className="font-mono">{RECEIPT_TOKEN_ID}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Audit topic</dt>
                <dd className="font-mono">{HCS_TOPIC_ID}</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-foreground">Built with</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>Pyth Hermes price oracle</li>
              <li>Hedera HTS NFT receipts</li>
              <li>Hedera Consensus Service audit log</li>
            </ul>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-foreground">Explore</p>
            <ul className="space-y-1">
              <li>
                <Link href="/history" className="text-muted-foreground underline-offset-2 hover:underline">
                  Mirror node history
                </Link>
              </li>
              <li>
                <Link href="/invoices/new" className="text-muted-foreground underline-offset-2 hover:underline">
                  Create an invoice
                </Link>
              </li>
              <li>
                <a
                  href={EXPLORER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline-offset-2 hover:underline"
                >
                  Hashscan ↗
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-6 border-t border-border/70 pt-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The chain events are the source of truth. The HCS topic is an ordered,
            timestamped audit log, not a database. The relayer verifies each
            transaction on the mirror node before it publishes. On chain
            interactions in this preview are simulated against the live Pyth
            rate, not signed by a real testnet key.
          </p>
        </div>
      </div>
    </footer>
  );
}
