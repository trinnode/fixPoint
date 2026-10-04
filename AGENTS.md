# AGENTS

This file is for an AI agent working in this repository. Read it before changing anything. It tells you what each area owns, which invariants you must not break, and what proves a change is safe.

## Repo map

```
src/lib/         owns the rules. No UI, no HTTP here.
  hedera.ts      deployed object ids, units, safety constants
  pyth.ts        Hermes client and the pricing maths (load bearing)
  invoices.ts    the escrow state machine, the audit publish
  format.ts      unit conversions for the UI
  errors.ts      typed EscrowError codes that mirror the contract
  kv.ts          counters and the association flag
  db.ts          Prisma client
  api.ts         typed client used by the React side
  store.ts       Zustand actor (seller / buyer)

src/app/api/    owns HTTP. Thin. It validates input, calls lib, returns JSON.
  price, quote          read the oracle
  association           get or set the buyer association flag
  invoices              list, create
  invoices/[id]         get
  invoices/[id]/pay     pay (calls the pricing maths, mints the receipt)
  invoices/[id]/release release held funds to the seller
  invoices/[id]/claim   seller claims after the review window
  invoices/[id]/refund  seller voluntarily refunds the buyer
  invoices/[id]/claim-refund   buyer reclaims after a missed delivery
  invoices/[id]/expire  expire an unpaid invoice
  audit                 publish an HCS audit message for a tx hash (idempotent)
  history               join chain events with audit messages

src/app/        owns pages.
  page.tsx             home: hero, live price, the four step flow, honesty note
  invoices/new        create form with a live quote breakdown
  invoices/[id]       detail: timeline, settlement, receipt, actions, audit
  history             mirror node table and HCS tab with agreement markers

src/components/ owns the UI surface. State-badge, hash-badge, price-card,
                 quote-breakdown, state-timeline, invoice-actions and so on.

scripts/seed.ts owns the demo data. Idempotent. Seeds four invoices and their
                 audit messages. Run it after `bun run db:push`.

prisma/schema.prisma owns the local data model. It is a faithful simulation
                 of the on chain state. The real template has no database.
```

## Commands

```
bun install
bun run db:push
bun run scripts/seed.ts
bun run dev
bun run lint
```

`db:push` runs `prisma db push --accept-data-loss`. That is fine for this preview. Do not run it against a real database. `lint` runs `eslint .` and is the only static check. There are no automated unit tests in this preview.

## Invariants you must not break

These are the rules the contract enforces. The simulation must enforce them too.

- **No owner withdraw.** There is no path that lets a deployer or relayer operator pull held funds. Held funds only ever move to the seller (release, claim after review) or back to the buyer (refund, claim refund). Do not add a withdraw route.
- **Rounding direction.** The HBAR amount is rounded up in favour of the seller. The maths is `hbarWei = ceil(usdCents * 10^18 / (100 * price * 10^expo))`. Never round down. Never round to nearest. See `src/lib/pyth.ts`.
- **Staleness limit.** A price older than 60 seconds is rejected. The constant is `MAX_STALENESS_SEC` in `src/lib/hedera.ts`. Do not relax it without a written reason.
- **Confidence limit.** A confidence wider than 100 basis points is rejected. The constant is `MAX_CONF_BPS` in `src/lib/hedera.ts`. Do not relax it without a written reason.
- **HTS association required before mint.** A buyer cannot pay until they have associated the receipt token. The check is in `payInvoice` in `src/lib/invoices.ts` and reads the `buyer_associated` flag. Do not remove it.
- **HCS idempotency by tx hash.** `publishAudit` is idempotent by tx hash. A second publish for the same hash returns the existing sequence number and writes nothing. The unique constraint is on `AuditMessage.txHash` in `prisma/schema.prisma`. Keep it.
- **The audit payload stays versioned and compact.** The payload has a `v` field, currently `1`. It carries `type`, `invoiceRef`, `invoiceId`, `state`, `from`, `to`, `amountWei`, `txHash`, `blockTs`. Nothing else. Do not add fields without bumping `v`. The HTS metadata limit is 100 bytes; the HCS message should stay small and parseable.

## Safe and unsafe extension points

**Safe to change:**

- The price feed. Point `HBAR_QUERY` and the feed match in `resolveFeedId()` in `src/lib/pyth.ts` at a different Pyth feed.
- Escrow rules that do not touch the pricing maths. New settle paths (a new `settle` kind) go in `src/lib/invoices.ts` and a new route under `src/app/api/invoices/[id]/`.
- The UI. Pages and components can be reshaped as long as the typed API in `src/lib/api.ts` is respected.

**Unsafe to change without a written reason:**

- The pricing maths in `src/lib/pyth.ts`. `computeQuote` mirrors the contract. If you touch it, the contract must change in lockstep.
- The audit payload shape in `publishAudit`. It is versioned and compact for a reason. Adding a field is a schema migration on HCS.
- The safety constants in `src/lib/hedera.ts`. They are mirrored in the contract.

## Rules

- Never commit secrets or a `.env` file. The committed `.env.example` has empty values only.
- Verify addresses and feed ids before relying on them. The committed ids in `src/lib/hedera.ts` (contract `0xC2a7B4Ecf4E0f3C5c67a89B1c0dE2f3A4b5C6d7E`, receipt token `0.0.5847293`, topic `0.0.5847294`) are demo constants. They are not a real deployment.
- Never present the offline seed price as a live Pyth price. The `source` field on a `PriceSnapshot` is `hermes`, `cached`, or `seed`. The UI must show it. Do not hide it.
- The relayer only audits. It never holds funds. A relayer route that moves value is a design error.
- When you change the state machine, walk the manual verification list in `README.md` before you say the change is done.

## How to run and what proves success

```
bun run dev
```

Then open the **Preview Panel** in the workspace. The app listens on port 3000; the preview is the supported entry point.

What proves success:

1. The home page loads with a live price card. The card shows the price source. With `PYTH_HERMES_KEY` unset the source reads `seed` and is labelled as such.
2. Create an invoice as the seller on `/invoices/new`. The live quote breakdown updates as you change the amount.
3. Switch to the buyer role. Open the invoice. Associate the receipt token. Pay. The invoice moves to PAID and a receipt serial is minted.
4. Switch back to the seller. Release. The invoice moves to RELEASED.
5. Open `/history`. The mirror node tab shows every chain event. The HCS tab shows every audit message. Rows where the chain event and the audit message agree are marked with a check and the audit sequence number. The counts at the top of the page should agree or differ by exactly the events you have not yet audited.
