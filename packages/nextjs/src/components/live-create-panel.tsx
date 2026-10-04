// Live create panel shown on top of the new invoice page when a wallet is
// connected. Same fields as the demo form, submit sends createInvoice through
// the wallet and reports the transaction hash with a Hashscan link.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWallet } from "@/components/wallet-provider";
import {
  buildCreateTx,
  getInvoiceCount,
  hashscanTx,
  sendEvmTx,
} from "@/lib/chain";
import { Loader2 } from "lucide-react";

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[live] create failed", err);
  if (/reject|cancel|denied|declined|dismiss|closed/i.test(msg)) {
    return "You rejected the transaction in your wallet. Nothing was created.";
  }
  return "The wallet did not submit the transaction. Check the pairing and try again.";
}

export function LiveCreatePanel({
  usdCents,
  payByTs,
  reviewSec,
  memo,
  formValid,
}: {
  usdCents: number;
  payByTs: number;
  reviewSec: number;
  memo: string;
  formValid: boolean;
}) {
  const { status, provider, sessionTopic, evmAddress } = useWallet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [newId, setNewId] = useState<number | null>(null);

  if (status !== "connected" || !provider || !sessionTopic || !evmAddress) {
    return null;
  }

  async function submit() {
    setError(null);
    setTxHash(null);
    setNewId(null);
    const activeProvider = provider;
    const topic = sessionTopic;
    const from = evmAddress;
    if (!activeProvider || !topic || !from) {
      setError("Connect a wallet first. Reads need no wallet, writes do.");
      return;
    }
    if (!formValid || usdCents <= 0) {
      setError("Finish the demo form first. Live create uses the same values.");
      return;
    }
    if (payByTs <= Math.floor(Date.now() / 1000) + 60) {
      setError("Pick a pay by date at least a minute ahead. The contract rejects past dates.");
      return;
    }
    setPending(true);
    try {
      const before = await getInvoiceCount();
      const tx = buildCreateTx({ usdCents, payBy: payByTs, reviewWindow: reviewSec, memo });
      const hash = await sendEvmTx(activeProvider, topic, from, tx);
      setTxHash(hash);
      setNewId(before);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="mb-6 rounded-2xl border border-primary/30 bg-card p-6"
      aria-label="Live on testnet"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Live on testnet</h2>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
          wallet {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        This creates the invoice on the live contract with the values below. You approve one
        transaction in your wallet.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>Live create did not submit</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {txHash ? (
        <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <p className="font-medium text-foreground">
            Created on testnet{newId !== null ? ` as invoice #${newId}` : ""}.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <a
              href={hashscanTx(txHash)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              View transaction on Hashscan
            </a>
            {newId !== null && (
              <Link href={`/invoices/${newId}?live=1`} className="font-medium text-primary hover:underline">
                Open live invoice #{newId}
              </Link>
            )}
            <Link href="/history" className="font-medium text-primary hover:underline">
              History
            </Link>
          </div>
        </div>
      ) : (
        <Button className="mt-3" onClick={submit} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "Waiting for wallet approval" : "Create live on testnet"}
        </Button>
      )}
    </section>
  );
}
