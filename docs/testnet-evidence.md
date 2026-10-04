# Testnet evidence

Run the procedure below with a funded ECDSA testnet account, then fill in the table. Every link must open on Hashscan testnet and match the deployed code. Until the table is filled, this file documents the exact procedure so anyone can reproduce it in one sitting.

## Procedure

1. Fund an ECDSA testnet account from the Hedera Portal faucet. Fund a second account for the buyer role.

2. Copy the example env and fill in the operator, its key, and the HBAR USD feed id.

   ```
   cp .env.example packages/hardhat/.env
   ```

   Resolve the feed id with `curl -s "https://hermes.pyth.network/v2/price_feeds?query=HBAR"`.

3. Deploy.

   ```
   npm run hardhat:deploy
   ```

   The script prints the contract address and its Hashscan link, and writes `packages/hardhat/deployed/hederaTestnet.json`.

4. Create the HTS NFT receipt collection with the deployed contract as the supply key, call `setReceiptToken` once, and record the token id in the deployed JSON. The deploy script prints the exact SDK steps.

5. Run the full flow. Optionally export `BUYER_KEY` first so a second account plays the buyer.

   ```
   npm run demo -- --network hederaTestnet
   ```

   The script creates an invoice, pays it at the live Pyth rate, releases it, and prints a Hashscan link for every transaction.

6. Verify the contract source on Hashscan through Sourcify with the exact compiler version from `hardhat.config.ts`, and paste the verified link below.

## Links

| Object | Link |
| --- | --- |
| Escrow contract, verified source | pending |
| Create invoice transaction | pending |
| Pay transaction | pending |
| Release transaction | pending |
| HTS receipt token | pending |
| HTS receipt serial for the demo payment | pending |
| HCS audit topic | pending |
| HCS message for the pay event | pending |

Link shapes for reference: `https://hashscan.io/testnet/contract/0.0.x`, `https://hashscan.io/testnet/transaction/0.0.x@...`, `https://hashscan.io/testnet/token/0.0.x`, `https://hashscan.io/testnet/topic/0.0.x`.
