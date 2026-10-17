import { List } from "../../../shared/ui/List.tsx";
import type { Todo } from "../data/useTodosQuery.ts";
import { TodoItem } from "./TodoItem.tsx";

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
    <List>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          isPending={pendingIds.includes(todo.id)}
          onToggleCompleted={(isCompleted) => onToggleCompleted(todo, isCompleted)}
          onDelete={() => onDelete(todo)}
        />
      ))}
    </List>
  );
}
