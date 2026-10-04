import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PriceCard } from "@/components/price-card";
import { Hero3D } from "@/components/fx/hero-3d";
import { ChainRibbon } from "@/components/fx/chain-ribbon";
import { Reveal } from "@/components/fx/reveal";
import { CountUp } from "@/components/fx/count-up";
import {
  AgreementLine,
  AgreementVisual,
  MiniQuoteVisual,
  MiniStatesVisual,
  PaidOrbVisual,
} from "@/components/fx/home-visuals";
import fx from "@/components/fx/fx.module.css";
import { listInvoices } from "@/lib/invoices";

const metrics = [
  { value: 3, label: "services composed" },
  { value: 60, label: "second staleness bound" },
  { value: 100, label: "bps confidence bound" },
  { value: 43, label: "contract tests" },
];

const problems = [
  {
    title: "The rate moves before you get paid",
    body: "You quote 500 dollars on Monday. By Friday the HBAR amount buys something else. Someone eats the difference.",
  },
  {
    title: "Screenshots are not receipts",
    body: "A chat log proves nothing. The buyer needs a receipt that lives in their wallet, not in your inbox.",
  },
  {
    title: "Nobody can audit the story later",
    body: "When money and memory disagree, memory loses. Every state change should be written where it cannot be edited.",
  },
];

const fixes = [
  {
    n: "01",
    title: "Create the invoice",
    body: "Seller sets dollars, a pay by date and a review window. The contract stores it and emits the event.",
  },
  {
    n: "02",
    title: "Pay the live rate",
    body: "Buyer pays HBAR at the Pyth rate. Stale or loose prices are rejected. The held amount rounds up for the seller.",
  },
  {
    n: "03",
    title: "Mint the receipt",
    body: "The contract mints an HTS NFT receipt to the buyer wallet. Metadata is a compact reference, never JSON.",
  },
  {
    n: "04",
    title: "Settle and prove",
    body: "Buyer releases, or seller claims after review. Every transition lands on the HCS audit topic.",
  },
];

const powers = [
  {
    title: "Pyth quotes, not guesses",
    visual: <MiniQuoteVisual />,
    tags: ["Staleness bound", "Confidence bound", "Round up"],
  },
  {
    title: "Receipts you can prove",
    visual: <PaidOrbVisual />,
    tags: ["HTS NFT", "Wallet held", "100 byte meta"],
  },
  {
    title: "An audit trail that agrees",
    visual: <AgreementVisual />,
    tags: ["HCS topic", "Mirror verified", "Idempotent"],
  },
  {
    title: "Escrow states that hold",
    visual: <MiniStatesVisual />,
    tags: ["No owner", "No withdraw", "Reentrancy guarded"],
  },
];

const steps = [
  {
    n: "1",
    title: "Invoice it",
    body: "60 second form, dollars, dates, memo.",
  },
  {
    n: "2",
    title: "Pay the rate",
    body: "Connect the buyer role, associate once, pay the live quote.",
  },
  {
    n: "3",
    title: "Settle and prove",
    body: "Release, claim, or refund. Watch the audit write itself.",
  },
];

const faqs = [
  {
    q: "Do I need a wallet to try it",
    a: "No. The demo ledger runs the full flow with no wallet. Connect one when you deploy for real.",
  },
  {
    q: "Where does the money sit",
    a: "In the escrow contract from pay to settle. Never with us. There is no owner withdraw.",
  },
  {
    q: "What if the price feed lags",
    a: "Any price older than 60 seconds is rejected, and wide confidence is rejected too. The buyer retries on a fresh quote.",
  },
  {
    q: "What does the buyer get",
    a: "An HTS NFT receipt in their wallet plus a full audit trail they can verify.",
  },
  {
    q: "Is this audited",
    a: "No. It is a tested starting point with 43 contract tests and a written threat model. Audit before mainnet value.",
  },
];

