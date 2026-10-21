import type { ComponentProps } from "react";
import styles from "./DateInput.module.css";

export function DateInput(props: Omit<ComponentProps<"input">, "className" | "type">) {
  return <input className={styles.input} type="date" {...props} />;
}
