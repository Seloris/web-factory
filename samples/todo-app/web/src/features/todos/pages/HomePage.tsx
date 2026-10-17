import { useMutationState } from "@tanstack/react-query";
import { useState } from "react";
import { t } from "../../../shared/lib/i18n.ts";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog.tsx";
import { selectTags, selectVisibleTodos } from "../data/selectTodos.ts";
import { useCreateTodoMutation } from "../data/useCreateTodoMutation.ts";
import { useDeleteTodoMutation } from "../data/useDeleteTodoMutation.ts";
import {
  setTodoCompletedKey,
  useSetTodoCompletedMutation,
  type SetTodoCompletedVariables,
} from "../data/useSetTodoCompletedMutation.ts";
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
  const deleteTodo = useDeleteTodoMutation();
  // One useMutation only exposes its latest variables: every pending toggle comes from the cache.
  const pendingIds = useMutationState({
    filters: { mutationKey: setTodoCompletedKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as SetTodoCompletedVariables).id,
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

  function closeDeleteDialog() {
    // Cancel cannot stop a running delete: the dialog stays until it ends (FR-09).
    if (deleteTodo.isPending) return;
    deleteTodo.reset();
    setTodoToDelete(null);
  }

  return (
    <main className={styles.page}>
      <h1>{t("home.title")}</h1>
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
        <p>{t("home.list.loading")}</p>
      ) : todosQuery.isError ? (
        <p role="alert" className={styles.error}>
          {t("home.list.error")}
        </p>
      ) : (
        <>
          {setTodoCompleted.isError && (
            <p role="alert" className={styles.error}>
              {t("common.error.generic")}
            </p>
          )}
          {todos.length === 0 ? (
            <p>{t("home.list.empty")}</p>
          ) : visible.length === 0 ? (
            <p>{t("home.list.noMatch")}</p>
          ) : (
            <TodoList
              todos={visible}
              pendingIds={pendingIds}
              onToggleCompleted={(todo, isCompleted) => setTodoCompleted.mutate({ id: todo.id, isCompleted })}
              onDelete={(todo) => {
                deleteTodo.reset();
                setTodoToDelete(todo);
              }}
            />
          )}
        </>
      )}
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
