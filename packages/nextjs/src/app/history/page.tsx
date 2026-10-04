"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type HistoryRow } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HashBadge } from "@/components/hash-badge";
import { AddressChip } from "@/components/address-chip";
import { formatHbar, relTime } from "@/lib/format";
import { hashscanUrl, shortAddr } from "@/lib/hedera";
import { BadgeCheck, ShieldCheck, Loader2, RefreshCw, Search } from "lucide-react";

const kindLabel: Record<string, string> = {
  Created: "Created",
  Paid: "Paid",
  Released: "Released",
  Refunded: "Refunded",
  Expired: "Expired",
  RefundClaimed: "Refund claimed",
};

export default function HistoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("events");

  const q = useQuery({
    queryKey: ["history"],
    queryFn: api.history,
    refetchInterval: 10_000,
  });

  const publishMut = useMutation({
    mutationFn: (txHash: string) => api.audit(txHash),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  const data = q.data;

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return data.events;
    return data.events.filter(
      (e) =>
        String(e.invoiceNumericId).includes(f) ||
        e.txHash.toLowerCase().includes(f) ||
        e.kind.toLowerCase().includes(f)
    );
  }, [data, filter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
            Ledger of record
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Rebuilt from the mirror node contract logs, with the HCS audit
            topic alongside it. Rows where the chain event and the audit message
            agree are marked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["history"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      {data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Chain events" value={data.totalCount} />
          <Stat label="Audited on HCS" value={data.agreedCount} accent="success" />
          <Stat label="Audit topic" value={data.topicId} mono />
        </div>
      )}

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by invoice, event or hash"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Could not load history.</p>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="events">Mirror node ({data.events.length})</TabsTrigger>
            <TabsTrigger value="audit">HCS topic ({data.audit.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {filteredEvents.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto scroll-quiet">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">When</th>
                        <th className="px-4 py-3 font-medium">Invoice</th>
                        <th className="px-4 py-3 font-medium">Event</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">To</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Tx hash</th>
                        <th className="px-4 py-3 font-medium text-center">HCS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((e) => (
                        <EventRow key={e.id} row={e} onPublish={publishMut.mutate} publishing={publishMut.isPending} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {data.audit.length === 0 ? (
                <EmptyState message="No audit messages yet. Publish one from an invoice or from the table above." />
              ) : (
                <div className="divide-y divide-border">
                  {data.audit.map((a) => (
                    <AuditRowView key={a.id} seq={a.seq} payload={a.payload} txHash={a.txHash} sig={a.sig} createdAt={a.createdAt} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EventRow({
  row,
  onPublish,
  publishing,
}: {
  row: HistoryRow;
  onPublish: (tx: string) => void;
  publishing: boolean;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground tabular-nums">
        {new Date(row.blockTs * 1000).toLocaleString()}
        <div className="text-[10px]">{relTime(row.blockTs)}</div>
      </td>
      <td className="px-4 py-3">
        <Link href={`/invoices/${row.invoiceId}`} className="font-medium text-primary hover:underline tabular-nums">
          #{row.invoiceNumericId}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="text-foreground">{kindLabel[row.kind] ?? row.kind}</span>
      </td>
      <td className="px-4 py-3">
        <AddressChip address={row.actor} />
      </td>
      <td className="px-4 py-3">
        <AddressChip address={row.counter} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-foreground">
        {row.amountWei && row.amountWei !== "0" ? formatHbar(row.amountWei) : "—"}
      </td>
      <td className="px-4 py-3">
        <HashBadge hash={row.txHash} href={hashscanUrl(`transactions/${row.txHash}`)} />
      </td>
      <td className="px-4 py-3 text-center">
        {row.audited ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success" title={`Audit seq ${row.auditSeq}`}>
            <BadgeCheck className="h-4 w-4" /> #{row.auditSeq}
          </span>
        ) : (
          <button
            onClick={() => onPublish(row.txHash)}
            disabled={publishing}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            title="Publish a signed audit message for this transaction"
          >
            {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Audit
          </button>
        )}
      </td>
    </tr>
  );
}

function AuditRowView({
  seq,
  payload,
  txHash,
  sig,
  createdAt,
}: {
  seq: number;
  payload: string;
  txHash: string;
  sig: string;
  createdAt: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">seq</span>
          <span className="font-mono text-sm font-medium text-foreground tabular-nums">{seq}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{new Date(createdAt * 1000).toLocaleString()}</span>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-border px-2 py-0.5 hover:bg-secondary"
          >
            {open ? "hide" : "show"} payload
          </button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>for tx</span>
        <HashBadge hash={txHash} href={hashscanUrl(`transactions/${txHash}`)} />
        <span>signed</span>
        <span className="font-mono text-[10px]">{shortAddr(sig)}</span>
      </div>
      {open && (
        <pre className="mt-2 max-h-48 overflow-auto scroll-quiet rounded-lg border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed">
          {JSON.stringify(JSON.parse(payload), null, 2)}
        </pre>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string | number;
  accent?: "success";
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-medium tabular-nums ${mono ? "font-mono text-base" : ""} ${accent === "success" ? "text-success" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {message ?? "No events yet. Create an invoice to begin the ledger."}
      </p>
    </div>
  );
}
