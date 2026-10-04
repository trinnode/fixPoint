import Link from "next/link";
import { ArrowRight, Compass, FilePlus2, History, Home } from "lucide-react";
import { Hero3D } from "@/components/fx/hero-3d";
import { ChainRibbon } from "@/components/fx/chain-ribbon";
import fx from "@/components/fx/fx.module.css";

export const metadata = {
  title: "Not found",
  description:
    "The page you asked for does not exist on Fixpoint. Head back to safety.",
};

const routes = [
  {
    href: "/",
    title: "Home",
    body: "The four step flow, the live price and the demo invoice.",
    icon: Home,
  },
  {
    href: "/invoices/new",
    title: "Create an invoice",
    body: "Price in dollars as the seller and share the link.",
    icon: FilePlus2,
  },
  {
    href: "/history",
    title: "History",
    body: "Chain events beside their HCS audit messages.",
    icon: History,
  },
];

export default function NotFound() {
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <Hero3D
          className="rounded-2xl border border-border sm:rounded-3xl"
          side={
            <div className={fx.panel}>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--fx-muted)]">
                Where to instead
              </p>
              <ul className="mt-3 space-y-2">
                {routes.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)]"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--fx-accent)]">
                        <r.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-[var(--fx-ink)] group-hover:underline">
                          {r.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fx-muted)]">
                          {r.body}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          }
        >
          <div className="space-y-6">
            <span className={fx.eyebrow}>
              <Compass className="h-3.5 w-3.5 text-[var(--fx-accent)]" />
              404 · Off the ledger
            </span>
            <p
              aria-hidden="true"
              className="font-display text-[7rem] font-semibold leading-none tracking-tight text-[var(--fx-ink)] tabular-nums sm:text-[10rem]"
            >
              404
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--fx-ink)] text-balance sm:text-4xl">
              This page drifted off the hashgraph.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[var(--fx-muted)] sm:text-lg">
              The address you asked for holds nothing. No invoice lives here
              and no audit message was ever written for it. Pick a known route
              and carry on.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back home
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/history" className={fx.ctaAlt}>
                View history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Hero3D>
      </div>
      <div className="mt-6">
        <ChainRibbon />
      </div>
    </div>
  );
}
