// Pairing modal for the wallet connection.
//
// Loaded with next/dynamic ssr false from the wallet button so no wallet code
// runs on the server. Shows the pairing code with a copy button and a
// HashPack deep link.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { hashpackLink } from "@/lib/wallet";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";

export function WalletModal({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. The code below stays selectable.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pair wallet"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-medium text-foreground">Pair your wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve the session in your wallet, then return here.
        </p>

        {!uri ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-secondary/50 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing the pairing code
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="break-all rounded-xl bg-secondary/50 p-3 font-mono text-[11px] leading-relaxed text-foreground">
              {uri}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={copy}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy code"}
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <a href={hashpackLink(uri)} target="_blank" rel="noreferrer">
                  Open in HashPack <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The code links this site to your wallet. Nothing moves until you approve a transaction.
            </p>
          </div>
        )}

        <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
