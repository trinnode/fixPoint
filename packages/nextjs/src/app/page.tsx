import Link from "next/link";
import { ArrowRight, FileText, Landmark, Receipt, ShieldCheck, Coins, ListChecks } from "lucide-react";
import { PriceCard } from "@/components/price-card";
import { Hero3D } from "@/components/fx/hero-3d";
import { ChainRibbon } from "@/components/fx/chain-ribbon";
import fx from "@/components/fx/fx.module.css";
import { listInvoices } from "@/lib/invoices";
import { CHAIN_NAME, CONTRACT_ADDR, HCS_TOPIC_ID, RECEIPT_TOKEN_ID, shortAddr } from "@/lib/hedera";

const steps = [
  {
    n: "01",
    title: "Create an invoice",
    body: "A seller sets a price in dollars, a pay-by date and a review window. The contract stores it and emits an event.",
    icon: FileText,
  },
  {
    n: "02",
    title: "Pay at the live rate",
    body: "The buyer fetches a fresh Pyth update and pays HBAR. Stale or loose prices are rejected. The held amount is rounded up in favour of the seller.",
    icon: Landmark,
  },
  {
    n: "03",
    title: "Mint a receipt",
    body: "The contract mints an HTS NFT receipt to the buyer through the system contract. Metadata is a 100 byte reference, never JSON.",
    icon: Receipt,
  },
  {
    n: "04",
    title: "Settle and audit",
    body: "The buyer releases the funds, or the seller claims after the review window. Every transition is written to an HCS audit topic.",
    icon: ShieldCheck,
  },
];

export default async function Home() {
  const invoices = await listInvoices().catch(() => []);
  const demo = invoices.find((i) => i.state === "CREATED");

  return (
    <div>
      <Hero3D
        side={
          <div className="space-y-3">
            <PriceCard />
            <div className={fx.panel}>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--fx-muted)]">
                Deployed objects
              </p>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--fx-muted)]">Escrow contract</dt>
                  <dd className="font-mono text-[var(--fx-ink)]">{shortAddr(CONTRACT_ADDR)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--fx-muted)]">Receipt token</dt>
                  <dd className="font-mono text-[var(--fx-ink)]">{RECEIPT_TOKEN_ID}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--fx-muted)]">Audit topic</dt>
                  <dd className="font-mono text-[var(--fx-ink)]">{HCS_TOPIC_ID}</dd>
                </div>
              </dl>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <span className={fx.eyebrow}>
            <Coins className="h-3.5 w-3.5 text-[var(--fx-accent)]" />
            scaffold-hbar external template
          </span>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-[var(--fx-ink)] text-balance sm:text-5xl lg:text-6xl">
            Price in dollars.
            <br />
            Settle in HBAR.
            <br />
            <span className="text-[var(--fx-accent)]">Prove it on HCS.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--fx-muted)] sm:text-lg">
            Fixpoint is a USD priced escrow on Hedera. A seller invoices in
            cents, a buyer pays HBAR at a live Pyth oracle rate, and an HTS
            NFT receipt is minted to the buyer. Every state change is written
            to an HCS audit topic and rebuilt from a mirror node.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create an invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
            {demo ? (
              <Link
                href={`/invoices/${demo.id}`}
                className={fx.ctaAlt}
              >
                Pay the demo invoice
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/history"
                className={fx.ctaAlt}
              >
                View history
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-2 pt-2 text-xs text-[var(--fx-muted)]">
            <div>
              <dt className="font-medium text-[var(--fx-ink)]">Network</dt>
              <dd>{CHAIN_NAME}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--fx-ink)]">Services</dt>
              <dd>EVM · HTS · HCS</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--fx-ink)]">Oracle</dt>
              <dd>Pyth Hermes</dd>
            </div>
          </dl>
        </div>
      </Hero3D>
      <ChainRibbon />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Four steps from cents to a settled receipt
            </h2>
          </div>
          <Link
            href="/history"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
          >
            See it on the ledger <ListChecks className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-medium text-muted-foreground tabular-nums">{s.n}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                  <s.icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/70 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Honest by design
              </p>
              <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground">
                The chain is the source of truth
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                HCS cannot be written from a smart contract. A relayer route
                verifies each transaction on the mirror node, then publishes a
                signed, compact, versioned audit message to the topic. The app
                reads state from the contract and mirror node and uses HCS for
                the tamper evident history.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "No database in the template",
                  body: "History is rebuilt from mirror node contract logs. This preview persists the same facts so the demo is reproducible without a live network.",
                },
                {
                  title: "The relayer is not trusted for funds",
                  body: "It only submits HCS audit messages after verifying the on chain event. It never holds escrow value.",
                },
                {
                  title: "Price safety, not just price",
                  body: "Staleness and confidence bounds reject old or loose feeds. The held amount rounds up in favour of the seller and is tested.",
                },
                {
                  title: "A receipt you can prove",
                  body: "The HTS NFT receipt is minted by the contract and lives in the buyer wallet. It is the durable proof of payment.",
                },
              ].map((c) => (
                <div key={c.title} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">{c.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-medium tracking-tight text-foreground">
                Try the whole flow now
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an invoice as the seller, switch to the buyer, associate
                the receipt token and pay at the live Pyth rate.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create an invoice <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/history"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Open the history view
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
