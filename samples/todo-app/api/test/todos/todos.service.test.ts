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

  it("creates the todo not completed, not pinned and without a due date, at the clock's time", async () => {
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
      isPinned: false,
      dueDate: null,
      createdAt: "2026-10-17T08:30:00.000Z",
    });
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.createdAt.toISOString()).toBe("2026-10-17T08:30:00.000Z");
    expect(row?.isPinned).toBe(false);
    expect(row?.dueDate).toBeNull();
  });

  it("creates a todo with a due date, stored as the exact day", async () => {
    // Act
    const todo = await service.createTodo({ name: "Pay rent", dueDate: "2026-10-24" });

    // Assert
    expect(todo.dueDate).toBe("2026-10-24");
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.dueDate).toBe("2026-10-24");
  });

  it("creates a todo due before the clock's day", async () => {
    // Arrange
    ctx.clock.set("2026-10-17T08:30:00.000Z");

    // Act
    const todo = await service.createTodo({ name: "Pay rent", dueDate: "2026-10-01" });

    // Assert
    expect(todo.dueDate).toBe("2026-10-01");
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row?.dueDate).toBe("2026-10-01");
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

  it("pins a todo, then unpins it", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy milk" });
    const id = seeded?.id ?? 999999;

    // Act
    const pinned = await service.setTodoPinned(id, true);
    const isPinnedAfterFirst = (await ctx.db.select().from(todos).where(eq(todos.id, id)))[0]?.isPinned;
    const unpinned = await service.setTodoPinned(id, false);

    // Assert
    expect(pinned).toMatchObject({ id, name: "Buy milk", isPinned: true });
    expect(isPinnedAfterFirst).toBe(true);
    expect(unpinned).toMatchObject({ id, isPinned: false });
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, id));
    expect(row?.isPinned).toBe(false);
  });

  it("keeps a pinned todo pinned when marking it completed, then back to not completed", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy milk", isPinned: true });
    const id = seeded?.id ?? 999999;

    // Act
    const completed = await service.setTodoCompleted(id, true);
    const reopened = await service.setTodoCompleted(id, false);

    // Assert
    expect(completed).toMatchObject({ id, isCompleted: true, isPinned: true });
    expect(reopened).toMatchObject({ id, isCompleted: false, isPinned: true });
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, id));
    expect(row).toMatchObject({ isCompleted: false, isPinned: true });
  });

  it("throws NotFoundError when pinning an unknown todo", async () => {
    // Act
    const act = service.setTodoPinned(999999, true);

    // Assert
    await expect(act).rejects.toBeInstanceOf(NotFoundError);
  });

  it("sets a todo's due date, changes it, then clears it", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy milk" });
    const id = seeded?.id ?? 999999;

    // Act
    const set = await service.setTodoDueDate(id, "2026-10-24");
    const dueDateAfterSet = (await ctx.db.select().from(todos).where(eq(todos.id, id)))[0]?.dueDate;
    const changed = await service.setTodoDueDate(id, "2026-11-02");
    const dueDateAfterChange = (await ctx.db.select().from(todos).where(eq(todos.id, id)))[0]?.dueDate;
    const cleared = await service.setTodoDueDate(id, null);

    // Assert
    expect(set).toMatchObject({ id, name: "Buy milk", dueDate: "2026-10-24" });
    expect(dueDateAfterSet).toBe("2026-10-24");
    expect(changed.dueDate).toBe("2026-11-02");
    expect(dueDateAfterChange).toBe("2026-11-02");
    expect(cleared.dueDate).toBeNull();
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, id));
    expect(row?.dueDate).toBeNull();
  });

  it("keeps the due date when marking the todo completed or pinning it", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy milk", dueDate: "2026-10-24" });
    const id = seeded?.id ?? 999999;

    // Act
    const completed = await service.setTodoCompleted(id, true);
    const pinned = await service.setTodoPinned(id, true);

    // Assert
    expect(completed.dueDate).toBe("2026-10-24");
    expect(pinned.dueDate).toBe("2026-10-24");
    const [row] = await ctx.db.select().from(todos).where(eq(todos.id, id));
    expect(row).toMatchObject({ isCompleted: true, isPinned: true, dueDate: "2026-10-24" });
  });

  it("throws NotFoundError when setting the due date of an unknown todo", async () => {
    // Act
    const act = service.setTodoDueDate(999999, "2026-10-24");

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
