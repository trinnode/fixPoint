# Threat model

This is the detailed threat model for the Fixpoint preview. Each threat has a description, an impact, a mitigation and a residual risk. Read it alongside `SECURITY.md`.

This preview simulates the on chain parts. The simulation is faithful to the contract's rules, but no transaction reaches a real Hedera network in this preview. Where the simulation differs from the deployed template, the threat entry says so.

## 1. Stale Pyth price

**Description.** The Pyth Hermes feed publishes a price and a publish time. The escrow uses the latest price at pay time. A stale price is one whose publish time is far in the past. A buyer who controls the timing of a stale price can pay at a rate that no longer reflects the market.

**Impact.** A buyer pays less HBAR than the dollar amount is worth at the current rate. The seller is short changed.

**Mitigation.** `computeQuote` in `src/lib/pyth.ts` rejects any price whose age exceeds `MAX_STALENESS_SEC` (60 seconds) with `PRICE_REJECTED`. The constant is exported from `src/lib/hedera.ts` and mirrored in the contract. The pay route propagates the rejection as a `PRICE_REJECTED` `EscrowError`. The buyer cannot pay through the route until a fresh price is available.

**Residual risk.** A Pyth feed that goes wrong inside the 60 second window. The contract can only act on what the oracle published. A fast move of more than the confidence bound is caught by threat 2. A fast move inside both bounds is not caught.

## 2. Loose Pyth price (wide confidence)

**Description.** A Pyth price comes with a confidence interval. A wide confidence means the publisher is uncertain. Settling on an uncertain price lets a buyer pay at the favourable edge of the band.

**Impact.** A buyer pays less HBAR than the dollar amount is worth at the mid price. The seller is short changed.

**Mitigation.** `computeQuote` in `src/lib/pyth.ts` computes the confidence in basis points as `conf * 10_000 / price` and rejects anything above `MAX_CONF_BPS` (100 basis points) with `PRICE_REJECTED`. The constant is exported from `src/lib/hedera.ts` and mirrored in the contract.

**Residual risk.** A confidence that is wide in absolute terms but narrow in basis points on a high price. The contract trusts Pyth's own confidence figure. A publisher that misreports confidence is outside the contract's control.

## 3. Replay of a stale Pyth update

**Description.** A buyer submits an old Pyth VAA at pay time, hoping the contract will accept it as fresh. The VAA is signed by Pyth, so it is valid, but the price is old.

**Impact.** Same as threat 1. The seller is paid at an old rate.

**Mitigation.** The contract checks the publish time of the VAA against the block timestamp and applies the same 60 second staleness bound. The contract does not trust the relayer for freshness; it trusts the VAA's own publish time.

**Residual risk.** A block timestamp that is skewed. Hedera block timestamps are consensus time and are not easy to manipulate, but a skewed clock is the residual vector. The 60 second window absorbs small skew.

## 4. Relayer abuse of `/api/audit`

**Description.** The relayer publishes audit messages to HCS. If the route accepts arbitrary input, a compromised relayer could publish a misleading audit message that does not correspond to any chain event.

**Impact.** The audit trail diverges from the chain. A reader who trusts the audit trail alone is misled. A reader who compares the audit trail to the chain sees the disagreement.

**Mitigation.** `POST /api/audit` in `src/app/api/audit/route.ts` only accepts a `txHash` string. It does not accept a payload. The payload is built inside `publishAudit` in `src/lib/invoices.ts` from the chain event and the invoice. The route looks the event up first; if no event matches the hash, it returns 404. The route deduplicates by tx hash: a second publish for the same hash returns the existing sequence number and writes nothing. The relayer cannot invent a chain event, and it cannot rewrite the payload for a given event.

**Residual risk.** A compromised relayer operator key in the real template can sign and publish a misleading message directly to HCS, bypassing the route. That message will not match any chain event and the disagreement will be visible on the history page. The held funds are unaffected.

## 5. HCS message tampering

**Description.** An attacker tries to alter an audit message after it is published, or to inject a forged message into the topic.

**Impact.** The audit trail is altered. The history no longer matches the chain.

**Mitigation.** HCS is an append only, ordered, consensus governed log. Messages cannot be altered once submitted. In the real template each audit message is signed by the relayer operator key (Ed25519). A reader can verify the signature against the published operator identity. In this preview the signature is a sha256 digest of the topic id, the sequence number and the payload, and is labelled as a simulated signature. It is not an Ed25519 signature and must not be trusted as one.

