import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export function Badge({ tone = "accent", children }: { tone?: "accent" | "danger"; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
