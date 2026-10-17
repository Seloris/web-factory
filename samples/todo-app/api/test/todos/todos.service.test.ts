import { eq, inArray } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTodoRepository } from "../../src/features/todos/todos.repository.js";
import { createTodoService, type TodoService } from "../../src/features/todos/todos.service.js";
import { todos } from "../../src/features/todos/todos.table.js";
import { NotFoundError } from "../../src/shared/errors.js";
import { createTestContext } from "../setup.js";

describe("TodoService", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let service: TodoService;

  beforeAll(async () => {
    ctx = await createTestContext();
    service = createTodoService({ todos: createTodoRepository(ctx.db), clock: ctx.clock });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("creates the todo not completed, at the clock's time", async () => {
    // Arrange
    ctx.clock.set("2026-10-17T08:30:00.000Z");

    // Act
    const todo = await service.createTodo({ name: "Buy milk" });

    // Assert
    expect(todo).toEqual({
      id: todo.id,
      name: "Buy milk",
      tag: null,
      isCompleted: false,
      createdAt: "2026-10-17T08:30:00.000Z",
    });
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.createdAt.toISOString()).toBe("2026-10-17T08:30:00.000Z");
  });

  it("reuses the casing of an existing tag typed with another casing", async () => {
    // Arrange
    await ctx.seed.todos({ tag: "Urgent" });

    // Act
    const todo = await service.createTodo({ name: "Call Paul", tag: "uRGENT" });

    // Assert
    expect(todo.tag).toBe("Urgent");
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.tag).toBe("Urgent");
  });

  it("keeps the typed casing when no todo carries the tag", async () => {
    // Arrange
    await ctx.seed.todos({ tag: "Groceries" });

    // Act
    const todo = await service.createTodo({ name: "Call Paul", tag: "urgent" });

    // Assert
    expect(todo.tag).toBe("urgent");
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.tag).toBe("urgent");
  });

  it.each([
    { label: "empty", tag: "" },
    { label: "absent", tag: undefined },
    { label: "null", tag: null },
  ])("stores no tag when the tag is $label", async ({ tag }) => {
    // Act
    const todo = await service.createTodo({ name: "Buy milk", tag });

    // Assert
    expect(todo.tag).toBeNull();
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.tag).toBeNull();
  });

  it("trims the tag before comparing and storing it", async () => {
    // Arrange
    await ctx.seed.todos({ tag: "Urgent" });

    // Act
    const reused = await service.createTodo({ name: "Call Paul", tag: "  urgent  " });
    const created = await service.createTodo({ name: "Buy milk", tag: "  Groceries " });

    // Assert
    expect(reused.tag).toBe("Urgent");
    expect(created.tag).toBe("Groceries");
    const rows = await ctx.db.select().from(todos).where(inArray(todos.id, [reused.id, created.id]));
    expect(rows.map((row) => row.tag).sort()).toEqual(["Groceries", "Urgent"]);
  });

  it("throws NotFoundError when marking an unknown todo completed", async () => {
    // Act
    const act = service.setTodoCompleted(999999, true);

    // Assert
    await expect(act).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when deleting an unknown todo", async () => {
    // Act
    const act = service.deleteTodo(999999);

    // Assert
    await expect(act).rejects.toBeInstanceOf(NotFoundError);
  });
});
