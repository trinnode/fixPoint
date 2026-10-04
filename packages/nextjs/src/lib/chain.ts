// Live Hedera testnet reads, calldata builders and wallet senders.
//
// Reads go to the public relay with ethers only. Writes are encoded here and
// approved in the user wallet through WalletConnect. No private key ever
// enters this module.
//
// Verified live on the mirror node: invoiceCount 3, receiptToken unset, safety
// constants 60 seconds and 100 bps. quoteCurrent reverts while the stored
// Pyth price is stale, so live pay sends an empty update array and surfaces
// the revert reason honestly. Fresh Hermes bytes need a Hermes key, which the
// browser does not hold, so this module never pretends otherwise.
//
// The ABI below mirrors packages/hardhat/contracts/FixpointEscrow.sol
// exactly. Amounts cross the boundary as strings, never as BigInt.

import {
  Interface,
  JsonRpcProvider,
  keccak256,
  toBeHex,
  toUtf8Bytes,
} from "ethers";
import {
  TokenAssociateTransaction,
  TransactionId,
} from "@hiero-ledger/sdk";
import type { Transaction } from "@hiero-ledger/sdk";
import type UniversalProvider from "@walletconnect/universal-provider";
import { EVM_CHAIN, HEDERA_CHAIN } from "./wallet";

function envAddr(name: string, fallback: string): string {
  const v = process.env[name];
  if (v && /^0x[0-9a-fA-F]{40}$/.test(v.trim())) return v.trim();
  return fallback;
}

export const LIVE_CONTRACT_ADDRESS = envAddr(
  "NEXT_PUBLIC_CONTRACT_ADDRESS",
  "0xD41da4456C08423ab652D011f20f26F19Fd003a5"
);
export const LIVE_RECEIPT_TOKEN_ID = (process.env.NEXT_PUBLIC_RECEIPT_TOKEN_ID ?? "").trim();
export const LIVE_HCS_TOPIC_ID =
  (process.env.NEXT_PUBLIC_HCS_TOPIC_ID ?? "").trim() || "0.0.10856645";
export const LIVE_RELAY_URL = "https://testnet.hashio.io/api/v1";
export const LIVE_CHAIN_ID = 296;

export function hasReceiptToken(): boolean {
  return LIVE_RECEIPT_TOKEN_ID.length > 0;
}

// Minimal ABI built from the verified contract signatures only.
export const INVOICE_ABI = [
  "function createInvoice(uint256 usdCents, uint64 payBy, uint32 reviewWindow, bytes32 metadataHash) returns (uint256 id)",
  "function pay(uint256 id, bytes[] priceUpdate) payable",
  "function release(uint256 id)",
  "function claimAfterReview(uint256 id)",
  "function refund(uint256 id)",
  "function claimRefundIfExpired(uint256 id)",
  "function expire(uint256 id)",
  "function quoteCurrent(uint256 usdCents) view returns (uint256 hbarWei, uint256 fee)",
  "function invoiceCount() view returns (uint256)",
  "function invoices(uint256) view returns (address seller, address buyer, uint256 usdCents, uint64 payBy, uint32 reviewWindow, uint64 paidAt, uint256 amountHeld, bytes32 metadataHash, uint8 state, int64 receiptSerial)",
  "function receiptToken() view returns (address)",
  "function MAX_STALENESS_SEC() view returns (uint256)",
  "function MAX_CONF_BPS() view returns (uint256)",
  "error StalePrice(uint256 age)",
  "error WideConfidence(uint256 confBps)",
  "error NonPositivePrice()",
  // StalePrice with no args is the Pyth receiver error, raised inside
  // getPriceNoOlderThan before the escrow check runs. Verified live.
  "error StalePrice()",
  "error ReceiptTokenNotSet()",
  "error InvoiceNotPayable()",
  "error UnknownInvoice(uint256 id)",
  "error InsufficientPayment(uint256 required, uint256 sent)",
];

export type LiveState = "CREATED" | "PAID" | "RELEASED" | "REFUNDED" | "EXPIRED";

const STATE_NAMES: LiveState[] = ["CREATED", "PAID", "RELEASED", "REFUNDED", "EXPIRED"];

export interface LiveInvoice {
  id: number;
  seller: string;
  buyer: string | null;
  usdCents: number;
  payBy: number;
  reviewWindow: number;
  paidAt: number | null;
  amountHeldWei: string;
  metadataHash: string;
  state: LiveState;
  receiptSerial: number | null;
}

