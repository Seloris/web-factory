import { t } from "../../../shared/lib/i18n.ts";
import type { Todo } from "../data/useTodosQuery.ts";
import styles from "./TodoItem.module.css";

export function TodoItem({
  todo,
  isPending,
  onToggleCompleted,
  onDelete,
}: {
  todo: Todo;
  isPending: boolean;
  onToggleCompleted(isCompleted: boolean): void;
  onDelete(): void;
}) {
  return (
    <li className={styles.item}>
      <input
        type="checkbox"
        checked={todo.isCompleted}
        disabled={isPending}
        aria-label={t("home.item.toggle", { name: todo.name })}
        onChange={(event) => onToggleCompleted(event.target.checked)}
      />
      <span className={todo.isCompleted ? `${styles.name} ${styles.completed}` : styles.name}>{todo.name}</span>
      {todo.tag !== null && <span className={styles.tag}>{todo.tag}</span>}
      <button type="button" className={styles.delete} onClick={onDelete}>
        {t("home.item.delete")}
      </button>
    </li>
  );
}
