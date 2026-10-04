"use client";

import Link from "next/link";
import { shortHash } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

export function HashBadge({
  hash,
  href,
  className,
  mono = true,
}: {
  hash: string;
  href?: string;
  className?: string;
  mono?: boolean;
}) {
  const display = shortHash(hash);
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs tabular-nums text-foreground",
        mono && "font-mono",
        className
      )}
    >
      {display}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {href ? (
        <Link href={href} className="rounded transition-opacity hover:opacity-80">
          {content}
        </Link>
      ) : (
        content
      )}
      <CopyButton value={hash} label="hash" />
    </span>
  );
}
