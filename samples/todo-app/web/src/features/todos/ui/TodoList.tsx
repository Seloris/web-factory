import type { Todo } from "../data/useTodosQuery.ts";
import { TodoItem } from "./TodoItem.tsx";
import styles from "./TodoList.module.css";

export function TodoList({
  todos,
  pendingIds,
  onToggleCompleted,
  onDelete,
}: {
  todos: Todo[];
  pendingIds: number[];
  onToggleCompleted(todo: Todo, isCompleted: boolean): void;
  onDelete(todo: Todo): void;
}) {
  return (
    <ul className={styles.list}>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          isPending={pendingIds.includes(todo.id)}
          onToggleCompleted={(isCompleted) => onToggleCompleted(todo, isCompleted)}
          onDelete={() => onDelete(todo)}
        />
      ))}
    </ul>
  );
}
