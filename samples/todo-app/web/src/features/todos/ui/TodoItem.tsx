import { t } from "../../../shared/lib/i18n.ts";
import { Badge } from "../../../shared/ui/Badge.tsx";
import { Button } from "../../../shared/ui/Button.tsx";
import { Checkbox } from "../../../shared/ui/Checkbox.tsx";
import { PinIcon, TrashIcon } from "../../../shared/ui/icons.tsx";
import { ListItem, ListItemText } from "../../../shared/ui/List.tsx";
import type { Todo } from "../data/useTodosQuery.ts";

export function TodoItem({
  todo,
  isPending,
  isPinPending,
  onToggleCompleted,
  onTogglePinned,
  onDelete,
}: {
  todo: Todo;
  isPending: boolean;
  isPinPending: boolean;
  onToggleCompleted(isCompleted: boolean): void;
  onTogglePinned(isPinned: boolean): void;
  onDelete(): void;
}) {
  return (
    <ListItem isDone={todo.isCompleted} isPinned={todo.isPinned}>
      <Checkbox
        checked={todo.isCompleted}
        disabled={isPending}
        aria-label={t("home.item.toggle", { name: todo.name })}
        onChange={(event) => onToggleCompleted(event.target.checked)}
      />
      <ListItemText>{todo.name}</ListItemText>
      {todo.tag !== null && <Badge>{todo.tag}</Badge>}
      <Button
        variant="subtle"
        aria-pressed={todo.isPinned}
        disabled={isPinPending}
        onClick={() => onTogglePinned(!todo.isPinned)}
      >
        <PinIcon />
        {t("home.item.pin")}
      </Button>
      <Button variant="ghost" onClick={onDelete}>
        <TrashIcon />
        {t("home.item.delete")}
      </Button>
    </ListItem>
  );
}
