// Wallet action row for a live invoice.
//
// Rendered on the invoice detail page when the route carries live=1 and a
// wallet is connected. Associate uses a native HTS transaction, everything
// else calls the EVM contract. Live pay fetches the demo quote for the
// amounts, then sends an empty price update array, which succeeds only while
// the stored on chain price is fresh. The revert reason is always surfaced.

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet-provider";
import { api } from "@/lib/api";
import {
  LIVE_RECEIPT_TOKEN_ID,
  buildAssociateTx,
  buildClaimRefundTx,
  buildClaimTx,
  buildExpireTx,
  buildPayTx,
  buildRefundTx,
  buildReleaseTx,
  hashscanTx,
  hasReceiptToken,
  sendEvmTx,
  sendNativeTx,
  type EvmTxParams,
  type LiveInvoice,
} from "@/lib/chain";
import { formatHbar, formatUsd } from "@/lib/format";
import { Loader2, Link2, Send, ArrowRightLeft, Undo2, Clock, XCircle } from "lucide-react";

function sameAddr(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[live] action failed", err);
  if (/reject|cancel|denied|declined|dismiss|closed/i.test(msg)) {
    return "You rejected the transaction in your wallet. Nothing moved.";
  }
  if (/ReceiptTokenNotSet/i.test(msg)) {
    return "The deployment has no receipt token yet, so the contract refuses pay. Nothing left your wallet.";
  }
  if (/stale/i.test(msg)) {
    return "The stored oracle price is stale, so the contract refused the payment. Nothing left your wallet. A fresh oracle push needs a Hermes key, which this site does not hold.";
  }
  if (/confid/i.test(msg)) {
    return "The stored oracle price is too uncertain, so the contract refused the payment. Nothing left your wallet.";
  }
  if (/InsufficientPayment/i.test(msg)) {
    return "The amount sent was below the quote plus fee. Nothing was held.";
  }
  if (/SellerCannotPay/i.test(msg)) {
    return "This wallet is the seller, so it cannot pay its own invoice.";
  }
  if (/NotBuyer|NotSeller/i.test(msg)) {
    return "Your wallet is not the right party for this action. Connect the matching wallet.";
  }
  return "The contract refused the transaction. Nothing moved. The demo ledger keeps working.";
}

export function LiveInvoiceActions({
  invoice,
  onSettled,
}: {
  invoice: LiveInvoice;
  onSettled: () => void;
}) {
  const { provider, sessionTopic, accountId, evmAddress } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const quoteQ = useQuery({
    queryKey: ["quote", invoice.usdCents],
    queryFn: () => api.quote(invoice.usdCents),
    enabled: invoice.state === "CREATED",
    staleTime: 5_000,
  });
  const quote = quoteQ.data ?? null;

  if (!provider || !sessionTopic || !accountId || !evmAddress) return null;

  const now = Math.floor(Date.now() / 1000);
  const expired = now > invoice.payBy && invoice.state === "CREATED";
  const isSeller = sameAddr(evmAddress, invoice.seller);
  const isBuyer = sameAddr(evmAddress, invoice.buyer);
  const reviewPassed =
    invoice.paidAt !== null && now >= invoice.paidAt + invoice.reviewWindow;
  const refundOpen = now > invoice.payBy;
  const isTerminal = ["RELEASED", "REFUNDED", "EXPIRED"].includes(invoice.state);

  async function runEvm(kind: string, tx: EvmTxParams) {
    setError(null);
    setTxHash(null);
    setPending(kind);
    try {
      const hash = await sendEvmTx(provider!, sessionTopic!, evmAddress!, tx);
      setTxHash(hash);
      onSettled();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPending(null);
    }
  }

  async function associate() {
    setError(null);
    setTxHash(null);
    setPending("associate");
    try {
      const tx = buildAssociateTx(accountId!, LIVE_RECEIPT_TOKEN_ID);
      const out = await sendNativeTx(provider!, sessionTopic!, accountId!, tx);
      setTxHash(out);
      onSettled();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPending(null);
    }
  }

  function pay() {
    if (!quote || !quote.accepted) return;
    runEvm("pay", buildPayTx(invoice.id, BigInt(quote.totalWei)));
  }

  const busy = pending !== null;

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Live actions</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
          {accountId}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        These call the live contract through your wallet. Demo actions stay below in the demo panel.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>Live action refused</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {txHash && (
        <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <p className="font-medium text-foreground">Submitted to testnet.</p>
          <a
            href={txHash === "associate submitted" ? "https://hashscan.io/testnet" : hashscanTx(txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
          >
            {txHash === "associate submitted" ? "Open Hashscan" : "View transaction on Hashscan"}
          </a>
          <p className="mt-1 font-mono text-[10px] break-all text-muted-foreground">{txHash}</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {invoice.state === "CREATED" && !expired && (
          <>
            {!hasReceiptToken() ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                The deployment has no receipt token yet, so live pay by mint is paused. Demo pay
                still works.
              </div>
            ) : isSeller ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                Waiting for the buyer to pay. Your wallet is the seller, so it cannot pay this
                invoice.
              </div>
            ) : (
              <div className="space-y-3">
                <Button className="w-full" onClick={associate} disabled={busy}>
                  {pending === "associate" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Associate receipt token
                </Button>
                {quote && quote.accepted ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Demo quote {formatHbar(quote.totalWei)} for {formatUsd(invoice.usdCents)}.
                      Live pay sends an empty price update, so it succeeds only while the stored
                      oracle price is fresh.
                    </p>
                    <Button className="w-full" onClick={pay} disabled={busy}>
                      {pending === "pay" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Pay {formatHbar(quote.totalWei)} live
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {quoteQ.isFetching ? "Loading the quote" : (quote?.rejection ?? "Quote unavailable")}.
                    Live pay needs an accepted quote.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {invoice.state === "PAID" && isBuyer && (
          <>
            <Button className="w-full" onClick={() => runEvm("release", buildReleaseTx(invoice.id))} disabled={busy}>
              {pending === "release" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="mr-2 h-4 w-4" />
              )}
              Release funds
            </Button>
            {refundOpen && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => runEvm("claimRefund", buildClaimRefundTx(invoice.id))}
                disabled={busy}
              >
                {pending === "claimRefund" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-2 h-4 w-4" />
                )}
                Claim refund, pay by date passed
              </Button>
            )}
          </>
        )}

        {invoice.state === "PAID" && isSeller && (
          <>
            <Button className="w-full" onClick={() => runEvm("refund", buildRefundTx(invoice.id))} disabled={busy}>
              {pending === "refund" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Refund to buyer
            </Button>
            {reviewPassed ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => runEvm("claim", buildClaimTx(invoice.id))}
                disabled={busy}
              >
                {pending === "claim" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="mr-2 h-4 w-4" />
                )}
                Claim after review
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                The review window is still open. Claim unlocks after it passes.
              </p>
            )}
          </>
        )}

        {invoice.state === "PAID" && !isBuyer && !isSeller && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            This wallet is neither buyer nor seller on this invoice, so no live actions apply.
          </div>
        )}

        {invoice.state === "CREATED" && expired && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => runEvm("expire", buildExpireTx(invoice.id))}
            disabled={busy}
          >
            {pending === "expire" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Mark expired
          </Button>
        )}

        {isTerminal && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            Settled on testnet. No further live actions apply.
          </div>
        )}
      </div>
    </div>
  );
}
