# Fixpoint contracts

`FixpointEscrow.sol` is the on chain half of the template. Sellers create USD invoices. Buyers pay HBAR at a live Pyth rate. The contract holds the funds, mints an HTS NFT receipt to the buyer through the system contract, and settles to the seller on release, claim after review, or refund.

## Commands

All from the repo root, or with `-w @fixpoint/contracts` from anywhere.

```
npm run hardhat:compile
npm test
```

`npm test` runs 43 Hardhat tests against `MockPyth` and `MockHts`: the happy path, exact pricing vectors including rounding dust, stale and wide confidence rejections, overpayment and underpayment, access control on every function, every illegal state transition, HTS failure modes, and reentrancy attacks on pay, release and refund.

## Deploy to Hedera testnet

You need a funded ECDSA testnet account. Get testnet HBAR from the Hedera Portal faucet. Copy the example env file and fill in the three values. Never commit this file.

```
cp .env.example packages/hardhat/.env
```

| Name | Purpose |
| --- | --- |
| `HEDERA_OPERATOR_ID` | Your testnet account, for example `0.0.1234` |
| `HEDERA_OPERATOR_KEY` | Its ECDSA private key |
| `PRICE_FEED_ID` | HBAR USD feed id, resolved with `curl -s "https://hermes.pyth.network/v2/price_feeds?query=HBAR"` |

`PYTH_CONTRACT` defaults to the documented Hedera testnet Pyth receiver `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`, from the Pyth docs EVM addresses page. Override it only if Pyth publishes a new address.

Then deploy. The script prints the contract address and its Hashscan link, and writes `deployed/hederaTestnet.json` with addresses only.

```
npm run hardhat:deploy
```

After deploy, create the HTS NFT receipt collection with the deployed contract as the supply key, then call `setReceiptToken` once with the token solidity address. The deploy script prints the exact SDK steps. Record the token id in the deployed JSON under `receiptToken`.

## Run the demo flow on testnet

```
npm run demo -- --network hederaTestnet
```

The script creates an invoice, pays it at the live Pyth rate, and releases it, printing a Hashscan link for every transaction plus the token and the HCS topic messages. Paste those links into `docs/testnet-evidence.md`.

Useful overrides in `packages/hardhat/.env`: `CONTRACT_ADDRESS` to reuse an existing deployment, `BUYER_KEY` for a second account in the buyer role, `USD_CENTS` for the demo amount, `PRICE_UPDATE_HEX` or `PRICE_UPDATE_FILE` for a pre fetched Hermes price update.

## Contract verification

Verify the source on Hashscan through Sourcify so judges see the code behind the address. The scaffold convention is a Sourcify submission of the flattened source with the exact compiler version from `hardhat.config.ts` (0.8.24 with optimizer settings as configured). Document the verified link next to the deployment in `docs/testnet-evidence.md`.

## Unit system

The JSON RPC relay presents HBAR to the EVM at 18 decimals. The HAPI uses tinybars at 8 decimals. One tinybar is `1e10` wei. The contract centralises this in `tinybarToWei` and `weiToTinybar`. The demo frontend mirrors it in `format.ts`. Test both sides before touching either.
