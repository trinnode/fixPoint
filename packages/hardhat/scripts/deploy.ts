import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env" });

// Documented Pyth receiver on Hedera testnet.
// Source: Pyth docs "Contract Addresses / on EVM Networks / Testnets" row
// "Hedera Testnet ... 0xA2aa...5B5729" linking to
// https://hashscan.io/testnet/address/0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
const DEFAULT_PYTH_TESTNET = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`network=${network.name} chainId=${chainId} deployer=${deployer.address}`);

  const pyth =
    process.env.PYTH_CONTRACT?.trim() ||
    (network.name === "hederaTestnet" ? DEFAULT_PYTH_TESTNET : "");
  if (!pyth) throw new Error("Set PYTH_CONTRACT in packages/hardhat/.env");
  const feedId = (process.env.PRICE_FEED_ID ?? "").trim();
  if (!feedId) {
    throw new Error(
      "Set PRICE_FEED_ID in packages/hardhat/.env. Resolve the HBAR/USD feed id via:\n" +
        '  curl -s "https://hermes.pyth.network/v2/price_feeds?query=HBAR"'
    );
  }
  const hts = (process.env.HTS_PRECOMPILE ?? "").trim() || ethers.ZeroAddress;

  const escrow: any = await ethers.deployContract("FixpointEscrow", [pyth, feedId, hts]);
  await escrow.waitForDeployment();
  const contract = await escrow.getAddress();
  console.log(`FixpointEscrow deployed at ${contract}`);
  console.log(`Hashscan: https://hashscan.io/testnet/contract/${contract}`);

  const out = {
    network: network.name,
    chainId,
    contract,
    pyth,
    priceFeedId: feedId,
    receiptToken: null as string | null,
    topic: null as string | null,
    deployer: deployer.address,
  };
  const dir = join(__dirname, "..", "deployed");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${network.name}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${path} (no secrets written)`);

  console.log(`
Next steps (run once, off-chain):
1. Create the HTS NFT receipt collection with this contract as the supply key,
   then call setReceiptToken(tokenSolidityAddress) once.
   Example with the Hiero SDK (npm i @hiero-ledger/sdk), operator = deployer key:

   // const { Client, TokenCreateTransaction, TokenType, TokenSupplyType,
   //   PrivateKey, ... } = require("@hiero-ledger/sdk");
   // const client = Client.forTestnet().setOperator(opId, opKey);
   // const supplyKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY);
   // const tx = await new TokenCreateTransaction()
   //   .setTokenName("Fixpoint Receipt").setTokenSymbol("FXR")
   //   .setTokenType(TokenType.NonFungibleUnique).setSupplyType(TokenSupplyType.Finite)
   //   .setMaxSupply(1_000_000).setTreasuryAccountId(opId)
   //   .setSupplyKey(supplyKey) // or a ContractId key for "<contract> as supply key":
   //   // .setSupplyKey(ContractId.fromSolidityAddress("${contract}")) with admin key update
   //   .execute(client);
   // NOTE: for the contract itself to mint, the collection's supply key must be
   // the deployed contract (ContractId key). Create with an admin key, then call
   // setReceiptToken(<0x solidity address of the new token>) from any account.
2. Re-run this script's output file to record the token:
   packages/hardhat/deployed/${network.name}.json -> set "receiptToken".
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
