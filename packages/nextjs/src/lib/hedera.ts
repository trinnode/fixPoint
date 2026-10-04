// Chain configuration for the Fixpoint demo.
//
// Every value here is a fixed, committed "deployment". In the real template these
// come from a committed addresses JSON produced by the deploy script. The
// operator key for the relayer is read from the environment at runtime only and
// is never committed.

export const NETWORK = "testnet";
export const CHAIN_ID = 296;
export const CHAIN_NAME = "Hedera Testnet";
export const RPC_URL = "https://testnet.hashio.io";
export const MIRROR_NODE_URL = "https://testnet.mirrornode.hedera.com/api/v1";
export const EXPLORER_URL = "https://hashscan.io/testnet";

export const CONTRACT_ADDR = "0xC2a7B4Ecf4E0f3C5c67a89B1c0dE2f3A4b5C6d7E";
export const RECEIPT_TOKEN_ID = "0.0.5847293";
export const RECEIPT_TOKEN_ADDR = "0x0000000000000000000000000000000000001684";
export const RECEIPT_TOKEN_SYMBOL = "FXR";
export const RECEIPT_TOKEN_NAME = "Fixpoint Receipt";
export const HCS_TOPIC_ID = "0.0.5847294";

export const SELLER_ADDR = "0x6B1A2c3D4e5F6789aBcDeF0123456789aBcDeF01";
export const BUYER_ADDR = "0x4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c2D3e";

// HBAR units. The HAPI uses tinybar (8 decimals). The JSON RPC relay presents
// values to the EVM scaled to 18 decimals (weibar). One tinybar is 10^10 weibar.
export const TINYBAR_DECIMALS = 8;
export const WEIBAR_DECIMALS = 18;
export const WEI_PER_TINYBAR = 10n ** 10n;

// NFT metadata is limited to 100 bytes on HTS. We store a compact reference only.
export const HTS_META_MAX_BYTES = 100;

// Pricing safety constants, mirrored in the contract.
export const MAX_STALENESS_SEC = 60;
export const MAX_CONF_BPS = 100;

export type Actor = "seller" | "buyer";

export function actorAddress(actor: Actor): string {
  return actor === "seller" ? SELLER_ADDR : BUYER_ADDR;
}

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function hashscanUrl(path: string): string {
  return `${EXPLORER_URL}/${path}`;
}
