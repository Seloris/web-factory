import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import type { Todo } from "./todos.schema.js";
import { todos, type TodoRow } from "./todos.table.js";

const todoColumns = {
  id: todos.id,
  name: todos.name,
  tag: todos.tag,
  isCompleted: todos.isCompleted,
  isPinned: todos.isPinned,
  dueDate: todos.dueDate,
  createdAt: todos.createdAt,
};

function toTodo(row: Pick<TodoRow, keyof typeof todoColumns>): Todo {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export function createTodoRepository(db: Database) {
  return {
    async list(): Promise<Todo[]> {
      const rows = await db.select(todoColumns).from(todos).orderBy(desc(todos.createdAt), desc(todos.id));
      return rows.map(toTodo);
    },

    async findTagIgnoringCase(tag: string): Promise<string | null> {
      // Raw on purpose: Drizzle has no case-insensitive equality, and ilike would read % and _ in a tag as wildcards.
      const [row] = await db
        .select({ tag: todos.tag })
        .from(todos)
        .where(sql`lower(${todos.tag}) = lower(${tag})`)
        .limit(1);
      return row?.tag ?? null;
    },

    async insert(row: { name: string; tag: string | null; dueDate: string | null; createdAt: Date }): Promise<Todo> {
      const [inserted] = await db.insert(todos).values(row).returning(todoColumns);
      if (inserted === undefined) throw new Error("insert into todos returned no row");
      return toTodo(inserted);
    },

    async setCompleted(id: number, isCompleted: boolean): Promise<Todo | null> {
      const [updated] = await db.update(todos).set({ isCompleted }).where(eq(todos.id, id)).returning(todoColumns);
      return updated === undefined ? null : toTodo(updated);
    },

    async setPinned(id: number, isPinned: boolean): Promise<Todo | null> {
      const [updated] = await db.update(todos).set({ isPinned }).where(eq(todos.id, id)).returning(todoColumns);
      return updated === undefined ? null : toTodo(updated);
    },

    async setDueDate(id: number, dueDate: string | null): Promise<Todo | null> {
      const [updated] = await db.update(todos).set({ dueDate }).where(eq(todos.id, id)).returning(todoColumns);
      return updated === undefined ? null : toTodo(updated);
    },

    async remove(id: number): Promise<boolean> {
      const deleted = await db.delete(todos).where(eq(todos.id, id)).returning({ id: todos.id });
      return deleted.length > 0;
    },
  };
}

export type TodoRepository = ReturnType<typeof createTodoRepository>;
