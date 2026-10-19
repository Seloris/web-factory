import { List } from "../../../shared/ui/List.tsx";
import type { Todo } from "../data/useTodosQuery.ts";
import { TodoItem } from "./TodoItem.tsx";

export function TodoList({
  todos,
  pendingIds,
  pendingPinIds,
  onToggleCompleted,
  onTogglePinned,
  onDelete,
}: {
  todos: Todo[];
  pendingIds: number[];
  pendingPinIds: number[];
  onToggleCompleted(todo: Todo, isCompleted: boolean): void;
  onTogglePinned(todo: Todo, isPinned: boolean): void;
  onDelete(todo: Todo): void;
}) {
  return (
    <List>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          isPending={pendingIds.includes(todo.id)}
          isPinPending={pendingPinIds.includes(todo.id)}
          onToggleCompleted={(isCompleted) => onToggleCompleted(todo, isCompleted)}
          onTogglePinned={(isPinned) => onTogglePinned(todo, isPinned)}
          onDelete={() => onDelete(todo)}
        />
      ))}
    </List>
  );
}
