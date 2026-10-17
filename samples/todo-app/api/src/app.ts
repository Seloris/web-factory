import express from "express";
import type { Database } from "./db/client.js";
import { healthRoutes } from "./features/health/health.routes.js";
import { createTodoRepository } from "./features/todos/todos.repository.js";
import { todosRoutes } from "./features/todos/todos.routes.js";
import { createTodoService } from "./features/todos/todos.service.js";
import type { Clock } from "./shared/clock.js";
import { errorHandler } from "./shared/errors.js";

export interface AppContext {
  db: Database;
  clock: Clock;
}

export function createApp({ db, clock }: AppContext) {
  const app = express();
  app.use(express.json());
  app.use(healthRoutes({ clock }));
  const todos = createTodoRepository(db);
  app.use(todosRoutes({ service: createTodoService({ todos, clock }) }));
  app.use(errorHandler);
  return app;
}
