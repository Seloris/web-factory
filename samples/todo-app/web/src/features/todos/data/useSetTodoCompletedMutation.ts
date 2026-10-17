import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toProblem, type ProblemDetails } from "../../../api/client.ts";
import { todoKeys } from "./todoKeys.ts";
import type { Todo } from "./useTodosQuery.ts";

export type SetTodoCompletedVariables = { id: number; isCompleted: boolean };

export const setTodoCompletedKey = [...todoKeys.all, "setCompleted"] as const;

export function useSetTodoCompletedMutation() {
  const queryClient = useQueryClient();
  return useMutation<Todo, ProblemDetails, SetTodoCompletedVariables>({
    mutationKey: setTodoCompletedKey,
    mutationFn: async ({ id, isCompleted }) => {
      const { data, error, response } = await api.PATCH("/v1/todos/{id}", {
        params: { path: { id } },
        body: { isCompleted },
      });
      if (!response.ok || data === undefined) throw toProblem(error, response);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
