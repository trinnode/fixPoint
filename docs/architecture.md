# Architecture

Fixpoint composes three Hedera services and one oracle around a single escrow contract. Each piece owns one fact. No piece trusts another for its own fact.

## Facts and owners

| Fact | Owner | Readers |
| --- | --- | --- |
| Invoice state and held funds | `FixpointEscrow` on Hedera EVM | App, mirror node, relayer |
| HBAR USD rate at pay time | Pyth oracle, read on chain in `pay` | Contract only. The frontend quote is a preview, never the settlement rate. |
| Payment receipt | HTS NFT collection, minted by the contract | Buyer wallet, mirror node |
| Ordered audit trail | HCS topic, written by the relayer | History view |

## Sequence

1. Seller calls `createInvoice` with USD cents, a pay by timestamp, a review window and a metadata hash. The contract stores the invoice and emits `InvoiceCreated`.
2. Buyer fetches a Hermes price update off chain and calls `pay` with HBAR attached. The contract pays the Pyth update fee, reads the price with a staleness bound, checks confidence, computes the held amount rounded up, refunds the excess, mints the HTS receipt to the buyer, and emits `InvoicePaid`.
3. Buyer calls `release`, or seller calls `claimAfterReview` after the review window, or seller calls `refund`, or buyer calls `claimRefundIfExpired` after the pay by date. Each path moves the full held amount to exactly one party and emits its event. See the state diagram below.
4. After each confirmed transaction, the app calls the relayer route with the transaction hash only. The route verifies the contract event on the mirror node, builds the compact versioned payload, and publishes it to the HCS topic. The publish is idempotent by tx hash.
5. The history view reads contract logs from the mirror node and audit messages from the topic, and marks rows where the two agree.

## States

```
CREATED --> PAID --> RELEASED
   |           |
   |           +--> REFUNDED
   |
   +--> EXPIRED
```

`PAID` settles to the seller through release or claim after review, and to the buyer through refund or claim refund if expired. `CREATED` expires past the pay by date through `expire`. No other transitions exist. There is no owner, no upgrade path, and no withdraw.

## Trust notes

The relayer is not trusted for funds. It only audits, and only what the mirror node confirms. A compromised relayer can withhold audit messages or spam the topic. It cannot move held funds or rewrite chain events. The history view treats unaudited events as pending, never as settled.

The frontend quote is a preview. Settlement uses the on chain Pyth read at pay time. A quote shown a minute ago can differ from the executed rate, and the UI says so.

HCS is an ordered, timestamped log, not a database. Queries run against the mirror node. The topic gives tamper evidence and ordering. Anything that needs filtering or paging reads the mirror node or a local index, never the topic alone.

## Demo ledger

The Next.js demo stores the same facts in Postgres: invoices, events, receipts and audit messages. `invoices.ts` mirrors the contract function for function, including access control and the pricing maths. It exists so the flow runs without a live network. It is a convenience, not the system of record. Do not mistake its transaction hashes for Hedera transactions.
