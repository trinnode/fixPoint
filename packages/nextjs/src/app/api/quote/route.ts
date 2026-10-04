import { getLatestPrice, computeQuote, confidenceBps } from "@/lib/pyth";
import { MAX_CONF_BPS, MAX_STALENESS_SEC } from "@/lib/hedera";
import { escrowResponse, EscrowError } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const usdCents = Number(url.searchParams.get("usdCents"));
    if (!Number.isFinite(usdCents) || usdCents <= 0) {
      throw new EscrowError("BAD_INPUT", "usdCents must be a positive integer");
    }
    const snap = await getLatestPrice();
    const quote = computeQuote({
      usdCents,
      price: snap.price,
      conf: snap.conf,
      expo: snap.expo,
      publishTime: snap.publishTime,
    });
    return Response.json({
      source: snap.source,
      feedId: snap.feedId,
      price: snap.price,
      conf: snap.conf,
      expo: snap.expo,
      publishTime: snap.publishTime,
      ageSec: Math.floor(Date.now() / 1000) - snap.publishTime,
      confBps: confidenceBps(BigInt(snap.price), BigInt(snap.conf)),
      confBpsLimit: MAX_CONF_BPS,
      stalenessLimitSec: MAX_STALENESS_SEC,
      usdCents,
      usd: (usdCents / 100).toFixed(2),
      hbarWei: quote.hbarWei.toString(),
      feeWei: quote.feeWei.toString(),
      totalWei: quote.totalWei.toString(),
      accepted: quote.accepted,
      rejection: quote.rejection ?? null,
    });
  } catch (err) {
    return escrowResponse(err);
  }
}
