// Lazy client only WalletConnect wiring for live Hedera testnet mode.
//
// This module never touches window at import time. The UniversalProvider is
// loaded with a dynamic import inside getProvider so server rendering and the
// demo ledger stay untouched. Session persistence is handled by the provider
// storage itself, so this module keeps no custom persisted state.
//
// Pairing UX: connectWallet resolves once the wallet approves. While the
// pairing code is showing, the caller receives it through onUri and renders
// it with a copy button plus a HashPack deep link. See wallet modal.

import type UniversalProvider from "@walletconnect/universal-provider";

export const HEDERA_CHAIN = "hedera:testnet";
export const EVM_CHAIN = "eip155:296";

export interface WalletConnection {
  sessionTopic: string;
  hederaAccountId: string;
  evmAddress: string;
  pairingUri: string | null;
}

let providerTask: Promise<UniversalProvider> | null = null;
let lastUri: string | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_WC_PROJECT_ID);
}

export function shortId(id: string | null | undefined): string {
  if (!id) return "…";
  if (id.startsWith("0x") && id.length > 12) {
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
  }
  return id;
}

function appUrl(): string {
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch {
    // No window on the server. This value only feeds wallet metadata.
  }
  return "https://fixpoint.example";
}

function namespaces(): {
  hedera: { chains: string[]; methods: string[]; events: string[] };
  eip155: { chains: string[]; methods: string[]; events: string[] };
} {
  return {
    hedera: {
      chains: [HEDERA_CHAIN],
      methods: ["hedera_signAndExecuteTransaction", "hedera_signTransaction"],
      events: [],
    },
    eip155: {
      chains: [EVM_CHAIN],
      methods: ["eth_sendTransaction", "personal_sign"],
      events: [],
    },
  };
}

async function loadProvider(): Promise<UniversalProvider> {
  const mod = await import("@walletconnect/universal-provider");
  const Provider = mod.default;
  const url = appUrl();
  const provider = await Provider.init({
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID as string,
    metadata: {
      name: "Fixpoint",
      description: "USD priced escrow on Hedera, settled in HBAR at Pyth prices.",
      url,
      icons: [`${url}/logo.svg`],
    },
  });
  provider.on("display_uri", (uri: unknown) => {
    if (typeof uri === "string") {
      lastUri = uri;
    }
  });
  return provider;
}

export function getProvider(): Promise<UniversalProvider> {
  if (!providerTask) {
    providerTask = loadProvider();
  }
  return providerTask;
}

function lastAccount(accounts: string[] | undefined): string {
  const full = accounts && accounts[0] ? accounts[0] : "";
  if (!full) return "";
  const parts = full.split(":");
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

export function connectionFrom(provider: UniversalProvider): WalletConnection | null {
  const session = provider.session;
  if (!session) return null;
  return {
    sessionTopic: session.topic,
    hederaAccountId: lastAccount(session.namespaces.hedera?.accounts),
    evmAddress: lastAccount(session.namespaces.eip155?.accounts),
    pairingUri: null,
  };
}

export async function connectWallet(onUri?: (uri: string) => void): Promise<WalletConnection> {
  if (!isConfigured()) {
    throw new Error("Live wallet mode needs a WalletConnect project id. The demo ledger keeps working.");
  }
  const provider = await getProvider();
  const existing = connectionFrom(provider);
  if (existing) return existing;
  if (onUri) {
    provider.once("display_uri", (uri: unknown) => {
      if (typeof uri === "string") onUri(uri);
    });
    if (lastUri) onUri(lastUri);
  }
  const session = await provider.connect({ namespaces: namespaces() });
  if (!session) {
    throw new Error("The wallet closed the pairing before approving. Nothing connected.");
  }
  const conn = connectionFrom(provider);
  if (!conn || !conn.hederaAccountId) {
    throw new Error("The wallet paired but shared no Hedera account. Try pairing again.");
  }
  return { ...conn, pairingUri: lastUri };
}

export async function restoreWallet(): Promise<WalletConnection | null> {
  if (!isConfigured()) return null;
  try {
    const provider = await getProvider();
    return connectionFrom(provider);
  } catch {
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  if (!providerTask) return;
  const provider = await providerTask;
  providerTask = null;
  lastUri = null;
  try {
    await provider.disconnect();
  } catch {
    // Session already gone. Treat as disconnected.
  }
}

export function hashpackLink(uri: string): string {
  return `https://wallet.hashpack.app/wc?uri=${encodeURIComponent(uri)}`;
}
