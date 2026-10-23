import { beforeAll, describe, expect, it } from "vitest";
import { createTodoRepository } from "../../src/features/todos/todos.repository.js";
import { seedDemo } from "../../src/seed/demo.js";
import { createTestContext } from "../setup.js";

describe("seedDemo", () => {
  let list: Awaited<ReturnType<ReturnType<typeof createTodoRepository>["list"]>>;

  beforeAll(async () => {
    const { db, clock } = await createTestContext();
    // Local noon, so the seed and the test agree on today whatever the time zone.
    clock.set(new Date(2026, 9, 23, 12).toISOString());
    // Act
    await seedDemo(db, clock);
    list = await createTodoRepository(db).list();
  });

  it("covers completed, pinned, tagged, dated and undated todos", () => {
    // Assert
    expect(list.some((t) => t.isCompleted)).toBe(true);
    expect(list.some((t) => t.isPinned)).toBe(true);
    expect(list.some((t) => t.isPinned && t.isCompleted)).toBe(true);
    expect(list.some((t) => t.tag !== null)).toBe(true);
    expect(list.some((t) => t.tag === null)).toBe(true);
    expect(list.some((t) => t.dueDate === null)).toBe(true);
  });

  it("has late, due-today and future todos relative to the clock", () => {
    // Arrange
    const today = "2026-10-23"; // the local day of the clock set in beforeAll

    // Assert
    expect(list.some((t) => !t.isCompleted && t.dueDate !== null && t.dueDate < today)).toBe(true);
    expect(list.some((t) => t.isCompleted && t.dueDate !== null && t.dueDate < today)).toBe(true);
    expect(list.some((t) => t.dueDate === today)).toBe(true);
    expect(list.some((t) => t.dueDate !== null && t.dueDate > today)).toBe(true);
  });

  it("lists the last inserted todo first, with distinct creation times", () => {
    // Assert
    expect(list[0]?.name).toBe("Acheter des fruits");
    const times = list.map((t) => t.createdAt);
    expect(new Set(times).size).toBe(list.length);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("keeps one casing per tag", () => {
    // Arrange
    const tags = list.flatMap((t) => (t.tag === null ? [] : [t.tag]));

    // Assert
    expect(new Set(tags.map((t) => t.toLowerCase())).size).toBe(new Set(tags).size);
  });
});
