import { useMutationState } from "@tanstack/react-query";
import { useState } from "react";
import { localDay } from "../../../shared/lib/dates.ts";
import { t } from "../../../shared/lib/i18n.ts";
import { Badge } from "../../../shared/ui/Badge.tsx";
import { Button } from "../../../shared/ui/Button.tsx";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { Panel } from "../../../shared/ui/Panel.tsx";
import { selectRemainingCount, selectTags, selectVisibleTodos } from "../data/selectTodos.ts";
import { useCreateTodoMutation } from "../data/useCreateTodoMutation.ts";
import { useDeleteTodoMutation } from "../data/useDeleteTodoMutation.ts";
import {
  setTodoCompletedKey,
  useSetTodoCompletedMutation,
  type SetTodoCompletedVariables,
} from "../data/useSetTodoCompletedMutation.ts";
import {
  setTodoPinnedKey,
  useSetTodoPinnedMutation,
  type SetTodoPinnedVariables,
} from "../data/useSetTodoPinnedMutation.ts";
import { useSetTodoDueDateMutation } from "../data/useSetTodoDueDateMutation.ts";
import { useTodosQuery, type Todo } from "../data/useTodosQuery.ts";
import { TodoFilters } from "../ui/TodoFilters.tsx";
import { TodoForm } from "../ui/TodoForm.tsx";
import { TodoList } from "../ui/TodoList.tsx";
import styles from "./HomePage.module.css";

function HomePage() {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [isSortedByState, setIsSortedByState] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null);

  const todosQuery = useTodosQuery();
  const createTodo = useCreateTodoMutation();
  const setTodoCompleted = useSetTodoCompletedMutation();
  const setTodoPinned = useSetTodoPinnedMutation();
  const setTodoDueDate = useSetTodoDueDateMutation();
  const deleteTodo = useDeleteTodoMutation();
  // One useMutation only exposes its latest variables: every pending toggle comes from the cache.
  const pendingIds = useMutationState({
    filters: { mutationKey: setTodoCompletedKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as SetTodoCompletedVariables).id,
  });
  const pendingPinIds = useMutationState({
    filters: { mutationKey: setTodoPinnedKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as SetTodoPinnedVariables).id,
  });

  const todos = todosQuery.data ?? [];
  const tags = selectTags(todos);
  // The entry of `tags` matching the selection, so the dropdown shows the casing it offers.
  const activeTag =
    tag === null
      ? null
      : (tags.find((existing) => existing.toLocaleLowerCase("fr") === tag.toLocaleLowerCase("fr")) ?? null);
  // The last todo of the selected tag was deleted: back to every todo, for good.
  if (tag !== null && activeTag === null && todosQuery.isSuccess) setTag(null);
  const visible = selectVisibleTodos(todos, { search, tag: activeTag, isSortedByState });
  // Read at each render: the device's calendar day (BR-06).
  const today = localDay(new Date());

  function closeDeleteDialog() {
    // Cancel cannot stop a running delete: the dialog stays until it ends (FR-09).
    if (deleteTodo.isPending) return;
    deleteTodo.reset();
    setTodoToDelete(null);
  }

  return (
    <main className={styles.page}>
      <Panel>
        <div className={styles.heading}>
          <PageTitle>{t("home.title")}</PageTitle>
          {todosQuery.isSuccess && <Badge>{t("home.remaining", { count: String(selectRemainingCount(todos)) })}</Badge>}
        </div>
        <TodoForm
          tags={tags}
          isPending={createTodo.isPending}
          problem={createTodo.error}
          onSubmit={async (values) => {
            await createTodo.mutateAsync(values);
          }}
        />
        <TodoFilters
          search={search}
          tags={tags}
          tag={activeTag}
          isSortedByState={isSortedByState}
          onSearchChange={setSearch}
          onTagChange={setTag}
          onSortByStateChange={setIsSortedByState}
        />
        {todosQuery.isPending ? (
          <LoadingState>{t("home.list.loading")}</LoadingState>
        ) : todosQuery.isError ? (
          <div className={styles.listError}>
            <ErrorMessage>{t("home.list.error")}</ErrorMessage>
            <Button variant="quiet" onClick={() => void todosQuery.refetch()} disabled={todosQuery.isFetching}>
              {t("common.action.retry")}
            </Button>
          </div>
        ) : (
          <>
            {(setTodoCompleted.isError || setTodoPinned.isError) && <ErrorMessage>{t("common.error.generic")}</ErrorMessage>}
            {todos.length === 0 ? (
              <EmptyState>{t("home.list.empty")}</EmptyState>
            ) : visible.length === 0 ? (
              <EmptyState>{t("home.list.noMatch")}</EmptyState>
            ) : (
              <TodoList
                todos={visible}
                pendingIds={pendingIds}
                onToggleCompleted={(todo, isCompleted) => setTodoCompleted.mutate({ id: todo.id, isCompleted })}
                pendingPinIds={pendingPinIds}
                onTogglePinned={(todo, isPinned) => setTodoPinned.mutate({ id: todo.id, isPinned })}
                today={today}
                onSetDueDate={(todo, dueDate) =>
                  setTodoDueDate.mutateAsync({ id: todo.id, dueDate }).then(() => undefined)
                }
                onDelete={(todo) => {
                  deleteTodo.reset();
                  setTodoToDelete(todo);
                }}
              />
            )}
          </>
        )}
      </Panel>
      <ConfirmDialog
        isOpen={todoToDelete !== null}
        title={t("home.delete.title")}
        message={t("home.delete.message", { name: todoToDelete?.name ?? "" })}
        confirmLabel={t("home.delete.confirm")}
        cancelLabel={t("home.delete.cancel")}
        isPending={deleteTodo.isPending}
        error={deleteTodo.isError ? t("common.error.generic") : null}
        onConfirm={() => {
          if (todoToDelete === null || deleteTodo.isPending) return;
          deleteTodo.mutate({ id: todoToDelete.id }, { onSuccess: () => setTodoToDelete(null) });
        }}
        onCancel={closeDeleteDialog}
      />
    </main>
  );
}

export { HomePage as Component };
