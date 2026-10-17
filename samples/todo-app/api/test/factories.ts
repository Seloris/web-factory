import type { NewTodoRow } from "../src/features/todos/todos.table.js";

// One `build{Entity}(overrides)` per entity: the only way a test builds a row.
export function buildTodo(overrides: Partial<NewTodoRow> = {}): NewTodoRow {
  return {
    name: "Buy milk",
    tag: null,
    isCompleted: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
