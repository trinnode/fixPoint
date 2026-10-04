import { CHAIN_ID, CHAIN_NAME } from "@/lib/hedera";
import styles from "./fx.module.css";

const FACTS: string[] = [
  `Network · ${CHAIN_NAME}`,
  `Chain ID · ${CHAIN_ID}`,
  "Oracle · Pyth Hermes",
  "Services · EVM / HTS / HCS",
];

/**
 * Slim marquee of live chain facts. Pure CSS animation, pauses on hover, and
 * goes static under prefers-reduced-motion. The duplicated row is aria-hidden
 * so screen readers hear each fact exactly once.
 */
export function ChainRibbon() {
  return (
    <div className={styles.ribbon}>
      <div className={styles.ribbonTrack}>
        <ul className={styles.ribbonRow}>
          {FACTS.map((f) => (
            <li key={f}>
              {f} <span className={styles.dot} aria-hidden="true"> ·</span>
            </li>
          ))}
        </ul>
        <ul className={styles.ribbonRow} aria-hidden="true">
          {FACTS.map((f) => (
            <li key={f}>
              {f} <span className={styles.dot}> ·</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
