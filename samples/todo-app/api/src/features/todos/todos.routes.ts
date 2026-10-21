import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import {
  createTodoBodySchema,
  setTodoCompletedBodySchema,
  setTodoDueDateBodySchema,
  setTodoPinnedBodySchema,
  todoIdParamsSchema,
  type Todo,
} from "./todos.schema.js";
import type { TodoService } from "./todos.service.js";

const createSchemas = { body: createTodoBodySchema };
const setCompletedSchemas = { params: todoIdParamsSchema, body: setTodoCompletedBodySchema };
const setPinnedSchemas = { params: todoIdParamsSchema, body: setTodoPinnedBodySchema };
const setDueDateSchemas = { params: todoIdParamsSchema, body: setTodoDueDateBodySchema };
const deleteSchemas = { params: todoIdParamsSchema };

// Public: no sign-in on these routes.
export function todosRoutes({ service }: { service: TodoService }): Router {
  const router = Router();

  router.get("/v1/todos", async (_req, res) => {
    const body: Todo[] = await service.listTodos();
    res.json(body);
  });

  router.post("/v1/todos", validate(createSchemas), async (_req, res) => {
    const { body } = inputOf<typeof createSchemas>(res);
    const todo: Todo = await service.createTodo(body);
    res.status(201).json(todo);
  });

  router.patch("/v1/todos/:id", validate(setCompletedSchemas), async (_req, res) => {
    const { params, body } = inputOf<typeof setCompletedSchemas>(res);
    const todo: Todo = await service.setTodoCompleted(params.id, body.isCompleted);
    res.json(todo);
  });

  router.patch("/v1/todos/:id/pin", validate(setPinnedSchemas), async (_req, res) => {
    const { params, body } = inputOf<typeof setPinnedSchemas>(res);
    const todo: Todo = await service.setTodoPinned(params.id, body.isPinned);
    res.json(todo);
  });

  router.patch("/v1/todos/:id/due-date", validate(setDueDateSchemas), async (_req, res) => {
    const { params, body } = inputOf<typeof setDueDateSchemas>(res);
    const todo: Todo = await service.setTodoDueDate(params.id, body.dueDate);
    res.json(todo);
  });

  router.delete("/v1/todos/:id", validate(deleteSchemas), async (_req, res) => {
    const { params } = inputOf<typeof deleteSchemas>(res);
    await service.deleteTodo(params.id);
    res.status(204).end();
  });

  return router;
}
