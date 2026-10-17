import type { Todo } from "./useTodosQuery.ts";

const fold = (text: string) => text.toLocaleLowerCase("fr");

// Distinct tags ignoring case, first-seen casing kept, sorted alphabetically.
export function selectTags(todos: Todo[]): string[] {
  const byFolded = new Map<string, string>();
  for (const { tag } of todos) {
    if (tag !== null && !byFolded.has(fold(tag))) byFolded.set(fold(tag), tag);
  }
  return [...byFolded.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export function selectVisibleTodos(
  todos: Todo[],
  view: { search: string; tag: string | null; isSortedByState: boolean },
): Todo[] {
  const search = fold(view.search.trim());
  const tag = view.tag === null ? null : fold(view.tag);
  const visible = todos.filter(
    (todo) =>
      fold(todo.name).includes(search) && (tag === null || (todo.tag !== null && fold(todo.tag) === tag)),
  );
  // Stable sort: the API's newest-first order stays within each state.
  return view.isSortedByState
    ? visible.toSorted((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
    : visible;
}
