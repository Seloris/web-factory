import { useQuery } from "@tanstack/react-query";
import { api, toProblem } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { todoKeys } from "./todoKeys.ts";

export type Todo = components["schemas"]["Todo"];

export function useTodosQuery() {
  return useQuery({
    queryKey: todoKeys.list(),
    queryFn: async (): Promise<Todo[]> => {
      const { data, error, response } = await api.GET("/v1/todos");
      if (!response.ok || data === undefined) throw toProblem(error, response);
      return data;
    },
  });
}