export interface LiveQuote {
  accepted: boolean;
  hbarWei: string;
  feeWei: string;
  totalWei: string;
  reason: string | null;
}

export interface EvmTxParams {
  to: string;
  data: string;
  value: string;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

let relayCache: JsonRpcProvider | null = null;

export function relay(): JsonRpcProvider {
  if (!relayCache) {
    relayCache = new JsonRpcProvider(LIVE_RELAY_URL, {
      chainId: LIVE_CHAIN_ID,
      name: "Hedera Testnet",
    });
  }
  return relayCache;
}

function escrow(): Interface {
  return new Interface(INVOICE_ABI);
}

export async function getInvoiceCount(): Promise<number> {
  const data = escrow().encodeFunctionData("invoiceCount");
  const raw = await relay().call({ to: LIVE_CONTRACT_ADDRESS, data });
  const [n] = escrow().decodeFunctionResult("invoiceCount", raw);
  return Number(n);
}

export async function getInvoice(id: number): Promise<LiveInvoice> {
  const data = escrow().encodeFunctionData("invoices(uint256)", [id]);
  const raw = await relay().call({ to: LIVE_CONTRACT_ADDRESS, data });
  const r = escrow().decodeFunctionResult("invoices(uint256)", raw);
  const buyer = String(r[1]);
  const paidAt = Number(r[5]);
  const serial = Number(r[9]);
  const stateIdx = Number(r[8]);
  return {
    id,
    seller: String(r[0]),
    buyer: buyer.toLowerCase() === ZERO_ADDR ? null : buyer,
    usdCents: Number(r[2]),
    payBy: Number(r[3]),
    reviewWindow: Number(r[4]),
    paidAt: paidAt === 0 ? null : paidAt,
    amountHeldWei: String(r[6]),
    metadataHash: String(r[7]),
    state: STATE_NAMES[stateIdx] ?? "CREATED",
    receiptSerial: serial === 0 ? null : serial,
  };
}

function quoteRevertReason(err: unknown): string {
  const anyErr = err as { data?: unknown; shortMessage?: string; message?: string; info?: { error?: { data?: unknown } } };
  const data =
    typeof anyErr?.data === "string"
      ? anyErr.data
      : typeof anyErr?.info?.error?.data === "string"
        ? anyErr.info.error.data
        : null;
  if (data) {
    try {
      const parsed = escrow().parseError(data);
      if (parsed?.name === "StalePrice") {
        return "The stored oracle price is stale, so the contract will not quote it. A fresh oracle push is needed before live pay can succeed.";
      }
      if (parsed?.name === "WideConfidence") {
        return "The stored oracle price is too uncertain, so the contract will not quote it. A fresh oracle push is needed before live pay can succeed.";
      }
      if (parsed?.name === "NonPositivePrice") {
        return "The stored oracle price is not positive, so the contract will not quote it.";
      }
    } catch {
      // Fall through to the generic message below.
    }
  }
  const msg = String(anyErr?.shortMessage ?? anyErr?.message ?? "");
  if (/stale/i.test(msg)) {
    return "The stored oracle price is stale, so the contract will not quote it. A fresh oracle push is needed before live pay can succeed.";
  }
  if (/confid/i.test(msg)) {
    return "The stored oracle price is too uncertain, so the contract will not quote it.";
  }
  console.error("[live] quoteCurrent reverted", err);
  return "The live contract would not quote this amount right now. The demo quote below keeps working.";
}

// View quote against the price already stored on chain. Reverts honestly
// when that price is stale, since a view call cannot push fresh Hermes data.
export async function getQuote(usdCents: number): Promise<LiveQuote> {
  try {
    const data = escrow().encodeFunctionData("quoteCurrent(uint256)", [usdCents]);
    const raw = await relay().call({ to: LIVE_CONTRACT_ADDRESS, data });
    const [hbarWei, fee] = escrow().decodeFunctionResult("quoteCurrent(uint256)", raw);
    const hbar = String(hbarWei);
    const f = String(fee);
    return {
      accepted: true,
      hbarWei: hbar,
      feeWei: f,
      totalWei: (BigInt(hbar) + BigInt(f)).toString(),
      reason: null,
    };
  } catch (err) {
    return {
      accepted: false,
      hbarWei: "0",
      feeWei: "0",
      totalWei: "0",
      reason: quoteRevertReason(err),
    };
  }
}

export function buildCreateTx(input: {
  usdCents: number;
  payBy: number;
  reviewWindow: number;
  memo: string;
}): EvmTxParams {
  const metadataHash = keccak256(toUtf8Bytes(input.memo.slice(0, 280)));
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("createInvoice", [
      input.usdCents,
      input.payBy,
      input.reviewWindow,
      metadataHash,
    ]),
    value: "0x0",
  };
}

