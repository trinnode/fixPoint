import { getKv, setKv } from "@/lib/kv";
import { BUYER_ADDR, RECEIPT_TOKEN_ADDR, RECEIPT_TOKEN_ID, RECEIPT_TOKEN_SYMBOL } from "@/lib/hedera";
import { createHash, randomBytes } from "crypto";

export async function GET() {
  const associated = (await getKv("buyer_associated")) === "1";
  return Response.json({
    associated,
    account: BUYER_ADDR,
    tokenId: RECEIPT_TOKEN_ID,
    tokenAddr: RECEIPT_TOKEN_ADDR,
    symbol: RECEIPT_TOKEN_SYMBOL,
  });
}

export async function POST() {
  await setKv("buyer_associated", "1");
  const txHash = createHash("sha256")
    .update(`associate|${randomBytes(8).toString("hex")}`)
    .digest("hex");
  return Response.json({
    associated: true,
    account: BUYER_ADDR,
    tokenId: RECEIPT_TOKEN_ID,
    tokenAddr: RECEIPT_TOKEN_ADDR,
    symbol: RECEIPT_TOKEN_SYMBOL,
    txHash,
  });
}
