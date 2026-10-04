import { cn } from "@/lib/utils";

const BRASS = "#C9A24B";

/**
 * Fixpoint mark. A fixed central node is the locked dollar price. The orbit
 * is the settlement path, completed in brass. Three satellites stand for the
 * three composed services: escrow contract, HTS receipt, HCS audit.
 * Structure renders in currentColor so contrast follows the theme.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.8" opacity="0.35" />
      <path
        d="M16 5.5 A10.5 10.5 0 0 1 26.5 16"
        stroke={BRASS}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M16 16 L8.4 21.2 M16 16 L22.6 9.6 M16 16 L23.6 19.4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
      <circle cx="16" cy="16" r="3.2" fill="currentColor" />
      <circle cx="8.4" cy="21.2" r="1.7" fill="currentColor" />
      <circle cx="22.6" cy="9.6" r="1.7" fill="currentColor" />
      <circle cx="23.6" cy="19.4" r="1.7" fill={BRASS} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-primary">
        <LogoMark size={24} />
      </span>
      <span className="font-display text-[1.15rem] font-medium tracking-tight text-foreground">
        Fixpoint
      </span>
    </span>
  );
}
