import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  tag: varchar({ length: 30 }),
  isCompleted: boolean().notNull().default(false),
  // No database default: the service sets it from the clock.
  createdAt: timestamp({ withTimezone: true }).notNull(),
});

export type TodoRow = typeof todos.$inferSelect;
export type NewTodoRow = typeof todos.$inferInsert;
