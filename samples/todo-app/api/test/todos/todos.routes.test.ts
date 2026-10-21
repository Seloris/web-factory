import { eq } from "drizzle-orm";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { todoListSchema, todoSchema } from "../../src/features/todos/todos.schema.js";
import { todos } from "../../src/features/todos/todos.table.js";
import { problemDetailsSchema } from "../../src/shared/errors.js";
import { createTestContext } from "../setup.js";

const UNKNOWN_ID = 999999;

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await ctx.reset();
});

async function findTodo(id: number) {
  const [row] = await ctx.db.select().from(todos).where(eq(todos.id, id));
  return row;
}

describe("GET /v1/todos", () => {
  it("returns an empty list when there is no todo", async () => {
    // Act
    const res = await request(ctx.app).get("/v1/todos");

    // Assert
    expect(res.status).toBe(200);
    expect(todoListSchema.parse(res.body)).toEqual([]);
  });

  it("returns the newest first", async () => {
    // Arrange
    const [newest, oldest] = await ctx.seed.todos(
      { name: "Newest", createdAt: new Date("2026-10-17T10:00:00.000Z") },
      { name: "Oldest", createdAt: new Date("2026-10-16T10:00:00.000Z") },
    );

    // Act
    const res = await request(ctx.app).get("/v1/todos");

    // Assert
    expect(res.status).toBe(200);
    expect(todoListSchema.parse(res.body)).toEqual([
      { id: newest?.id, name: "Newest", tag: null, isCompleted: false, isPinned: false, dueDate: null, createdAt: "2026-10-17T10:00:00.000Z" },
      { id: oldest?.id, name: "Oldest", tag: null, isCompleted: false, isPinned: false, dueDate: null, createdAt: "2026-10-16T10:00:00.000Z" },
    ]);
  });

  it("breaks ties on the same instant by the latest created first", async () => {
    // Arrange
    const [first, second] = await ctx.seed.todos({ name: "First" }, { name: "Second" });

    // Act
    const res = await request(ctx.app).get("/v1/todos");

    // Assert
    expect(res.status).toBe(200);
    expect(todoListSchema.parse(res.body).map((todo) => todo.id)).toEqual([second?.id, first?.id]);
  });
});

describe("POST /v1/todos", () => {
  it("returns 201 with the trimmed name, no tag, not completed", async () => {
    // Arrange
    ctx.clock.set("2026-10-17T09:00:00.000Z");

    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "  Buy bread  " });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(todo).toEqual({
      id: todo.id,
      name: "Buy bread",
      tag: null,
      isCompleted: false,
      isPinned: false,
      dueDate: null,
      createdAt: "2026-10-17T09:00:00.000Z",
    });
    expect(await findTodo(todo.id)).toMatchObject({ name: "Buy bread", tag: null, isCompleted: false });
  });

  it("accepts a 200-character name and a 30-character tag", async () => {
    // Arrange
    const name = "n".repeat(200);
    const tag = "t".repeat(30);

    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name, tag });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(await findTodo(todo.id)).toMatchObject({ name, tag });
  });

  it.each([
    { label: "missing", body: {} },
    { label: "blank", body: { name: "   " } },
    { label: "201 characters long", body: { name: "n".repeat(201) } },
  ])("returns 400 with a body.name error when the name is $label", async ({ body }) => {
    // Act
    const res = await request(ctx.app).post("/v1/todos").send(body);

    // Assert
    expect(res.status).toBe(400);
    const problem = problemDetailsSchema.parse(res.body);
    expect(problem.code).toBe("validation_failed");
    expect(problem.errors).toHaveProperty(["body.name"]);
    expect(await ctx.db.select().from(todos)).toEqual([]);
  });

  it("returns 400 with a body.tag error when the tag is 31 characters long", async () => {
    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Buy bread", tag: "t".repeat(31) });

    // Assert
    expect(res.status).toBe(400);
    const problem = problemDetailsSchema.parse(res.body);
    expect(problem.errors).toHaveProperty(["body.tag"]);
    expect(await ctx.db.select().from(todos)).toEqual([]);
  });

  it("stores no tag when the tag is only spaces", async () => {
    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Buy bread", tag: "   " });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(todo.tag).toBeNull();
    expect((await findTodo(todo.id))?.tag).toBeNull();
  });

  it("reuses the existing tag's casing", async () => {
    // Arrange
    await ctx.seed.todos({ tag: "Groceries" });

    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Buy bread", tag: "groceries" });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(todo.tag).toBe("Groceries");
    expect((await findTodo(todo.id))?.tag).toBe("Groceries");
  });
});