**Residual risk.** A compromised operator key in the real template can sign forged messages. The signature verifies, but the message does not match any chain event. The disagreement is visible on the history page (the agreement marker will be missing). The held funds are unaffected.

## 6. Buyer association griefing

**Description.** A buyer must associate the receipt token before the contract can mint the NFT to them. A buyer who refuses to associate cannot pay.

**Impact.** The seller's invoice is not paid. The seller's time is wasted.

**Mitigation.** The check is in `payInvoice` in `src/lib/invoices.ts`. If the `buyer_associated` flag is not set, the route returns `RECEIPT_NOT_ASSOCIATED`. The invoice is unaffected. The pay by date still applies. When it passes, the seller (or anyone) can call `POST /api/invoices/[id]/expire` and the invoice moves to EXPIRED. No funds are stuck because no funds were ever taken.

**Residual risk.** The wasted time of the seller. This is the same risk as any unpaid invoice. There is no on chain way to force a buyer to associate.

## 7. Seller contract rejecting HBAR

**Description.** The contract pushes HBAR to the seller at release time. If the seller's address is a contract that rejects plain HBAR transfers, the release fails.

**Impact.** The seller cannot be paid. The held funds stay in escrow.

**Mitigation.** None in this preview. The brief lists a pull style refund pattern as future work. The seller would call a withdraw function and the contract would attempt the transfer once. That is not implemented here.

**Residual risk.** A seller who uses a contract wallet that rejects HBAR cannot be paid. The funds remain in escrow until the seller fixes the wallet, or until the buyer reclaims after a missed delivery deadline (see `claimRefundIfExpired` in `src/lib/invoices.ts`). The seller should test their wallet before relying on Fixpoint.

## 8. Rounding bias

**Description.** The conversion from USD to HBAR uses integer division. The choice of rounding direction is a design decision.

**Impact.** Rounding down would let a buyer pay a rounding dust less than the dollar amount at the published rate. Rounding to nearest would let a buyer underpay half the time. The contract rounds **up** in favour of the seller, so the buyer pays a rounding dust more.

**Mitigation.** `computeQuote` in `src/lib/pyth.ts` computes `hbarWei = ceil(usdCents * 10^18 / (100 * price * 10^expo))`. The numerator and denominator are scaled to keep the division integer. The choice is documented in `SECURITY.md` and in the code. The buyer's dust is returned as part of the overpayment refund when the buyer sends more than the quoted total.

**Residual risk.** The buyer pays a rounding dust more per invoice. The dust is at most one weibar. The overpayment refund handles the case where the buyer sends more than the quoted total.

## 9. Operator key compromise

**Description.** The relayer operator key signs HCS messages in the real template. A stolen key can sign and publish misleading audit messages.

**Impact.** The audit trail is polluted. The held funds are unaffected (the relayer never holds funds).

**Mitigation.** The operator key is read from the environment at runtime only and is never committed. The committed `.env.example` has empty values. The relayer cannot move funds; it can only publish audit messages. The history page compares each audit message to the chain event and shows the agreement marker only when they match. A forged message will not match and the disagreement will be visible. Rotate the key if it leaks.

**Residual risk.** The window between a key leak and a rotation. During that window the audit trail can be polluted. The chain remains the source of truth, so a reader who compares the two sees the disagreement. The held funds are unaffected.

## 10. Simulation and preview caveats

**Description.** This preview runs the same maths, the same state machine and the same audit pattern as the deployed template, but the on chain parts are simulated. No transaction reaches a real Hedera network in this preview.

**Impact.** A reader who treats the preview as a real deployment will be misled. The contract address, the receipt token id and the topic id in `src/lib/hedera.ts` are demo constants. The HCS signature is a sha256 digest, not an Ed25519 signature.

**Mitigation.** The UI labels the price source (`hermes`, `cached`, `seed`) and never hides it. The README, AGENTS and SECURITY files state the simulation plainly. The relayer route in `src/app/api/audit/route.ts` builds the audit payload from the local database, but the shape and the idempotency are the same as in the real template.

**Residual risk.** A fork that strips the labels and ships the preview as a real deployment. Do not do this. Get a third party security review on the contract, the relayer and the operator key handling before you ship anything that moves real value.
