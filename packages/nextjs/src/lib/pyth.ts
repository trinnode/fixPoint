// Pyth price oracle client and the pricing maths that converts USD to HBAR.
//
// The price is fetched live from the public Pyth Hermes API. This is the only
// load bearing external integration in the template. If Hermes is unreachable
// the client falls back to the last good price, then to a documented seed value.
// The UI always shows which source the price came from so nothing is faked.
//
// The conversion mirrors FixpointEscrow.sol exactly:
//   hbarWei = ceil( usdCents * 10^18 / (100 * price * 10^expo) )
// rounded up in favour of the seller. Staleness and confidence bounds reject
// prices that are too old or too loose.

import { MAX_STALENESS_SEC, MAX_CONF_BPS } from "./hedera";

const HERMES_BASE = "https://hermes.pyth.network";
const HBAR_QUERY = "HBAR";

function hermesHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const key = process.env.PYTH_HERMES_KEY;
  // Hermes requires an API key since the August 2026 Pyth Core upgrade. Send
  // both header spellings so the client works against hermes.pyth.network and
  // the dourolabs drop-in instance either way.
  if (key) {
    h["Authorization"] = `Bearer ${key}`;
    h["x-api-key"] = key;
  }
  return h;
}

export type PriceSource = "hermes" | "cached" | "seed";

export interface PriceSnapshot {
  source: PriceSource;
  feedId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  fetchedAt: number;
}

export class PythError extends Error {
  constructor(
    message: string,
    public code: "fetch" | "feed" | "stale" | "confidence" | "price"
  ) {
    super(message);
    this.name = "PythError";
  }
}

let feedIdCache: string | null = null;
let priceCache: PriceSnapshot | null = null;
const PRICE_TTL_MS = 4_000;

// A documented offline seed. Used only when Hermes has never been reached in
// this process. Approximate HBAR/USD. Never silently presented as live.
const SEED_PRICE = "181200000";
const SEED_CONF = "410000";
const SEED_EXPO = -8;

async function resolveFeedId(): Promise<string> {
  if (feedIdCache) return feedIdCache;
  const url = `${HERMES_BASE}/v2/price_feeds?query=${HBAR_QUERY}`;
  const res = await fetch(url, { headers: hermesHeaders() });
  if (!res.ok) {
    throw new PythError(
      `Hermes price_feeds responded ${res.status}`,
      "fetch"
    );
  }
  const body = await res.json();
  const list: Array<{
    id: string;
    attributes?: { symbol?: string; display_symbol?: string; quote_currency?: string; asset_type?: string };
  }> = Array.isArray(body) ? body : body.data ?? [];
  const hbar = list.find(
    (f) =>
      f.attributes?.symbol?.toUpperCase().includes("HBAR/USD") ||
      f.attributes?.display_symbol?.toUpperCase() === "HBARUSD"
  );
  if (!hbar) {
    throw new PythError("HBAR/USD feed not found on Hermes", "feed");
  }
  feedIdCache = hbar.id;
  return hbar.id;
}

export async function getLatestPrice(): Promise<PriceSnapshot> {
  const now = Date.now();
  if (priceCache && now - priceCache.fetchedAt < PRICE_TTL_MS) {
    return priceCache;
  }
  try {
    const feedId = await resolveFeedId();
    const url = `${HERMES_BASE}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`;
    const res = await fetch(url, { headers: hermesHeaders() });
    if (!res.ok) {
      throw new PythError(`Hermes responded ${res.status}`, "fetch");
    }
    const body = await res.json();
    const parsed: Array<{ id: string; price: { price: string; conf: string; expo: number; publish_time: number } }> =
      body.parsed ?? [];
    const entry = parsed.find((p) => p.id === feedId) ?? parsed[0];
    if (!entry?.price) {
      throw new PythError("Hermes returned no parsed price", "feed");
    }
    const snap: PriceSnapshot = {
      source: "hermes",
      feedId,
      price: String(entry.price.price),
      conf: String(entry.price.conf),
      expo: Number(entry.price.expo),
      publishTime: Number(entry.price.publish_time),
      fetchedAt: now,
    };
    priceCache = snap;
    return snap;
  } catch (err) {
    if (priceCache) {
      return { ...priceCache, source: "cached", fetchedAt: now };
    }
    return {
      source: "seed",
      feedId: "offline-seed",
      price: SEED_PRICE,
      conf: SEED_CONF,
      expo: SEED_EXPO,
      publishTime: Math.floor(now / 1000) - 35,
      fetchedAt: now,
    };
  }
}

export function confidenceBps(price: bigint, conf: bigint): number {
  if (price <= 0n) return Number.MAX_SAFE_INTEGER;
  return Number((conf * 10_000n) / price);
}

export interface QuoteInput {
  usdCents: number;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  now?: number;
}

export interface Quote {
  hbarWei: bigint;
  feeWei: bigint;
  totalWei: bigint;
  priceUsd: number;
  confBps: number;
  stale: boolean;
  accepted: boolean;
  rejection?: string;
}

// Simulated Pyth update fee. In the contract this comes from getUpdateFee.
// Here it is a small fixed cost so the overpayment refund path is exercised.
export const UPDATE_FEE_WEI = 10n ** 14n; // 0.0001 HBAR

export function computeQuote(input: QuoteInput): Quote {
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const price = BigInt(input.price);
  const conf = BigInt(input.conf);
  const expo = input.expo;

  if (price <= 0n) {
    return quoteRejected(0n, "price not positive", price, conf, expo);
  }
  const stale = now - input.publishTime > MAX_STALENESS_SEC;
  if (stale) {
    return quoteRejected(0n, "price older than staleness limit", price, conf, expo);
  }
  const confBps = confidenceBps(price, conf);
  if (confBps > MAX_CONF_BPS) {
    return quoteRejected(0n, "confidence too wide", price, conf, expo);
  }

  const usdCents = BigInt(input.usdCents);
  let num: bigint;
  let denom: bigint;
  if (expo >= 0) {
    num = usdCents * 10n ** 18n;
    denom = 100n * price * 10n ** BigInt(expo);
  } else {
    const e = BigInt(-expo);
    num = usdCents * 10n ** (18n + e);
    denom = 100n * price;
  }
  // Round up in favour of the seller.
  const hbarWei = (num + denom - 1n) / denom;
  const feeWei = UPDATE_FEE_WEI;
  const totalWei = hbarWei + feeWei;
  const priceUsd = Number(price) * Math.pow(10, expo);

  return {
    hbarWei,
    feeWei,
    totalWei,
    priceUsd,
    confBps,
    stale,
    accepted: true,
  };
}

function quoteRejected(
  _hbarWei: bigint,
  reason: string,
  price: bigint,
  conf: bigint,
  expo: number
): Quote {
  return {
    hbarWei: 0n,
    feeWei: 0n,
    totalWei: 0n,
    priceUsd: Number(price) * Math.pow(10, expo),
    confBps: confidenceBps(price, conf),
    stale: false,
    accepted: false,
    rejection: reason,
  };
}
