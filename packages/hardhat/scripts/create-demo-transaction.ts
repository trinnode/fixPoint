import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/../.env" });

// Full create -> pay -> release flow on Hedera testnet against the REAL Pyth
// receiver. Price update bytes must be fetched off-chain first (Hermes):
//
//   FEED=<HBAR/USD feed id, see PRICE_FEED_ID in .env>
//   curl -s "https://hermes.pyth.network/v2/updates/price/latest?ids[]=$FEED&encoding=hex" \
//     | jq -r '.binary.data[0]' > /tmp/update.hex
//
// Then either set PRICE_UPDATE_HEX / PRICE_UPDATE_FILE in .env or pass the file.
// The buyer must already be associated with the receipt token (HTS
// TokenAssociate, signed by the buyer key) or pay() reverts on transfer.
//
// Roles: the default signer (HEDERA_OPERATOR_KEY) is the seller. Set BUYER_KEY
// to a different key for the buyer; without it the script stops after create
// (a seller cannot pay their own invoice).
const EXPLORER = "https://hashscan.io/testnet";

function updateBytes(): string[] {
  const hex =
    process.env.PRICE_UPDATE_HEX?.trim() ||
    (process.env.PRICE_UPDATE_FILE?.trim()
      ? readFileSync(process.env.PRICE_UPDATE_FILE.trim(), "utf8").trim()
      : "");
  if (!hex) {
    throw new Error(
      "Provide fresh Hermes price-update bytes via PRICE_UPDATE_HEX or PRICE_UPDATE_FILE.\n" +
        "See the header comment of this script for the exact Hermes fetch."
    );
  }
  return [hex.startsWith("0x") ? hex : `0x${hex}`];
}

async function main(): Promise<void> {
  const deployedPath = join(__dirname, "..", "deployed", `${network.name}.json`);
  const deployed = existsSync(deployedPath) ? JSON.parse(readFileSync(deployedPath, "utf8")) : {};
  const address: string = (process.env.CONTRACT_ADDRESS ?? "").trim() || deployed.contract;
  if (!address) throw new Error("Set CONTRACT_ADDRESS or deploy first (see deployed/*.json)");

  const [seller] = await ethers.getSigners();
  const buyerKey = (process.env.BUYER_KEY ?? "").trim();
  const buyerWallet = buyerKey ? new ethers.Wallet(buyerKey, ethers.provider) : null;

  const escrow: any = await ethers.getContractAt("FixpointEscrow", address);
  console.log(`escrow=${address} seller=${seller.address} buyer=${buyerWallet?.address ?? "(unset)"}`);

  const usdCents = Number(process.env.USD_CENTS ?? 500);
  const payBy = Math.floor(Date.now() / 1000) + 3600;
  const reviewWindow = 300;
  const metaHash = ethers.keccak256(ethers.toUtf8Bytes(`demo-${Date.now()}`));

  const createTx = await escrow.connect(seller).createInvoice(usdCents, payBy, reviewWindow, metaHash);
  const createRx = await createTx.wait();
  console.log(`create tx: ${EXPLORER}/tx/${createRx!.hash}`);
  const invoiceCount: bigint = await escrow.invoiceCount();
  const id = invoiceCount - 1n;
  console.log(`invoice id=${id}`);

  if (!buyerWallet) {
    console.log("BUYER_KEY unset: stopping after create. Set it to run pay -> release.");
    return;
  }

  const [hbarWei, fee]: [bigint, bigint] = await escrow.quoteCurrent(usdCents);
  console.log(`quote: hbarWei=${hbarWei} fee=${fee}`);
  const payTx = await escrow.connect(buyerWallet).pay(id, updateBytes(), { value: hbarWei + fee });
  const payRx = await payTx.wait();
  console.log(`pay tx: ${EXPLORER}/tx/${payRx!.hash}`);

  const releaseTx = await escrow.connect(buyerWallet).release(id);
  const releaseRx = await releaseTx.wait();
  console.log(`release tx: ${EXPLORER}/tx/${releaseRx!.hash}`);
  console.log(`done: ${EXPLORER}/contract/${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