export default async function Home() {
  const invoices = await listInvoices().catch(() => []);
  const demo = invoices.find((i) => i.state === "CREATED");
  const created = invoices.filter((i) => i.state === "CREATED").length;
  const paid = invoices.filter((i) => i.state === "PAID").length;
  const released = invoices.filter((i) => i.state === "RELEASED").length;
  const refunded = invoices.filter((i) => i.state === "REFUNDED").length;
  const empty = invoices.length === 0;

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <Hero3D
          className="rounded-2xl border border-border sm:rounded-3xl"
          side={<PriceCard />}
        >
          <div className="space-y-6">
            <span className={fx.eyebrow}>
              <span className="lum-dot" aria-hidden="true" />
              Live on Hedera Testnet
            </span>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--fx-ink)] text-balance sm:text-5xl lg:text-6xl">
              Price in dollars.
              <br />
              Settle in HBAR.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[var(--fx-muted)] sm:text-lg">
              The escrow template for teams that price in dollars and get paid
              in crypto. Lock the rate at payment time with Pyth, hold funds on
              chain, mint the receipt, prove everything on HCS.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Create an invoice
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={demo ? `/invoices/${demo.id}` : "/history"}
                className={fx.ctaAlt}
              >
                See a live invoice
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Hero3D>
      </div>
      <div className="mt-6">
        <ChainRibbon />
      </div>

      <section aria-label="Key bounds" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((m) => (
            <Reveal key={m.label} className="h-full">
              <div className="h-full rounded-2xl border border-border bg-card p-5">
                <p className="font-display text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                  <CountUp to={m.value} />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
              </div>
            </Reveal>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            The problem
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Volatile prices kill fixed quotes.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <article className="h-full rounded-2xl border border-border bg-card p-6">
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  0{i + 1}
                </p>
                <h3 className="font-display mt-3 text-xl font-semibold tracking-tight text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              The fix
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Four steps from cents to settled.
            </h2>
          </Reveal>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {fixes.map((f, i) => (
              <Reveal key={f.n} delay={i * 90} className="h-full">
                <li className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                  <span className="font-display text-sm font-semibold tabular-nums text-primary">
                    {f.n}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-8">
            <Link
              href={demo ? `/invoices/${demo.id}` : "/history"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start with the demo invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            What it does
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            One template, four superpowers.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {powers.map((p, i) => (
            <Reveal key={p.title} delay={(i % 2) * 90}>
              <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                  {p.title}
                </h3>
                <div className="mt-4">{p.visual}</div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-label="Live proof" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Live proof
            </p>
            {empty ? (
              <div className="mt-3">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                  The ledger is empty.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  No invoices exist yet, so there is nothing to count and no
                  audit rows to compare. Run the seed script to load four demo
                  invoices, then refresh to see real numbers here.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
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
                    Open the history
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "created", value: created },
                    { label: "paid", value: paid },
                    { label: "released", value: released },
                    { label: "refunded", value: refunded },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-secondary/50 p-4">
                      <dt className="sr-only">{s.label}</dt>
                      <dd className="font-display text-3xl font-semibold tabular-nums text-foreground">
                        {s.value}
                      </dd>
                      <p aria-hidden="true" className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <AgreementLine />
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </section>

      <section className="border-t border-border/70 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              How it works
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              From kickoff to settled in one sitting.
            </h2>
          </Reveal>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <li className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6">
                  <span
                    aria-hidden="true"
                    className="font-display pointer-events-none absolute right-4 top-2 text-6xl font-semibold tabular-nums text-muted/60"
                  >
                    {s.n}
                  </span>
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            FAQ
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Asked before you ask.
          </h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <Reveal key={f.q}>
              <details className="lum-faq">
                <summary>{f.q}</summary>
                <p className="lum-faq-body">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-center sm:rounded-3xl sm:px-12 sm:py-16">
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance text-primary-foreground sm:text-4xl">
              Ready to stop repricing every invoice.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
              Price in dollars, settle at the live rate, keep a receipt and an
              audit trail to prove it.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-foreground px-5 py-3 text-sm font-semibold text-primary transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                Create your first invoice
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/history"
                className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/40 px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
              >
                Read the pattern
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
