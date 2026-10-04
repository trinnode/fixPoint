"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LiveCreatePanel } from "@/components/live-create-panel";
import { QuoteBreakdown } from "@/components/quote-breakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

const reviewOptions = [
  { value: "3600", label: "1 hour" },
  { value: "21600", label: "6 hours" },
  { value: "86400", label: "24 hours" },
  { value: "604800", label: "7 days" },
  { value: "0", label: "No review window" },
];

function toLocalInputValue(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [amount, setAmount] = useState("25.00");
  const [payBy, setPayBy] = useState(() =>
    toLocalInputValue(Math.floor(Date.now() / 1000) + 86_400)
  );
  const [reviewSec, setReviewSec] = useState("86400");
  const [delivery, setDelivery] = useState("");
  const [memo, setMemo] = useState("Consulting work, March invoice");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const usdCents = useMemo(() => {
    const n = Math.round(parseFloat(amount) * 100);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);
  const debouncedCents = useDebounced(usdCents, 250);

  const quoteQ = useQuery({
    queryKey: ["quote", debouncedCents],
    queryFn: () => api.quote(debouncedCents),
    enabled: debouncedCents > 0,
    staleTime: 5_000,
  });
  const quote = quoteQ.data ?? null;
  const quoteError = quoteQ.isError ? (quoteQ.error as Error).message : null;
  const quoteLoading = quoteQ.isFetching;

  const liveProps = useMemo(() => {
    const cents = Math.round(parseFloat(amount) * 100);
    const payByTs = payBy ? Math.floor(new Date(payBy).getTime() / 1000) : 0;
    const valid =
      Number.isFinite(cents) &&
      cents > 0 &&
      cents <= 100_000_000 &&
      payByTs > Math.floor(Date.now() / 1000);
    return { usdCents: cents, payByTs, reviewSec: Number(reviewSec), valid };
  }, [amount, payBy, reviewSec]);

  const create = useMutation({
    mutationFn: () => {
      const usdCentsVal = Math.round(parseFloat(amount) * 100);
      const payByTs = Math.floor(new Date(payBy).getTime() / 1000);
      const reviewSecNum = Number(reviewSec);
      const deliveryTs = delivery ? Math.floor(new Date(delivery).getTime() / 1000) : null;
      return api.createInvoice({
        usdCents: usdCentsVal,
        payByTs,
        reviewSec: reviewSecNum,
        deliveryTs,
        memo,
      });
    },
    onSuccess: (data) => {
      toast.success("Invoice created on chain");
      router.push(`/invoices/${data.invoice.id}`);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not create invoice");
    },
  });

  function validate(): boolean {
    const e: Record<string, string> = {};
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) e.amount = "Enter an amount greater than zero";
    if (cents > 100_000_000) e.amount = "Amount exceeds the $1,000,000 demo limit";
    if (!payBy) e.payBy = "Pick a pay by date";
    else if (Math.floor(new Date(payBy).getTime() / 1000) <= Math.floor(Date.now() / 1000)) {
      e.payBy = "Pay by date must be in the future";
    }
    if (delivery) {
      const d = Math.floor(new Date(delivery).getTime() / 1000);
      const p = Math.floor(new Date(payBy).getTime() / 1000);
      if (d <= p) e.delivery = "Delivery deadline must be after the pay by date";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <ol className="mb-5 flex flex-wrap items-center gap-2" aria-label="Progress">
          {["1 Invoice details", "2 Pay at rate", "3 Settle and prove"].map((s, i) => (
            <li
              key={s}
              className={
                i === 0
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : "rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
              }
              aria-current={i === 0 ? "step" : undefined}
            >
              {s}
            </li>
          ))}
        </ol>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          New invoice
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
          Price in dollars
        </h1>
        <p className="mt-2 text-sm font-medium text-foreground">
          Takes about a minute. The buyer pays next.
        </p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The seller sets a price in cents, a pay by date and a review window.
          The buyer will pay HBAR at the live Pyth rate shown here.
        </p>
      </header>

      <LiveCreatePanel
        usdCents={liveProps.usdCents}
        payByTs={liveProps.payByTs}
        reviewSec={liveProps.reviewSec}
        memo={memo}
        formValid={liveProps.valid}
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            create.mutate();
          }}
          className="space-y-6 rounded-2xl border border-border bg-card p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 tabular-nums"
                aria-invalid={Boolean(errors.amount)}
              />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            <p className="text-[11px] text-muted-foreground">
              Stored as {usdCents > 0 ? usdCents.toLocaleString() : "…"} cents.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payBy">Pay by</Label>
              <Input
                id="payBy"
                type="datetime-local"
                value={payBy}
                onChange={(e) => setPayBy(e.target.value)}
                aria-invalid={Boolean(errors.payBy)}
              />
              {errors.payBy && <p className="text-xs text-destructive">{errors.payBy}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="review">Review window</Label>
              <Select value={reviewSec} onValueChange={setReviewSec}>
                <SelectTrigger id="review">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reviewOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Seller can claim after this window if the buyer does not release.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery">Delivery deadline (optional)</Label>
            <Input
              id="delivery"
              type="datetime-local"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              aria-invalid={Boolean(errors.delivery)}
            />
            {errors.delivery && <p className="text-xs text-destructive">{errors.delivery}</p>}
            <p className="text-[11px] text-muted-foreground">
              If set, the buyer can claim a refund after this deadline passes.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">Memo</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="What is this invoice for?"
            />
            <p className="text-[11px] text-muted-foreground">
              Hashed to the invoice metadata. Stored on chain as a reference.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              You are acting as the seller.
            </p>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
                </>
              ) : (
                <>
                  Create invoice <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Live quote</h2>
              <span className="text-[11px] text-muted-foreground">
                {quoteLoading ? "refreshing…" : quote ? `via ${quote.source}` : "…"}
              </span>
            </div>
            {quoteError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {quoteError}
              </div>
            ) : quote ? (
              <QuoteBreakdown quote={quote} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter an amount to see the exact HBAR the buyer must send, with
                the Pyth price checks the contract will run.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
