import { getLatestPrice, confidenceBps } from "@/lib/pyth";
import { MAX_CONF_BPS, MAX_STALENESS_SEC } from "@/lib/hedera";

export async function GET() {
  try {
    const snap = await getLatestPrice();
    const now = Math.floor(Date.now() / 1000);
    const age = now - snap.publishTime;
    const confBps = confidenceBps(BigInt(snap.price), BigInt(snap.conf));
    return Response.json({
      source: snap.source,
      feedId: snap.feedId,
      price: snap.price,
      conf: snap.conf,
      expo: snap.expo,
      publishTime: snap.publishTime,
      fetchedAt: snap.fetchedAt,
      ageSec: age,
      stale: age > MAX_STALENESS_SEC,
      confBps,
      confBpsLimit: MAX_CONF_BPS,
      stalenessLimitSec: MAX_STALENESS_SEC,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: { code: "PYTH_UNAVAILABLE", message } },
      { status: 503 }
    );
  }
}
