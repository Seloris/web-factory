import { useState } from "react";
import { formatDay } from "../../../shared/lib/dates.ts";
import { t } from "../../../shared/lib/i18n.ts";
import { Badge } from "../../../shared/ui/Badge.tsx";
import { Button } from "../../../shared/ui/Button.tsx";
import { Checkbox } from "../../../shared/ui/Checkbox.tsx";
import { CalendarIcon, PinIcon, TrashIcon } from "../../../shared/ui/icons.tsx";
import { ListItem, ListItemText } from "../../../shared/ui/List.tsx";
import { isOverdue } from "../data/selectTodos.ts";
import type { Todo } from "../data/useTodosQuery.ts";
import styles from "./TodoItem.module.css";
import { TodoDueDateForm } from "./TodoDueDateForm.tsx";

export function TodoItem({
  todo,
  today,
  isPending,
  isPinPending,
  onToggleCompleted,
  onTogglePinned,
  onSetDueDate,
  onDelete,
}: {
  todo: Todo;
  today: string;
  isPending: boolean;
  isPinPending: boolean;
  onToggleCompleted(isCompleted: boolean): void;
  onTogglePinned(isPinned: boolean): void;
  onSetDueDate(dueDate: string | null): Promise<void>;
  onDelete(): void;
}) {
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);

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
      {todo.dueDate !== null && (
        <span className={styles.dueDate}>
          <CalendarIcon />
          <time dateTime={todo.dueDate}>{formatDay(todo.dueDate)}</time>
        </span>
      )}
      {isOverdue(todo, today) && <Badge tone="danger">{t("home.item.overdue")}</Badge>}
      <Button variant="subtle" aria-expanded={isEditingDueDate} onClick={() => setIsEditingDueDate(!isEditingDueDate)}>
        <CalendarIcon />
        {t("home.item.dueDate")}
      </Button>
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
      {isEditingDueDate && (
        <TodoDueDateForm
          todoName={todo.name}
          dueDate={todo.dueDate}
          onSubmit={onSetDueDate}
          onClose={() => setIsEditingDueDate(false)}
        />
      )}
    </ListItem>
  );
}