// Live pay sends an empty price update array. Without a Hermes key the app
// cannot fetch fresh update bytes in the browser, so this succeeds only while
// the stored on chain price is still fresh. The revert reason is surfaced.
export function buildPayTx(id: number, valueWei: bigint): EvmTxParams {
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("pay", [id, []]),
    value: toBeHex(valueWei),
  };
}

export function buildReleaseTx(id: number): EvmTxParams {
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("release", [id]),
    value: "0x0",
  };
}

export function buildClaimTx(id: number): EvmTxParams {
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("claimAfterReview", [id]),
    value: "0x0",
  };
}

export function buildRefundTx(id: number): EvmTxParams {
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("refund", [id]),
    value: "0x0",
  };
}

export function buildClaimRefundTx(id: number): EvmTxParams {
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("claimRefundIfExpired", [id]),
    value: "0x0",
  };
}

export function buildExpireTx(id: number): EvmTxParams {
  return {
    to: LIVE_CONTRACT_ADDRESS,
    data: escrow().encodeFunctionData("expire", [id]),
    value: "0x0",
  };
}

// Unsigned HTS associate. Freezing and default node ids are applied by the
// wallet connect helper at send time, which is the verified helper path.
export function buildAssociateTx(accountId: string, tokenId: string): TokenAssociateTransaction {
  return new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([tokenId])
    .setTransactionId(TransactionId.generate(accountId));
}

const GAS_CAP = 1_000_000n;

export async function estimateGasWithHeadroom(tx: EvmTxParams): Promise<string> {
  try {
    const est = (await relay().estimateGas({
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })) as bigint;
    const padded = (est * 120n) / 100n;
    return toBeHex(padded > GAS_CAP ? GAS_CAP : padded);
  } catch {
    return toBeHex(500_000n);
  }
}

type WalletRequest = (
  args: { topic: string; method: string; params: unknown },
  chain?: string
) => Promise<unknown>;

function requester(provider: UniversalProvider): WalletRequest {
  return provider.request as WalletRequest;
}

function txHashFrom(out: unknown): string {
  if (typeof out === "string" && out.length > 0) return out;
  const o = out as { transactionHash?: unknown; hash?: unknown; result?: unknown } | null;
  const h = o?.transactionHash ?? o?.hash ?? o?.result;
  if (typeof h === "string" && h.length > 0) return h;
  throw new Error("The wallet approved but returned no transaction hash.");
}

export async function sendEvmTx(
  provider: UniversalProvider,
  topic: string,
  from: string,
  tx: EvmTxParams
): Promise<string> {
  const gas = await estimateGasWithHeadroom(tx);
  const out = await requester(provider)(
    {
      topic,
      method: "eth_sendTransaction",
      params: [{ from, to: tx.to, data: tx.data, value: tx.value, gas }],
    },
    EVM_CHAIN
  );
  return txHashFrom(out);
}

export async function sendNativeTx(
  provider: UniversalProvider,
  topic: string,
  accountId: string,
  sdkTx: Transaction
): Promise<string> {
  // Base64 encode an unsigned SDK transaction for the wallet relay. The
  // wallet signs and executes it. Equivalent to the helper the wallet connect
  // library ships, inlined here so the app needs no legacy wrapper package.
  // toBytes works on an unfrozen transaction. btoa keeps this browser safe.
  const raw = sdkTx.toBytes();
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < raw.length; i += step) {
    binary += String.fromCharCode(...raw.subarray(i, i + step));
  }
  const transactionList = btoa(binary);
  const out = await requester(provider)(
    {
      topic,
      method: "hedera_signAndExecuteTransaction",
      params: {
        signerAccountId: `${HEDERA_CHAIN}:${accountId}`,
        transactionList,
      },
    },
    HEDERA_CHAIN
  );
  if (typeof out === "string" && out.length > 0) return out;
  const o = out as { transactionId?: unknown } | null;
  if (o && typeof o.transactionId === "string") return o.transactionId;
  return "associate submitted";
}

export function hashscanTx(hash: string): string {
  return `https://hashscan.io/testnet/transaction/${hash}`;
}
