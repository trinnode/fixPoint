# Testnet evidence

Live on Hedera testnet, chain id 296, deployed October 2026 with this repo's scripts. Every link below opens on Hashscan testnet or the mirror node REST API and matches the deployed code. Hashscan blocks non browser clients, so verify these in a browser. The mirror node links next to each one return the same facts as JSON.

## Deployed objects

| Object | Value |
| --- | --- |
| Escrow contract | `0xD41da4456C08423ab652D011f20f26F19Fd003a5`, contract id `0.0.10856608` |
| Pyth receiver | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`, from the Pyth docs EVM addresses page |
| HBAR USD feed id | `0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd`, resolved through the public Hermes `price_feeds?query=HBAR` endpoint |
| HCS audit topic | `0.0.10856645`, memo `Fixpoint audit` |
| Operator account | `0.0.10856592`, ECDSA, funded from the public faucet |
| Buyer account | `0xa62c431E3A38da10D50098247D2eB186D8fe2aa5`, funded with 1 HBAR by the operator |

## Links

| Object | Hashscan | Mirror node |
| --- | --- | --- |
| Escrow contract | `https://hashscan.io/testnet/contract/0.0.10856608` | `https://testnet.mirrornode.hedera.com/api/v1/contracts/0xD41da4456C08423ab652D011f20f26F19Fd003a5` |
| Deploy transaction | `https://hashscan.io/testnet/transaction/0.0.7314364@1791114810.535963944` | `https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10856592` |
| Buyer funding (1 HBAR) | `https://hashscan.io/testnet/transaction/0xbd219b4fa45a86383bffd8140bcb5738360a33f110439b5a7fbb5040b99242f2` (paste the `0x` hash into Hashscan search) | same list as above |
| Create invoice, id 2, USD 5.00 | `https://hashscan.io/testnet/transaction/0.0.7314364@1791115079.401144125` | same list as above |
| HCS audit topic | `https://hashscan.io/testnet/topic/0.0.10856645` | `https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10856645` |
| HCS message seq 1, Created event | topic page, first message | `https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10856645/messages?limit=1&order=desc` |

Two earlier `createInvoice` calls, ids 0 and 1, came from a demo script run that stopped before pay while the ordering bug was being fixed. They are real on chain invoices from the same contract and cost nothing to keep.

## How it was reproduced

```
npm run hardhat:deploy
BUYER_KEY= npm run demo
```

`BUYER_KEY` empty stops the demo after create. With it set, the script runs pay then release. The deployed addresses live in `packages/hardhat/deployed/hederaTestnet.json`.

## Still open, with exact next steps

1. HTS receipt collection. Creating the NFT collection costs about 10 HBAR and the deployer holds about 6.5 after deploy. Top the operator up from the faucet, then create the collection with the deployed contract as the supply key, call `setReceiptToken` once, and record the token id in the deployed JSON. The deploy script prints the exact SDK calls.
2. Pay and release on chain. Two inputs are needed. The buyer must associate the receipt token first, one HTS associate from the buyer key. And `pay` needs fresh Hermes price update bytes, which require a `PYTH_HERMES_KEY` since the August 2026 upgrade. Set `PRICE_UPDATE_HEX` or `PRICE_UPDATE_FILE` in `packages/hardhat/.env` and rerun the demo with `BUYER_KEY` set.
3. Contract source verification. Verify through Sourcify with compiler 0.8.24 and the optimizer settings in `hardhat.config.ts`, then paste the verified link here.