describe("POST /v1/todos with a due date", () => {
  it("returns 201 with the due date given", async () => {
    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Pay rent", dueDate: "2026-10-24" });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(todo.dueDate).toBe("2026-10-24");
    expect((await findTodo(todo.id))?.dueDate).toBe("2026-10-24");
  });

  it("returns 201 with a null due date when it is left out", async () => {
    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Pay rent" });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(todo.dueDate).toBeNull();
    expect((await findTodo(todo.id))?.dueDate).toBeNull();
  });

  it("accepts a past due date", async () => {
    // Arrange
    ctx.clock.set("2026-10-17T09:00:00.000Z");

    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Pay rent", dueDate: "2026-01-05" });

    // Assert
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(res.body);
    expect(todo.dueDate).toBe("2026-01-05");
    expect((await findTodo(todo.id))?.dueDate).toBe("2026-01-05");
  });

  it.each([
    { label: "not an ISO day", dueDate: "24/10/2026" },
    { label: "a day that does not exist", dueDate: "2026-02-30" },
    { label: "in year 0", dueDate: "0000-01-01" },
  ])("returns 400 with a body.dueDate error when the due date is $label", async ({ dueDate }) => {
    // Act
    const res = await request(ctx.app).post("/v1/todos").send({ name: "Pay rent", dueDate });

    // Assert
    expect(res.status).toBe(400);
    expect(problemDetailsSchema.parse(res.body).errors).toHaveProperty(["body.dueDate"]);
    expect(await ctx.db.select().from(todos)).toEqual([]);
  });
});

describe("PATCH /v1/todos/{id}", () => {
  it("marks a todo completed, then back to not completed", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy bread" });
    const id = seeded?.id ?? UNKNOWN_ID;

    // Act
    const completed = await request(ctx.app).patch(`/v1/todos/${id}`).send({ isCompleted: true });
    const isCompletedAfterFirst = (await findTodo(id))?.isCompleted;
    const reopened = await request(ctx.app).patch(`/v1/todos/${id}`).send({ isCompleted: false });

    // Assert
    expect(completed.status).toBe(200);
    expect(todoSchema.parse(completed.body)).toMatchObject({ id, name: "Buy bread", isCompleted: true });
    expect(isCompletedAfterFirst).toBe(true);
    expect(reopened.status).toBe(200);
    expect(todoSchema.parse(reopened.body)).toMatchObject({ id, isCompleted: false });
    expect((await findTodo(id))?.isCompleted).toBe(false);
  });

  it("returns 404 when the todo does not exist", async () => {
    // Act
    const res = await request(ctx.app).patch(`/v1/todos/${UNKNOWN_ID}`).send({ isCompleted: true });

    // Assert
    expect(res.status).toBe(404);
    expect(problemDetailsSchema.parse(res.body).code).toBe("not_found");
  });

  it.each([
    { label: "the id is not a number", id: "abc", body: { isCompleted: true }, field: "params.id" },
    { label: "the id is zero", id: "0", body: { isCompleted: true }, field: "params.id" },
    { label: "the id is not an integer", id: "1.5", body: { isCompleted: true }, field: "params.id" },
    { label: "the id exceeds the integer range", id: "2147483648", body: { isCompleted: true }, field: "params.id" },
    { label: "isCompleted is missing", id: "1", body: {}, field: "body.isCompleted" },
  ])("returns 400 when $label", async ({ id, body, field }) => {
    // Act
    const res = await request(ctx.app).patch(`/v1/todos/${id}`).send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(problemDetailsSchema.parse(res.body).errors).toHaveProperty([field]);
  });
});

describe("PATCH /v1/todos/{id}/pin", () => {
  it("pins a todo, then unpins it", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy bread" });
    const id = seeded?.id ?? UNKNOWN_ID;

    // Act
    const pinned = await request(ctx.app).patch(`/v1/todos/${id}/pin`).send({ isPinned: true });
    const isPinnedAfterFirst = (await findTodo(id))?.isPinned;
    const unpinned = await request(ctx.app).patch(`/v1/todos/${id}/pin`).send({ isPinned: false });

    // Assert
    expect(pinned.status).toBe(200);
    expect(todoSchema.parse(pinned.body)).toMatchObject({ id, name: "Buy bread", isPinned: true });
    expect(isPinnedAfterFirst).toBe(true);
    expect(unpinned.status).toBe(200);
    expect(todoSchema.parse(unpinned.body)).toMatchObject({ id, isPinned: false });
    expect((await findTodo(id))?.isPinned).toBe(false);
  });

  it("returns 404 when the todo does not exist", async () => {
    // Act
    const res = await request(ctx.app).patch(`/v1/todos/${UNKNOWN_ID}/pin`).send({ isPinned: true });

    // Assert
    expect(res.status).toBe(404);
    expect(problemDetailsSchema.parse(res.body).code).toBe("not_found");
  });

  it.each([
    { label: "the id is not a number", id: "abc", body: { isPinned: true }, field: "params.id" },
    { label: "the id is zero", id: "0", body: { isPinned: true }, field: "params.id" },
    { label: "the id is not an integer", id: "1.5", body: { isPinned: true }, field: "params.id" },
    { label: "the id exceeds the integer range", id: "2147483648", body: { isPinned: true }, field: "params.id" },
    { label: "isPinned is missing", id: "1", body: {}, field: "body.isPinned" },
    { label: "isPinned is not a boolean", id: "1", body: { isPinned: "yes" }, field: "body.isPinned" },
  ])("returns 400 when $label", async ({ id, body, field }) => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy bread" });

    // Act
    const res = await request(ctx.app).patch(`/v1/todos/${id}/pin`).send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(problemDetailsSchema.parse(res.body).errors).toHaveProperty([field]);
    expect((await findTodo(seeded?.id ?? UNKNOWN_ID))?.isPinned).toBe(false);
  });
});

