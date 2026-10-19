import type { ReactNode } from "react";
import styles from "./List.module.css";

export function List({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

export function ListItem({
  isDone = false,
  isPinned = false,
  children,
}: {
  isDone?: boolean;
  isPinned?: boolean;
  children: ReactNode;
}) {
  const className = [styles.item, isDone && styles.isDone, isPinned && styles.isPinned].filter(Boolean).join(" ");
  return <li className={className}>{children}</li>;
}

export function ListItemText({ children }: { children: ReactNode }) {
  return <span className={styles.itemText}>{children}</span>;
}
