import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";

// `.meta({ id })` makes the schema an OpenAPI component without extendZodWithOpenApi; the front reads it by name.
export const todoSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    tag: z.string().nullable(),
    isCompleted: z.boolean(),
    isPinned: z.boolean(),
    dueDate: z.iso.date().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Todo" });

export type Todo = z.infer<typeof todoSchema>;

// PostgreSQL has no year 0: such a day would reach the database and fail as a 500.
export const dueDateSchema = z.iso.date().refine((day) => day >= "0001-01-01");

export const todoListSchema = z.array(todoSchema);

export const createTodoBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  tag: z.string().trim().max(30).nullish(),
  dueDate: dueDateSchema.nullish(),
});

// The upper bound is the integer column's: a larger id would reach Postgres and fail as a 500.
export const todoIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const setTodoCompletedBodySchema = z.object({
  isCompleted: z.boolean(),
});

export const setTodoPinnedBodySchema = z.object({
  isPinned: z.boolean(),
});

export const setTodoDueDateBodySchema = z.object({
  dueDate: dueDateSchema.nullable(),
});

const problemContent = { "application/problem+json": { schema: problemDetailsSchema } };

registry.registerPath({
  method: "get",
  path: "/v1/todos",
  summary: "Every todo, newest first",
  responses: {
    200: { description: "The todos", content: { "application/json": { schema: todoListSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/todos",
  summary: "Add a todo, not completed",
  request: { body: { required: true, content: { "application/json": { schema: createTodoBodySchema } } } },
  responses: {
    201: { description: "The created todo", content: { "application/json": { schema: todoSchema } } },
    400: { description: "The body is invalid", content: problemContent },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/todos/{id}",
  summary: "Mark a todo completed or not completed",
  request: {
    params: todoIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: setTodoCompletedBodySchema } } },
  },
  responses: {
    200: { description: "The updated todo", content: { "application/json": { schema: todoSchema } } },
    400: { description: "The id or the body is invalid", content: problemContent },
    404: { description: "The todo does not exist", content: problemContent },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/todos/{id}/pin",
  summary: "Pin or unpin a todo",
  request: {
    params: todoIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: setTodoPinnedBodySchema } } },
  },
  responses: {
    200: { description: "The updated todo", content: { "application/json": { schema: todoSchema } } },
    400: { description: "The id or the body is invalid", content: problemContent },
    404: { description: "The todo does not exist", content: problemContent },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/todos/{id}/due-date",
  summary: "Set, change or clear a todo's due date",
  request: {
    params: todoIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: setTodoDueDateBodySchema } } },
  },
  responses: {
    200: { description: "The updated todo", content: { "application/json": { schema: todoSchema } } },
    400: { description: "The id or the body is invalid", content: problemContent },
    404: { description: "The todo does not exist", content: problemContent },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/todos/{id}",
  summary: "Delete a todo for good",
  request: { params: todoIdParamsSchema },
  responses: {
    204: { description: "The todo is deleted" },
    400: { description: "The id is invalid", content: problemContent },
    404: { description: "The todo does not exist", content: problemContent },
  },
});
