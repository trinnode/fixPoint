# AGENTS

This file is for an AI agent working in this repository. Read it before changing anything. It tells you what each area owns, which invariants you must not break, and what proves a change is safe.

## Repo map

```
package.json             npm workspaces root. Scripts here delegate to packages.
template.json            scaffold manifest. Capabilities, defaults, outro, env vars.
README.md
AGENTS.md                this file
SECURITY.md
LICENSE                  MIT
.env.example             empty values only. Never commit a filled env file.
.github/workflows/ci.yml install, compile, test, lint, types, build, plus a boot smoke test
packages/
  hardhat/               owns the chain. Solidity, deploy, testnet scripts.
    contracts/
      FixpointEscrow.sol the escrow state machine and the pricing maths
      interfaces/        IHederaTokenService, IPyth, verified against docs
      mocks/             MockHts, MockPyth, ReentrancyAttacker for unit tests
    scripts/
      deploy.ts          deploy, create HTS collection, set receipt token
      create-demo-transaction.ts  full flow on testnet, prints Hashscan links
    test/
      FixpointEscrow.test.ts  43 tests
    deployed/            addresses written by deploy. No secrets ever.
  nextjs/                owns the app. Pages, API routes, demo ledger.
    src/
      app/               home, invoices/new, invoices/[id], history, not found
      app/api/           price, quote, association, invoices and subroutes, audit, history
      lib/
        hedera.ts        chain config, object ids, units, safety constants
        pyth.ts          Hermes client and the pricing maths, mirrors the contract
        invoices.ts      demo ledger state machine, mirrors the contract
        format.ts        unit conversions for the UI
        errors.ts        typed EscrowError codes that mirror the contract
        kv.ts            counters and the association flag
        db.ts            Prisma client
        api.ts           typed client used by React components
        store.ts         role store for seller and buyer
      components/
        fx/              3D hero scene, chain ribbon, state orb, reveal, count up
    prisma/schema.prisma demo ledger only. There is no database in the deployed template.
    scripts/seed.ts      idempotent seed of four demo invoices and audit messages
docs/
  architecture.md
  testnet-evidence.md
  threat-model.md
```

## Commands

All from the repo root. npm only. Never bun.

```
npm install
npm run hardhat:compile
npm test
npm run lint
npm run check-types
npm run build
```

Demo ledger, from the root. The app reads `packages/nextjs/.env`. The Hardhat scripts read `packages/hardhat/.env`. Copy `.env.example` to both.

```
cp .env.example packages/nextjs/.env
cp .env.example packages/hardhat/.env
npm run db:push
npm run db:seed
npm run dev
```

`db:push` runs a plain `prisma db push` against `DATABASE_URL`. The schema targets Postgres. Use the direct (non pooling) URL for push and seed, and the pooled URL at runtime on Vercel. `lint` runs ESLint on the frontend and `tsc --noEmit` on the contracts. `check-types` typechecks the frontend. There are 43 Hardhat unit tests and no frontend unit tests yet. The build passes with an empty environment.

## Invariants you must not break

These are the rules the contract enforces. The demo ledger must enforce them too.

- **No owner withdraw.** There is no path that lets a deployer or relayer operator pull held funds. Held funds only ever move to the seller (release, claim after review) or back to the buyer (refund, claim refund). Do not add a withdraw route.
- **Rounding direction.** The HBAR amount is rounded up in favour of the seller. The maths is `hbarWei = ceil(usdCents * 10^18 / (100 * price * 10^expo))`. Never round down. Never round to nearest. See `packages/hardhat/contracts/FixpointEscrow.sol` and `packages/nextjs/src/lib/pyth.ts`. Change both in lockstep or change neither.
- **Staleness limit.** A price older than 60 seconds is rejected. The constant is `MAX_STALENESS_SEC` in the contract and in `packages/nextjs/src/lib/hedera.ts`. Do not relax it without a written reason.
- **Confidence limit.** A confidence wider than 100 basis points is rejected. The constant is `MAX_CONF_BPS` in the contract and in `packages/nextjs/src/lib/hedera.ts`. Do not relax it without a written reason.
- **HTS association required before mint.** A buyer cannot pay until associated with the receipt token. The check is in `pay` in the contract and in `payInvoice` in `packages/nextjs/src/lib/invoices.ts`. Do not remove it.
- **HCS idempotency by tx hash.** The audit publish is idempotent by tx hash. A second publish for the same hash returns the existing sequence number and writes nothing. On the demo ledger the unique constraint is on `AuditMessage.txHash` in `packages/nextjs/prisma/schema.prisma`. Keep it.
- **The audit payload stays versioned and compact.** The payload has a `v` field, currently `1`. It carries `type`, `invoiceRef`, `invoiceId`, `state`, `from`, `to`, `amountWei`, `txHash`, `blockTs`. Nothing else. Do not add fields without bumping `v`. The HTS metadata limit is 100 bytes. The HCS message should stay small and parseable.

