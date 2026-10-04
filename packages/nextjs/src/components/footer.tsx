import Link from "next/link";
import { CONTRACT_ADDR, HCS_TOPIC_ID, RECEIPT_TOKEN_ID } from "@/lib/hedera";

const EXPLORER_ROOT = "https://hashscan.io/testnet";
const HERMES_URL = "https://hermes.pyth.network";
const FAUCET_URL = "https://faucet.hedera.com";
const MIRROR_URL = "https://testnet.mirrornode.hedera.com";

const columns = [
  {
    title: "Template",
    links: [
      { label: "Home", href: "/" },
      { label: "Create an invoice", href: "/invoices/new" },
      { label: "History", href: "/history" },
    ],
  },
  {
    title: "Flow",
    links: [
      { label: "Invoice details", href: "/invoices/new" },
      { label: "Pay at rate", href: "/history" },
      { label: "Settle and prove", href: "/history" },
    ],
  },
  {
    title: "Verify",
    links: [
      { label: "Open the history", href: "/history" },
      { label: "Escrow contract on Hashscan", href: `${EXPLORER_ROOT}/contract/${CONTRACT_ADDR}` },
      { label: "Pyth Hermes", href: HERMES_URL },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Hashscan testnet", href: EXPLORER_ROOT },
      { label: "Hedera faucet", href: FAUCET_URL },
      { label: "Mirror node", href: MIRROR_URL },
    ],
  },
];

function isExternal(href: string): boolean {
  return href.startsWith("http");
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-2">
            <p className="font-display text-lg font-semibold tracking-tight">Fixpoint</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Price in dollars. Settle in HBAR. Prove it on HCS.
            </p>
            <dl className="space-y-1 pt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
              <div className="flex gap-2">
                <dt className="sr-only">Contract</dt>
                <dd className="truncate">{CONTRACT_ADDR}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Receipt token</dt>
                <dd>{RECEIPT_TOKEN_ID}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Audit topic</dt>
                <dd>{HCS_TOPIC_ID}</dd>
              </div>
            </dl>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2 text-xs">
                {col.links.map((l) => (
                  <li key={l.label + l.href}>
                    {isExternal(l.href) ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-8 border-t border-border/70 pt-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The contract address, token id and topic id shown here are demo
            constants, not a real deployment. The chain events are the source
            of truth and the HCS topic is the audit log.
          </p>
        </div>
      </div>
    </footer>
  );
}
