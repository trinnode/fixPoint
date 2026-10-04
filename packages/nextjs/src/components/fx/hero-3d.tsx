"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./fx.module.css";

// Client-only canvas: never evaluated during SSR, so `next build` stays safe.
const HeroScene = dynamic(() => import("./hero-scene"), {
  ssr: false,
  loading: () => <div className={styles.sceneFallback} aria-hidden="true" />,
});

type Hero3DProps = {
  /** Headline, subcopy and CTA buttons. */
  children: ReactNode;
  /** Price card / stats side, rendered inside the glass panel. */
  side?: ReactNode;
  className?: string;
};

/**
 * Dark deep-space hero section. The three.js canvas is background only
 * (aria-hidden, never focusable); all interactive content stays in the normal
 * tab order with visible focus styles.
 */
export function Hero3D({ children, side, className }: Hero3DProps) {
  return (
    <section className={cn(styles.hero, className)}>
      <div className={styles.scene} aria-hidden="true">
        <HeroScene />
      </div>
      <div className={styles.heroInner}>
        <div>{children}</div>
        {side ? <div className={styles.glass}>{side}</div> : null}
      </div>
    </section>
  );
}
