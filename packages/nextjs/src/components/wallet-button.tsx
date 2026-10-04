// Header control for the live wallet.
//
// States: project id missing opens an explainer, disconnected offers
// connect, connecting shows progress, connected shows the account chip with
// disconnect. The connect modal loads client only through next/dynamic.

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet-provider";
import { Loader2, LogOut, Wallet } from "lucide-react";

const WalletModal = dynamic(
  () => import("@/components/wallet-modal").then((m) => m.WalletModal),
  { ssr: false }
);

export function WalletButton() {
  const { status, accountId, uri, error, connect, disconnect, clearError } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  async function startConnect() {
    setModalOpen(true);
    await connect();
    setModalOpen(false);
  }

  if (status === "disabled") {
    return (
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => { clearError(); setInfoOpen((v) => !v); }}>
          <Wallet className="mr-2 h-4 w-4" /> Live wallet off
        </Button>
        {infoOpen && (
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
            <p className="text-sm font-medium text-foreground">Live wallet is off</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Live mode needs a WalletConnect project id, which is free from Reown. Add it as
              NEXT_PUBLIC_WC_PROJECT_ID and reload. The demo ledger keeps working meanwhile.
            </p>
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setInfoOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 font-mono text-[11px] font-medium text-success tabular-nums"
          title={accountId ?? ""}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {accountId}
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect} aria-label="Disconnect wallet">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant={status === "connecting" ? "secondary" : "default"}
        size="sm"
        onClick={startConnect}
        disabled={status === "connecting"}
      >
        {status === "connecting" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="mr-2 h-4 w-4" />
        )}
        {status === "connecting" ? "Connecting" : "Connect wallet"}
      </Button>
      {error && (
        <p className="mt-1 max-w-44 text-right text-[11px] text-destructive">{error}</p>
      )}
      {modalOpen && (
        <WalletModal uri={uri} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
