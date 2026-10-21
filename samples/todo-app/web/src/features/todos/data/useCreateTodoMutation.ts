import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toProblem, type ProblemDetails } from "../../../api/client.ts";
import { todoKeys } from "./todoKeys.ts";
import type { Todo } from "./useTodosQuery.ts";

export function useCreateTodoMutation() {
  const queryClient = useQueryClient();
  return useMutation<Todo, ProblemDetails, { name: string; tag: string | null; dueDate: string | null }>({
    mutationFn: async (body) => {
      const { data, error, response } = await api.POST("/v1/todos", { body });
      if (!response.ok || data === undefined) throw toProblem(error, response);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
