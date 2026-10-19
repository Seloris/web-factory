import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toProblem, type ProblemDetails } from "../../../api/client.ts";
import { todoKeys } from "./todoKeys.ts";
import type { Todo } from "./useTodosQuery.ts";

export type SetTodoPinnedVariables = { id: number; isPinned: boolean };

export const setTodoPinnedKey = [...todoKeys.all, "setPinned"] as const;

export function useSetTodoPinnedMutation() {
  const queryClient = useQueryClient();
  return useMutation<Todo, ProblemDetails, SetTodoPinnedVariables>({
    mutationKey: setTodoPinnedKey,
    mutationFn: async ({ id, isPinned }) => {
      const { data, error, response } = await api.PATCH("/v1/todos/{id}/pin", {
        params: { path: { id } },
        body: { isPinned },
      });
      if (!response.ok || data === undefined) throw toProblem(error, response);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
