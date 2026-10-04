"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type QuoteInfo } from "@/lib/api";
import type { InvoiceView } from "@/lib/invoices";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { QuoteBreakdown } from "@/components/quote-breakdown";
import { formatHbar } from "@/lib/format";
import { Loader2, Link2, ShieldCheck, Send, ArrowRightLeft, Undo2, Clock, XCircle, BadgeCheck } from "lucide-react";

async function publishAuditFor(invoice: InvoiceView) {
  const last = invoice.events[invoice.events.length - 1];
  if (!last) return null;
  return api.audit(last.txHash);
}

export function InvoiceActions({
  invoice,
  quote,
  associated,
}: {
  invoice: InvoiceView;
  quote: QuoteInfo | null;
  associated: boolean;
}) {
  const actor = useAppStore((s) => s.actor);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [buffer, setBuffer] = useState(false);
  const [auditSeq, setAuditSeq] = useState<number | null>(null);

  const now = Math.floor(Date.now() / 1000);
  const expired = now > invoice.payByTs && invoice.state === "CREATED";
  const reviewPassed = invoice.paidAt != null && now >= invoice.paidAt + invoice.reviewSec;
  const deliveryPassed = invoice.deliveryTs != null && now > invoice.deliveryTs;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["invoice", invoice.id] });
    qc.invalidateQueries({ queryKey: ["association"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  function makeOpts<T>(fn: () => Promise<T>) {
    return {
      mutationFn: fn,
      onMutate: () => setError(null),
      onSuccess: async (data: any) => {
        if (data?.invoice) {
          try {
            const r = await publishAuditFor(data.invoice);
            if (r?.published) setAuditSeq(r.seq);
          } catch {
            // audit publish is best effort; the chain event is the source of truth
          }
        }
        invalidate();
      },
      onError: (e: Error) => setError(e.message),
    };
  }

  const payMut = useMutation(
    makeOpts(() => {
      const amountWei = quote
        ? buffer
          ? ((BigInt(quote.totalWei) * 101n) / 100n).toString()
          : quote.totalWei
        : undefined;
      return api.pay(invoice.id, actor, amountWei);
    })
  );
  const releaseMut = useMutation(makeOpts(() => api.release(invoice.id, actor)));
  const claimMut = useMutation(makeOpts(() => api.claim(invoice.id, actor)));
  const refundMut = useMutation(makeOpts(() => api.refund(invoice.id, actor)));
  const claimRefundMut = useMutation(makeOpts(() => api.claimRefund(invoice.id, actor)));
  const expireMut = useMutation(makeOpts(() => api.expire(invoice.id)));
  const assocMut = useMutation({
    mutationFn: api.associate,
    onSuccess: () => invalidate(),
    onError: (e: Error) => setError(e.message),
  });
  const auditMut = useMutation({
    mutationFn: () => publishAuditFor(invoice),
    onSuccess: (r) => {
      if (r) {
        setAuditSeq(r.seq);
        invalidate();
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const isTerminal = ["RELEASED", "REFUNDED", "EXPIRED"].includes(invoice.state);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Actions</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            acting as {actor}
          </span>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Transaction reverted</AlertTitle>
            <AlertDescription className="font-mono text-[11px]">{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 space-y-3">
          {invoice.state === "CREATED" && actor === "buyer" && !expired && (
            <>
              {!associated ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <p className="text-sm font-medium text-foreground">
                    Associate the receipt token
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The contract mints an HTS NFT to you on payment. You must
                    associate first or the pay call reverts with{" "}
                    <span className="font-mono">ReceiptNotAssociated</span>.
                  </p>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => assocMut.mutate()}
                    disabled={assocMut.isPending}
                  >
                    {assocMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Associate {`FXR`}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {quote && quote.accepted && (
                    <QuoteBreakdown quote={quote} />
                  )}
                  <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                    <Checkbox checked={buffer} onCheckedChange={(v) => setBuffer(Boolean(v))} />
                    <span>Pay with a 1% buffer to demonstrate the refund path</span>
                  </label>
                  <Button
                    className="w-full"
                    onClick={() => payMut.mutate()}
                    disabled={payMut.isPending || !quote?.accepted}
                  >
                    {payMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Pay {quote ? formatHbar(buffer ? ((BigInt(quote.totalWei) * 101n) / 100n).toString() : quote.totalWei) : ""}
                  </Button>
                  {buffer && (
                    <p className="text-[11px] text-muted-foreground">
                      Excess over the exact quote is refunded to you immediately.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {invoice.state === "CREATED" && actor === "seller" && !expired && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              Waiting for the buyer to pay. You cannot pay your own invoice.
            </div>
          )}

          {invoice.state === "PAID" && actor === "buyer" && (
            <>
              <p className="text-xs text-muted-foreground">
                The funds are held in escrow. Release them to the seller when the
                work is delivered.
              </p>
              <Button className="w-full" onClick={() => releaseMut.mutate()} disabled={releaseMut.isPending}>
                {releaseMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                Release funds
              </Button>
              {invoice.deliveryTs && deliveryPassed && (
                <Button variant="outline" className="w-full" onClick={() => claimRefundMut.mutate()} disabled={claimRefundMut.isPending}>
                  {claimRefundMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                  Claim refund (deadline passed)
                </Button>
              )}
            </>
          )}

          {invoice.state === "PAID" && actor === "seller" && (
            <>
              <Button className="w-full" onClick={() => refundMut.mutate()} disabled={refundMut.isPending}>
                {refundMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                Refund to buyer
              </Button>
              {reviewPassed ? (
                <Button variant="secondary" className="w-full" onClick={() => claimMut.mutate()} disabled={claimMut.isPending}>
                  {claimMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                  Claim after review
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  The review window ends {new Date(((invoice.paidAt ?? 0) + invoice.reviewSec) * 1000).toLocaleString()}.
                </p>
              )}
            </>
          )}

          {invoice.state === "CREATED" && expired && (
            <Button variant="outline" className="w-full" onClick={() => expireMut.mutate()} disabled={expireMut.isPending}>
              {expireMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Mark expired
            </Button>
          )}

          {isTerminal && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              This invoice is settled. No further on chain actions are available.
            </div>
          )}
        </div>
      </div>

      {!isTerminal && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Prove it on HCS</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Publish a signed audit message for the latest event to the HCS
                topic. Idempotent by transaction hash.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => auditMut.mutate()}
                disabled={auditMut.isPending}
              >
                {auditMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                Publish audit message
              </Button>
              {auditSeq !== null && (
                <p className="mt-2 text-[11px] text-success">
                  Published as sequence {auditSeq} on topic 0.0.5847294.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