## Safe and unsafe extension points

**Safe to change:**

- The price feed. Point `HBAR_QUERY` and the feed match in `resolveFeedId()` in `packages/nextjs/src/lib/pyth.ts` at a different Pyth feed, and pass the new feed id as `PRICE_FEED_ID` at deploy.
- Escrow rules that do not touch the pricing maths. New settle paths add a `SettleKind` in `packages/nextjs/src/lib/invoices.ts`, a contract function with an event, and a route under `packages/nextjs/src/app/api/invoices/[id]/`.
- The UI. Pages and components can be reshaped as long as the typed API in `packages/nextjs/src/lib/api.ts` is respected and every route still renders with an empty environment.

**Unsafe to change without a written reason:**

- The pricing maths in `FixpointEscrow.sol` and `packages/nextjs/src/lib/pyth.ts`. `computeQuote` mirrors the contract. If you touch one, the other must change in lockstep, plus the tests on both sides.
- The audit payload shape in the audit publish path. It is versioned and compact for a reason. Adding a field is a schema migration on HCS.
- The safety constants. They are mirrored in the contract and the frontend.
- Anything that moves value through the relayer. The relayer only audits. A relayer route that moves value is a design error.

## Rules

- Never commit secrets or a filled `.env` file. The committed `.env.example` files have empty values only. History must stay clean: no env file in any commit.
- Verify addresses and feed ids before relying on them. The committed ids in `packages/nextjs/src/lib/hedera.ts` are demo constants. They are not a real deployment. The Pyth testnet receiver default lives in the deploy script and is documented in `packages/hardhat/README.md`.
- Never present the offline seed price as a live Pyth price. The `source` field on a price snapshot is `hermes`, `cached`, or `seed`. The UI must show it. Do not hide it.
- Never use Atomic Batch Transactions with smart contract calls. That pattern is deprecated with removal planned March 2027.
- No new npm dependencies for UI effects. Animate with CSS, IntersectionObserver and requestAnimationFrame. `framer-motion` is deliberately not installed.
- User facing prose uses no hyphens or dashes. Use commas and colons instead. This applies to pages, components, README, AGENTS, SECURITY and docs.
- When you change the state machine or the pricing maths, walk the manual verification list in `README.md` before you say the change is done.

## How to run and what proves success

```
npm run dev
```

Then open `http://localhost:3000`.

What proves success:

1. The home page loads with a live price card. The card shows the price source. With `PYTH_HERMES_KEY` unset the source reads `seed` and is labelled as such.
2. Create an invoice as the seller on `/invoices/new`. The live quote breakdown updates as you change the amount.
3. Switch to the buyer role. Open the invoice. Associate the receipt token. Pay. The invoice moves to PAID and a receipt serial is minted.
4. Switch back to the seller. Release. The invoice moves to RELEASED.
5. Open `/history`. The chain event tab shows every event. The HCS tab shows every audit message. Rows where the event and the audit message agree are marked with a check and the audit sequence number. The counts at the top agree, or differ by exactly the events you have not yet audited.
6. A second pay on the same invoice is rejected. A second audit publish for the same tx hash writes nothing.
