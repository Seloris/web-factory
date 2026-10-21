import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toProblem, type ProblemDetails } from "../../../api/client.ts";
import { todoKeys } from "./todoKeys.ts";
import type { Todo } from "./useTodosQuery.ts";

export type SetTodoDueDateVariables = { id: number; dueDate: string | null };

export function useSetTodoDueDateMutation() {
  const queryClient = useQueryClient();
  return useMutation<Todo, ProblemDetails, SetTodoDueDateVariables>({
    mutationFn: async ({ id, dueDate }) => {
      const { data, error, response } = await api.PATCH("/v1/todos/{id}/due-date", {
        params: { path: { id } },
        body: { dueDate },
      });
      if (!response.ok || data === undefined) throw toProblem(error, response);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
