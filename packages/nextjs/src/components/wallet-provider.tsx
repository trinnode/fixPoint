// Wallet session context for live Hedera testnet mode.
//
// Status disabled means no WalletConnect project id is set, so live mode is
// off and the demo ledger keeps working. Nothing custom is persisted here.
// The provider storage owns the session, and restore runs once on mount.

"use client";

import * as React from "react";
import type UniversalProvider from "@walletconnect/universal-provider";
import {
  connectWallet,
  disconnectWallet,
  getProvider,
  isConfigured,
  restoreWallet,
} from "@/lib/wallet";

export type WalletStatus = "disabled" | "disconnected" | "connecting" | "connected";

interface WalletState {
  status: WalletStatus;
  accountId: string | null;
  evmAddress: string | null;
  sessionTopic: string | null;
  provider: UniversalProvider | null;
  uri: string | null;
  error: string | null;
  connect: (onUri?: (uri: string) => void) => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = React.createContext<WalletState | null>(null);

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[wallet]", err);
  if (/project id/i.test(msg)) return msg;
  if (/closed|reject|cancel|denied|declined|dismiss/i.test(msg)) {
    return "You closed the wallet approval. Nothing connected.";
  }
  if (/no Hedera account/i.test(msg)) return msg;
  return "The wallet did not connect. Check the pairing and try again.";
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<WalletStatus>(
    isConfigured() ? "disconnected" : "disabled"
  );
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [evmAddress, setEvmAddress] = React.useState<string | null>(null);
  const [sessionTopic, setSessionTopic] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<UniversalProvider | null>(null);
  const [uri, setUri] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isConfigured()) return;
    let live = true;
    restoreWallet()
      .then(async (conn) => {
        if (!live || !conn) return;
        setProvider(await getProvider());
        setAccountId(conn.hederaAccountId);
        setEvmAddress(conn.evmAddress || null);
        setSessionTopic(conn.sessionTopic);
        setStatus("connected");
      })
      .catch((err) => console.error("[wallet] restore failed", err));
    return () => {
      live = false;
    };
  }, []);

  const connect = React.useCallback(async (onUri?: (u: string) => void) => {
    if (!isConfigured()) {
      setStatus("disabled");
      setError("Live wallet mode needs a WalletConnect project id. The demo ledger keeps working.");
      return;
    }
    setError(null);
    setStatus("connecting");
    try {
      const conn = await connectWallet((u) => {
        setUri(u);
        onUri?.(u);
      });
      setProvider(await getProvider());
      setAccountId(conn.hederaAccountId);
      setEvmAddress(conn.evmAddress || null);
      setSessionTopic(conn.sessionTopic);
      setUri(null);
      setStatus("connected");
    } catch (err) {
      setUri(null);
      setError(friendlyError(err));
      setStatus("disconnected");
    }
  }, []);

  const disconnect = React.useCallback(async () => {
    await disconnectWallet();
    setProvider(null);
    setAccountId(null);
    setEvmAddress(null);
    setSessionTopic(null);
    setUri(null);
    setError(null);
    setStatus(isConfigured() ? "disconnected" : "disabled");
  }, []);

  const clearError = React.useCallback(() => setError(null), []);

  const value = React.useMemo(
    () => ({
      status,
      accountId,
      evmAddress,
      sessionTopic,
      provider,
      uri,
      error,
      connect,
      disconnect,
      clearError,
    }),
    [status, accountId, evmAddress, sessionTopic, provider, uri, error, connect, disconnect, clearError]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = React.useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must render inside WalletProvider");
  return ctx;
}