describe("PATCH /v1/todos/{id}/due-date", () => {
  it("sets a due date, changes it, then clears it with null", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy bread" });
    const id = seeded?.id ?? UNKNOWN_ID;

    // Act
    const set = await request(ctx.app).patch(`/v1/todos/${id}/due-date`).send({ dueDate: "2026-10-24" });
    const dueDateAfterSet = (await findTodo(id))?.dueDate;
    const changed = await request(ctx.app).patch(`/v1/todos/${id}/due-date`).send({ dueDate: "2026-11-02" });
    const dueDateAfterChange = (await findTodo(id))?.dueDate;
    const cleared = await request(ctx.app).patch(`/v1/todos/${id}/due-date`).send({ dueDate: null });

    // Assert
    expect(set.status).toBe(200);
    expect(todoSchema.parse(set.body)).toMatchObject({ id, name: "Buy bread", dueDate: "2026-10-24" });
    expect(dueDateAfterSet).toBe("2026-10-24");
    expect(changed.status).toBe(200);
    expect(todoSchema.parse(changed.body).dueDate).toBe("2026-11-02");
    expect(dueDateAfterChange).toBe("2026-11-02");
    expect(cleared.status).toBe(200);
    expect(todoSchema.parse(cleared.body).dueDate).toBeNull();
    expect((await findTodo(id))?.dueDate).toBeNull();
  });

  it("returns 404 when the todo does not exist", async () => {
    // Act
    const res = await request(ctx.app).patch(`/v1/todos/${UNKNOWN_ID}/due-date`).send({ dueDate: "2026-10-24" });

    // Assert
    expect(res.status).toBe(404);
    expect(problemDetailsSchema.parse(res.body).code).toBe("not_found");
  });

  it.each([
    { label: "the id is not a number", id: "abc", body: { dueDate: "2026-10-24" }, field: "params.id" },
    { label: "the id is zero", id: "0", body: { dueDate: "2026-10-24" }, field: "params.id" },
    { label: "the id is not an integer", id: "1.5", body: { dueDate: "2026-10-24" }, field: "params.id" },
    { label: "the id exceeds the integer range", id: "2147483648", body: { dueDate: "2026-10-24" }, field: "params.id" },
    { label: "dueDate is missing", id: "1", body: {}, field: "body.dueDate" },
    { label: "dueDate is not a day", id: "1", body: { dueDate: "24/10/2026" }, field: "body.dueDate" },
    { label: "dueDate is a day that does not exist", id: "1", body: { dueDate: "2026-02-30" }, field: "body.dueDate" },
    { label: "dueDate is in year 0", id: "1", body: { dueDate: "0000-01-01" }, field: "body.dueDate" },
  ])("returns 400 when $label", async ({ id, body, field }) => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy bread", dueDate: "2026-10-01" });

    // Act
    const res = await request(ctx.app).patch(`/v1/todos/${id}/due-date`).send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(problemDetailsSchema.parse(res.body).errors).toHaveProperty([field]);
    expect((await findTodo(seeded?.id ?? UNKNOWN_ID))?.dueDate).toBe("2026-10-01");
  });
});

describe("DELETE /v1/todos/{id}", () => {
  it("returns 204 and the todo is gone", async () => {
    // Arrange
    const [seeded] = await ctx.seed.todos({ name: "Buy bread" });
    const id = seeded?.id ?? UNKNOWN_ID;

    // Act
    const res = await request(ctx.app).delete(`/v1/todos/${id}`);

    // Assert
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await findTodo(id)).toBeUndefined();
  });

  it("returns 404 when the todo does not exist", async () => {
    // Act
    const res = await request(ctx.app).delete(`/v1/todos/${UNKNOWN_ID}`);

    // Assert
    expect(res.status).toBe(404);
    expect(problemDetailsSchema.parse(res.body).code).toBe("not_found");
  });

  it.each([
    { label: "the id is not a number", id: "abc" },
    { label: "the id exceeds the integer range", id: "2147483648" },
  ])("returns 400 when $label", async ({ id }) => {
    // Act
    const res = await request(ctx.app).delete(`/v1/todos/${id}`);

    // Assert
    expect(res.status).toBe(400);
    expect(problemDetailsSchema.parse(res.body).errors).toHaveProperty(["params.id"]);
  });
});
