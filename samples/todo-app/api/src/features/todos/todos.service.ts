import type { Clock } from "../../shared/clock.js";
import { NotFoundError } from "../../shared/errors.js";
import type { TodoRepository } from "./todos.repository.js";
import type { Todo } from "./todos.schema.js";

export function createTodoService({ todos, clock }: { todos: TodoRepository; clock: Clock }) {
  async function resolveTag(typed: string | null | undefined): Promise<string | null> {
    const tag = typed?.trim() ?? "";
    if (tag === "") return null;
    return (await todos.findTagIgnoringCase(tag)) ?? tag;
  }

  return {
    listTodos(): Promise<Todo[]> {
      return todos.list();
    },

    async createTodo(input: { name: string; tag?: string | null | undefined }): Promise<Todo> {
      const tag = await resolveTag(input.tag);
      return todos.insert({ name: input.name, tag, createdAt: clock.now() });
    },

    async setTodoCompleted(id: number, isCompleted: boolean): Promise<Todo> {
      const todo = await todos.setCompleted(id, isCompleted);
      if (todo === null) throw new NotFoundError("Todo", id);
      return todo;
    },

    async deleteTodo(id: number): Promise<void> {
      if (!(await todos.remove(id))) throw new NotFoundError("Todo", id);
    },
  };
}

export type TodoService = ReturnType<typeof createTodoService>;
