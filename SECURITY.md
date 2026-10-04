# Security

This is a starting point, not audited code. Read it before you build on it.

## Threat model

The contract holds HBAR on behalf of a buyer until a release condition is met. The buyer takes the price risk at pay time. The seller takes the refund risk after pay. The relayer takes no risk. The oracle takes the rate risk. The threats below are the ones a deployer must think about. The full walkthrough lives in `docs/threat-model.md`.

### Oracle manipulation and staleness

A stale or manipulated price lets a buyer pay less than the dollar amount, or lets a seller claim more than it. The mitigation is two bounds, mirrored in the contract and in `packages/nextjs/src/lib/hedera.ts`:

- `MAX_STALENESS_SEC = 60`. The contract reads through `getPriceNoOlderThan`, so a price older than 60 seconds reverts at the source.
- `MAX_CONF_BPS = 100`. A confidence wider than 100 basis points, computed as `conf * 10000 / price`, reverts.

The conversion rounds the HBAR amount **up** in favour of the seller, so a buyer never underpays at the published rate. The residual risk is a Pyth feed that goes wrong inside the bounds, a fast move within 60 seconds and within 100 bps. The contract can only act on what the oracle published.

### Relayer trust

The relayer is a small service that publishes HCS audit messages. It does **not** hold funds. It verifies the chain event on the mirror node before it publishes. The route is `POST /api/audit` in `packages/nextjs/src/app/api/audit/route.ts` and the logic is `publishAudit` in `packages/nextjs/src/lib/invoices.ts`.

The route only accepts a `txHash`. It looks the event up. If no event matches, it returns 404. If an audit message already exists for that hash, it returns the existing sequence number and writes nothing. The relayer cannot invent a chain event. It can only echo one that happened.

The residual risk is a compromised operator key. The operator key signs the HCS message. A stolen key can publish a misleading audit message but cannot move the held HBAR. The damage is confined to the audit trail, and the chain remains the source of truth.

### HCS is an audit, not a database

HCS is an append only, ordered, signed log. The app does not read state from HCS. It reads state from the contract and the mirror node. HCS is the tamper evident record that the chain events happened. If a relayer publishes a false audit message, the chain and the audit will disagree and the disagreement is visible on the history page, where the agreement marker will be missing for that event.

The residual risk is a relayer that refuses to audit. That is a liveness problem, not a safety problem. The held funds are unaffected.

### Association griefing

A buyer must associate the receipt token before the contract can mint the NFT receipt to them. If the buyer is not associated, the HTS transfer returns a non success code and `pay` reverts. On the demo ledger the check runs before any funds move and returns `RECEIPT_NOT_ASSOCIATED`.

The griefing vector is a buyer who refuses to associate. They cannot pay. The seller is not paid. The invoice simply expires when the pay by date passes. No funds are stuck. The residual risk is the wasted time of the seller, which is the same risk as any unpaid invoice.

### Seller contract rejecting HBAR

This is a documented limit. The buyer sends HBAR with the payable `pay` call. The contract holds it and pushes it to the recipient on settle with a low level call. If the push fails, the funds stay held, a `PayoutFailed` event is emitted, and the settle function can be retried. There is no separate pull withdraw.

The residual risk is a seller who uses a contract wallet that rejects plain HBAR transfers. They cannot be paid until they fix the wallet. The funds remain in escrow and the buyer can reclaim after a missed delivery deadline.

### Rounding bias

The HBAR amount is rounded **up** in favour of the seller. The buyer pays a rounding dust more than the exact dollar amount at the published rate. The bias is at most one weibar per invoice. The choice is deliberate and documented. The alternative, rounding to nearest, would let a buyer underpay half the time. The seller should never receive less than the dollar amount at the published rate.

The residual risk is the buyer's dust. It is returned as part of the overpayment refund when the buyer sends more than the quoted total.

### Key handling

The deployer key and the relayer operator key are read from the environment at runtime only and never committed. The demo ledger reads no keys at all. Its audit signature is a sha256 digest, not an Ed25519 signature, so the audit shape and the idempotency can be exercised end to end without a live network.

The residual risk is operator key compromise. The blast radius is the audit trail, not the escrowed funds. Rotate the key if it leaks. The held HBAR is unaffected.

## What this template does not do

- No dispute arbitration. There is no arbitrator role and no escrow of last resort. If buyer and seller disagree, the contract only moves funds on the documented triggers (release, claim after review, refund, claim refund after a missed delivery).
- No support for more than one currency. The invoice is denominated in USD cents. The settlement is in HBAR only. Adding another currency is a new contract, not a flag.
- No upgrade path. The contract is not proxied. A fix is a redeploy and a migration.
- Not audited. This code has not had a third party security review. The contract suite has 43 unit tests, strict TypeScript and ESLint gate every change, and the threat model is written down. That is a starting point, not a review. Run Slither and Aderyn, then get a human audit before anything holds real value.
- No real on chain settlement in the demo UI. The demo ledger simulates the contract calls, the HTS mint and the HBAR transfers. No demo transaction reaches a real Hedera network until you run the deploy and demo scripts with a funded account. The committed object ids in `packages/nextjs/src/lib/hedera.ts` are demo constants.
- No real HCS signature in the demo UI. The signature on each demo audit message is a sha256 digest, not an Ed25519 signature. The deployed relayer signs with the operator key.

## Deliberate, documented choices

- **Rounding direction: up, in favour of the seller.** A buyer never underpays at the published rate. The bias is a rounding dust per invoice.
- **Staleness limit: 60 seconds.** Pyth updates are frequent. A 60 second window is tight enough to catch a stuck feed and loose enough to absorb a slow network.
- **Confidence limit: 100 basis points.** A wider confidence means a less certain price. The contract refuses to settle on a less certain price.
- **Simulation honesty.** The demo labels the offline seed price as `seed`. It labels cached prices as `cached`. It labels live Hermes prices as `hermes`. The UI shows the source. No source is hidden.
- **The relayer only audits.** It never holds funds and it verifies the chain event before publishing.

## Status

This is a starting point, not audited code. Before you ship anything that moves real value, get a third party security review on the contract, the relayer and the operator key handling.
