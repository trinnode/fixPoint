// Unit conversions between USD, HBAR, tinybar and weibar.
//
// One HBAR is 10^8 tinybar (the HAPI unit) and 10^18 weibar (what the EVM sees
// through the JSON RPC relay). Money is stored in the contract and database as
// weibar. The UI never shows raw bigint maths. Everything is formatted here.

import { WEI_PER_TINYBAR, WEIBAR_DECIMALS, TINYBAR_DECIMALS } from "./hedera";

export function weiToHbar(wei: bigint | string | null | undefined): string {
  if (!wei) return "0";
  const n = BigInt(wei);
  const whole = n / 10n ** BigInt(WEIBAR_DECIMALS);
  const frac = n % 10n ** BigInt(WEIBAR_DECIMALS);
  const fracStr = frac.toString().padStart(WEIBAR_DECIMALS, "0").replace(/0+$/, "");
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

export function weiToTinybar(wei: bigint | string | null | undefined): bigint {
  if (!wei) return 0n;
  return BigInt(wei) / WEI_PER_TINYBAR;
}

export function tinybarToHbar(tb: bigint | number): string {
  const n = BigInt(tb);
  const whole = n / 10n ** BigInt(TINYBAR_DECIMALS);
  const frac = n % 10n ** BigInt(TINYBAR_DECIMALS);
  const fracStr = frac.toString().padStart(TINYBAR_DECIMALS, "0").replace(/0+$/, "");
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

export function usdCentsToUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatUsd(cents: number): string {
  return `$${usdCentsToUsd(cents)}`;
}

export function formatHbar(wei: bigint | string | null | undefined, dp = 4): string {
  const hbar = weiToHbar(wei);
  const [w, f] = hbar.split(".");
  if (!f) return `${w} HBAR`;
  const frac = f.slice(0, dp).padEnd(dp, "0");
  return `${w}.${frac} HBAR`;
}

export function formatHbarPlain(wei: bigint | string | null | undefined, dp = 4): string {
  const hbar = weiToHbar(wei);
  const [w, f] = hbar.split(".");
  if (!f) return w;
  return `${w}.${f.slice(0, dp).padEnd(dp, "0")}`;
}

export function formatPrice(
  price: bigint | string | number,
  expo: number,
  dp = 4
): string {
  const p = BigInt(price);
  const neg = p < 0n;
  const abs = neg ? -p : p;
  const digits = abs.toString();
  if (expo >= 0) {
    const v = digits + "0".repeat(expo);
    return `$${neg ? "-" : ""}${v}`;
  }
  const e = -expo;
  const padded = digits.padStart(e + 1, "0");
  const whole = padded.slice(0, -e);
  const frac = padded.slice(-e);
  const trimmed = frac.slice(0, dp).padEnd(dp, "0");
  return `$${neg ? "-" : ""}${whole}.${trimmed}`;
}

export function confBps(price: bigint, conf: bigint): number {
  if (price <= 0n) return 0;
  return Number((conf * 10000n) / price);
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function relTime(epochSec: number): string {
  const diff = Date.now() / 1000 - epochSec;
  if (diff < 0) {
    const a = Math.abs(diff);
    if (a < 60) return `in ${Math.round(a)}s`;
    if (a < 3600) return `in ${Math.round(a / 60)}m`;
    if (a < 86400) return `in ${Math.round(a / 3600)}h`;
    return `in ${Math.round(a / 86400)}d`;
  }
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
